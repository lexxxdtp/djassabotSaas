import { Request, Response } from 'express';
import { sendTextMessage, getMediaUrl } from '../services/whatsappService';
import { generateAIResponse, analyzeImage, transcribeAudio, detectPurchaseIntent } from '../services/aiService';
import { db } from '../services/dbService';
import { generateWavePaymentLink } from '../services/paymentService';
import { notifyMerchant } from '../services/notificationService';
import { getSession, updateSession, addToHistory, clearHistory } from '../services/sessionService';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// TODO: For multi-tenant, we need to map phone numbers to tenantIds
// For now, use a default tenant for testing
const DEFAULT_TENANT_ID = 'default-tenant-id';

// Verify Webhook (GET)
export const verifyWebhook = (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
};

// Receive Message (POST)
export const receiveWebhook = async (req: Request, res: Response) => {
    const body = req.body;

    console.log('Incoming webhook:', JSON.stringify(body, null, 2));

    if (body.object) {
        // Ack immediately
        res.status(200).send('EVENT_RECEIVED');

        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;
            const type = message.type;

            try {
                if (type === 'text') {
                    const textBody = message.text.body;
                    console.log(`Received text from ${from}: ${textBody}`);

                    const session = getSession(DEFAULT_TENANT_ID, from);

                    // 1. Check if waiting for delivery info
                    if (session.state === 'WAITING_FOR_ADDRESS') {
                        const address = textBody;
                        const tempOrder = session.tempOrder;

                        // Generate Payment Link
                        const paymentLink = await generateWavePaymentLink(tempOrder.total, `ORDER-${Date.now()}`);

                        // Save to DB (with default tenant for now)
                        await db.createOrder(DEFAULT_TENANT_ID, from, tempOrder.items || [], tempOrder.total, address);

                        await sendTextMessage(from, `Merci ! Livraison prévue à : ${address}. 🚚\n\nVotre total est de ${tempOrder.total} FCFA.\nCliquez ici pour payer : ${paymentLink}`);
                        await notifyMerchant('ORDER', `Nouvelle commande de ${from} !\nArticles: ${tempOrder.summary}\nTotal: ${tempOrder.total}\nLivraison: ${address}`);

                        clearHistory(DEFAULT_TENANT_ID, from); // Reset session after order
                        return;
                    }

                    // 2. Get Product Context & Detect Intent
                    const products = await db.getProducts(DEFAULT_TENANT_ID);
                    const productContext = products.map(p => `${p.name} (${p.price} FCFA)`).join(', ');

                    const intentData = await detectPurchaseIntent(textBody, productContext);

                    if (intentData.intent === 'BUY' && intentData.productName) {
                        // Handle Purchase
                        const product = await db.getProductByName(DEFAULT_TENANT_ID, intentData.productName);
                        if (product) {
                            // Add to cart (cart is per user, not per tenant in current implementation)
                            const cart = await db.addToCart(DEFAULT_TENANT_ID, from, product, intentData.quantity || 1);

                            // Calculate Total
                            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

                            // Ask for delivery address instead of sending link immediately
                            updateSession(DEFAULT_TENANT_ID, from, {
                                state: 'WAITING_FOR_ADDRESS',
                                tempOrder: {
                                    total,
                                    summary: `${intentData.quantity || 1}x ${product.name}`,
                                    items: cart
                                }
                            });

                            await sendTextMessage(from, `J'ai ajouté ${intentData.quantity || 1}x ${product.name} au panier (Total: ${total} FCFA). 🛒\n\nÀ quelle adresse (quartier/ville) doit-on livrer ?`);
                        } else {
                            await sendTextMessage(from, `Je ne trouve pas "${intentData.productName}" en stock. Voulez-vous voir le catalogue ?`);
                        }
                    } else {
                        // Handover Trigger
                        if (textBody.toLowerCase().includes('humain') || textBody.toLowerCase().includes('vendeuse')) {
                            await sendTextMessage(from, `Je transfère votre message à la patronne. Elle vous répond dès que possible ! ⏳`);
                            await notifyMerchant('HANDOVER', `Le client ${from} demande à parler à un humain.\nDernier message: "${textBody}"`);
                            return;
                        }

                        // Normal Chat with Negotiation & History
                        const mockRules = [
                            { description: "Promo Volume", condition: "Achat de 2 articles ou plus", action: "15% de réduction sur le total" },
                            { description: "Promo Client Fidèle", condition: "Si le client insiste poliment", action: "5% de réduction extra" }
                        ];


                        // Pass inventory info to AI
                        const inventoryInfo = `We have in stock: ${productContext}`;

                        // Get Settings
                        const settings = await db.getSettings(DEFAULT_TENANT_ID);

                        // Use History
                        const aiReply = await generateAIResponse(textBody, {
                            rules: mockRules,
                            inventoryContext: inventoryInfo,
                            history: session.history,
                            settings: settings
                        });

                        await sendTextMessage(from, aiReply);

                        // Update History
                        addToHistory(DEFAULT_TENANT_ID, from, 'user', textBody);
                        addToHistory(DEFAULT_TENANT_ID, from, 'model', aiReply);
                    }
                }
                else if (type === 'image') {
                    const imageId = message.image.id;
                    const caption = message.image.caption;
                    console.log(`Received image from ${from}, ID: ${imageId}`);

                    // Get URL
                    const imageUrl = await getMediaUrl(imageId);

                    // Analyze with AI
                    const analysis = await analyzeImage(imageUrl, caption);
                    await sendTextMessage(from, analysis);

                    // Add to session history as context
                    addToHistory(DEFAULT_TENANT_ID, from, 'user', `[User sent an image of: ${analysis}]`);
                    addToHistory(DEFAULT_TENANT_ID, from, 'model', analysis);
                }
                else if (type === 'audio') {
                    const audioId = message.audio.id;
                    const session = getSession(DEFAULT_TENANT_ID, from);
                    console.log(`Received audio from ${from}, ID: ${audioId}`);

                    // Get URL
                    // Analyze Audio
                    const audioUrl = await getMediaUrl(audioId);

                    // Download Audio Buffer
                    const axios = require('axios'); // Ensure axios is available
                    const audioResp = await axios.get(audioUrl, { responseType: 'arraybuffer' });
                    const audioBuffer = Buffer.from(audioResp.data);

                    // Transcribe
                    const transcription = await transcribeAudio(audioBuffer);
                    console.log(`[Audio] Transcribed: "${transcription}"`);

                    // Generate AI Response based on transcription
                    // Reuse existing context logic if possible, or just simple response for now to fix the break
                    const aiReply = await generateAIResponse(transcription, {
                        history: session.history,
                        settings: await db.getSettings(DEFAULT_TENANT_ID)
                    });

                    await sendTextMessage(from, aiReply);

                    // Add to session history
                    addToHistory(DEFAULT_TENANT_ID, from, 'user', `[Audio]: ${transcription}`);
                    addToHistory(DEFAULT_TENANT_ID, from, 'model', aiReply);
                }
                else {
                    console.log(`Received unhandled message type: ${type}`);
                    await sendTextMessage(from, `Désolé, je ne gère pas encore ce type de message.`);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        }
    } else {
        res.sendStatus(404);
    }
};
