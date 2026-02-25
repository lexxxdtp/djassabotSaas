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

    // Build context
    const productContext = products.map((p: any) => `${p.name} - ${p.price} FCFA`).join('\n');

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

    await sock.sendMessage(remoteJid, { text: response });
    await addToHistory(tenantId, remoteJid, 'model', response);
}
