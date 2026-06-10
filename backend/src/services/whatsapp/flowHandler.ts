import { WASocket } from '@whiskeysockets/baileys';
import { db } from '../dbService';
import { getSession, updateSession, addToHistory, clearHistory, addItemToSessionCart } from '../sessionService';
import { detectPurchaseIntent, generateAIResponse } from '../aiService';
import { sendOrderNotification } from './notificationService';

export async function handleFlow(tenantId: string, remoteJid: string, text: string, sock: WASocket) {
    const session = await getSession(tenantId, remoteJid);

    if (session.autopilotEnabled === false) return;

    // --- STATE MACHINE ---

    // 1. WAITING FOR ADDRESS
    if (session.state === 'WAITING_FOR_ADDRESS') {
        const address = text;
        const tempOrder = session.tempOrder;

        if (!tempOrder) {
            await sock.sendMessage(remoteJid, { text: "Session expirée. Veuillez recommencer." });
            await updateSession(tenantId, remoteJid, { state: 'IDLE' });
            return;
        }

        const orderItems = tempOrder.items && tempOrder.items.length > 0
            ? tempOrder.items
            : [{
                productId: tempOrder.productId || 'unknown',
                productName: tempOrder.productName || 'Produit Inconnu',
                quantity: tempOrder.quantity || 1,
                price: tempOrder.basePrice || tempOrder.total,
                selectedVariations: tempOrder.selectedVariations
            }];

        // CREATE ORDER
        await db.createOrder(tenantId, remoteJid, orderItems, tempOrder.total, address);

        await sock.sendMessage(remoteJid, {
            text: `✅ Commande validée pour ${address} ! Total: ${tempOrder.total} FCFA. Nous vous contactons rapidement.`
        });

        // NOTIFY VENDOR
        await sendOrderNotification(sock, tenantId, remoteJid, address, tempOrder);

        // CLEANUP
        await db.clearCart(tenantId, remoteJid);
        await clearHistory(tenantId, remoteJid);
        await updateSession(tenantId, remoteJid, { state: 'IDLE', tempOrder: undefined });
        return;
    }

    // 2. WAITING FOR VARIATION
    if (session.state === 'WAITING_FOR_VARIATION') {
        // ... (Logic from original handleMessage - keeping it concise here for implementation plan execution)
        // For brevity in this step, I will implement a robust but slightly simplified version or full logic based on original file.
        // Let's implement full logic.

        const tempOrder = session.tempOrder;
        if (!tempOrder?.productId) {
            await updateSession(tenantId, remoteJid, { state: 'IDLE' });
            return;
        }

        const product = await db.getProductById(tenantId, tempOrder.productId);
        if (!product || !product.variations) {
            await updateSession(tenantId, remoteJid, { state: 'IDLE' });
            return;
        }

        const currentVariation = product.variations[tempOrder.variationIndex];
        const userInput = text.trim().toLowerCase();

        let selectedOption = currentVariation.options.find((o: any) => o.value.toLowerCase().includes(userInput)) ||
            currentVariation.options[parseInt(userInput) - 1];

        if (!selectedOption) {
            await sock.sendMessage(remoteJid, { text: `Choix invalide. Veuillez choisir parmi : ${currentVariation.options.map((o: any) => o.value).join(', ')}` });
            return;
        }

        // Add to selection
        const newSelectedVariations = [...(tempOrder.selectedVariations || []), { name: currentVariation.name, value: selectedOption.value }];
        const priceAdjustment = selectedOption.priceModifier || 0;
        const nextIdx = tempOrder.variationIndex + 1;

        if (nextIdx < product.variations.length) {
            // Next Variation
            const nextVar = product.variations[nextIdx];
            const optionsList = nextVar.options.map((o: any, i: number) => `${i + 1}. ${o.value}`).join('\n');

            await updateSession(tenantId, remoteJid, {
                tempOrder: {
                    ...tempOrder,
                    variationIndex: nextIdx,
                    selectedVariations: newSelectedVariations,
                    priceAdjustment: (tempOrder.priceAdjustment || 0) + priceAdjustment
                }
            });

            await sock.sendMessage(remoteJid, { text: `Ok ${selectedOption.value}. Et pour ${nextVar.name} ?\n${optionsList}` });
            return;
        }

        // DONE selection
        const finalPrice = tempOrder.basePrice + (tempOrder.priceAdjustment || 0) + priceAdjustment;
        const cartItem = {
            productId: product.id,
            productName: product.name,
            quantity: tempOrder.quantity,
            price: finalPrice,
            selectedVariations: newSelectedVariations
        };

        const updatedOrder = await addItemToSessionCart(tenantId, remoteJid, cartItem);

        await updateSession(tenantId, remoteJid, { state: 'WAITING_FOR_ADDRESS' });

        await sock.sendMessage(remoteJid, {
            text: `Ajouté: ${tempOrder.quantity}x ${product.name} (${newSelectedVariations.map(v => v.value).join(', ')}).\nTotal: ${updatedOrder.total} FCFA.\n\nAdresse de livraison ?`
        });

        await addToHistory(tenantId, remoteJid, 'model', `Checkout initiated. Total: ${updatedOrder.total}`);
        return;
    }

    // 3. STANDARD AI FLOW (IDLE)
    const settings = await db.getSettings(tenantId);
    const products = await db.getProducts(tenantId);

    // Build rich inventory context — le prompt système attend ces infos :
    // prix plancher (négociation), stock, images [IMAGES_AVAILABLE], consignes spéciales.
    const productContext = products.map((p: any) => {
        const parts: string[] = [`${p.name} - ${p.price} FCFA`];
        if (p.minPrice) parts.push(`(minPrice CACHÉ: ${p.minPrice} FCFA)`);
        if (p.manageStock !== false) {
            parts.push(p.stock > 0 ? `[Stock: ${p.stock}]` : '[RUPTURE DE STOCK]');
        }
        if (p.description) parts.push(`— ${String(p.description).slice(0, 200)}`);
        if (Array.isArray(p.images) && p.images.length > 0) {
            parts.push(`[IMAGES_AVAILABLE: ${p.images.slice(0, 2).join(', ')}]`);
        }
        if (p.aiInstructions) parts.push(`📋 CONSIGNES SPÉCIALES: ${p.aiInstructions}`);
        return parts.join(' ');
    }).join('\n');

    // Intent Detection
    const intentData = await detectPurchaseIntent(text, productContext);

    if (intentData.intent === 'BUY' && intentData.productName) {
        const product = await db.getProductByName(tenantId, intentData.productName);
        if (product) {
            // Check Variations
            if (product.variations && product.variations.length > 0) {
                const firstVar = product.variations[0];
                const optionsList = firstVar.options.map((o: any, i: number) => `${i + 1}. ${o.value}`).join('\n');

                await updateSession(tenantId, remoteJid, {
                    state: 'WAITING_FOR_VARIATION',
                    tempOrder: {
                        productId: product.id,
                        productName: product.name,
                        basePrice: product.price,
                        quantity: intentData.quantity || 1,
                        variationIndex: 0,
                        selectedVariations: [],
                        items: [],
                        total: 0,
                        summary: ''
                    }
                });

                await sock.sendMessage(remoteJid, { text: `Super ! Choisissez une option pour ${firstVar.name}:\n${optionsList}` });
                return;
            }

            // Direct Add
            const cartItem = {
                productId: product.id,
                productName: product.name,
                quantity: intentData.quantity || 1,
                price: product.price
            };
            const updatedOrder = await addItemToSessionCart(tenantId, remoteJid, cartItem);

            await updateSession(tenantId, remoteJid, { state: 'WAITING_FOR_ADDRESS' });
            await sock.sendMessage(remoteJid, {
                text: `Ok, ${cartItem.quantity}x ${product.name} ajouté(s). Total: ${updatedOrder.total} FCFA.\nAdresse de livraison ?`
            });
            return;
        }
    }

    // General AI Chat
    const history = session.history.flatMap(h => h.parts.map(p => ({ role: h.role, parts: [{ text: p.text }] })));
    const response = await generateAIResponse(text, { inventoryContext: productContext, settings, history });

    // Extraire les tags [IMAGE: url] émis par l'IA et envoyer les vraies photos.
    // Sécurité : on n'envoie QUE des URLs présentes dans l'inventaire du tenant
    // (empêche un client malin de faire envoyer une URL arbitraire au bot).
    const allowedImageUrls = new Set<string>(
        products.flatMap((p: any) => (Array.isArray(p.images) ? p.images : []))
    );
    const imageUrls: string[] = [];
    const cleanedResponse = response.replace(/\[IMAGE:\s*([^\]]+?)\s*\]/g, (_match: string, url: string) => {
        if (allowedImageUrls.has(url) && imageUrls.length < 4 && !imageUrls.includes(url)) {
            imageUrls.push(url);
        }
        return '';
    }).replace(/\n{3,}/g, '\n\n').trim();

    if (cleanedResponse) {
        await sock.sendMessage(remoteJid, { text: cleanedResponse });
    }
    for (const url of imageUrls) {
        try {
            await sock.sendMessage(remoteJid, { image: { url } });
        } catch (e) {
            console.error('[FlowHandler] Échec envoi image produit:', url, e);
        }
    }

    await addToHistory(tenantId, remoteJid, 'model', cleanedResponse || response);
}
