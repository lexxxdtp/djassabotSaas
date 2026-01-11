import { Router, Request, Response } from 'express';
import { authenticateTenant } from '../middleware/auth';
import { db } from '../services/dbService';
import { generateAIResponse, detectPurchaseIntent, generateIdentitySummary } from '../services/aiService';
// Import session service directly to avoid circular dependency issues if any
import { getSession, updateSession, addToHistory, clearHistory } from '../services/sessionService';

const router = Router();

// Toutes les routes IA nécessitent une auth
router.use(authenticateTenant);

/**
 * Endpoint de simulation de chat pour le Playground
 * POST /api/ai/simulate
 * Body: { message: string, sessionId?: string }
 */
router.post('/simulate', async (req: Request, res: Response): Promise<void> => {
    try {
        const { message, sessionId } = req.body;
        const tenantId = req.tenantId!; // Injecté par le middleware

        // Utiliser une session ID dédiée à la simulation (ex: "sim-tenantID")
        // ou permettre plusieurs sessions de test via sessionId
        const simUserId = sessionId || `sim-${tenantId}`;

        if (!message) {
            res.status(400).json({ error: 'Message requis' });
            return;
        }

        console.log(`[AI Sim] Tenant ${tenantId} msg: ${message}`);

        // 1. Récupérer le contexte
        const settings = await db.getSettings(tenantId);
        const products = await db.getProducts(tenantId);

        // 2. Récupérer la session (historique)
        const session = await getSession(tenantId, simUserId);

        // 3. Logique simplifiée du bot (similaire à waManager mais focus réponse texte)
        const productContext = products.map(p => {
            let info = `${p.name} (${p.price} FCFA)`;
            if (p.variations && p.variations.length > 0) {
                const varText = p.variations.map(v =>
                    `${v.name}: ${v.options.map(o => o.value).join('/')}`
                ).join(', ');
                info += ` [Variations: ${varText}]`;
            }
            return info;
        }).join(', ');

        // --- Détection d'intention (Achat ?) ---
        const intentData = await detectPurchaseIntent(message, productContext);

        let responseText = '';
        let action = null; // Pour dire au frontend qu'une action spéciale a eu lieu (ex: ajout panier)
        let images: string[] = []; // Images à afficher dans le simulateur

        if (intentData.intent === 'BUY' && intentData.productName) {
            const product = await db.getProductByName(tenantId, intentData.productName);
            if (product) {
                let qty = intentData.quantity || 1;

                // Ajouter l'image du produit à la réponse
                if (product.images && product.images.length > 0) {
                    images = product.images.slice(0, 3); // Max 3 images du produit
                }

                // Vérifier le stock disponible (seulement si manageStock est true)
                const shouldCheckStock = product.manageStock !== false;
                if (shouldCheckStock && product.stock !== undefined && product.stock < qty) {
                    if (product.stock <= 0) {
                        // Produit épuisé
                        responseText = `Désolé, ${product.name} est actuellement en rupture de stock. 😔\n\nVoulez-vous que je vous prévienne quand il sera de nouveau disponible ?`;
                        action = { type: 'OUT_OF_STOCK', product };
                    } else {
                        // Stock insuffisant - proposer le max disponible
                        responseText = `Oups ! Il ne reste que ${product.stock} ${product.name} en stock. 📦\n\nVoulez-vous commander les ${product.stock} disponibles pour ${product.stock * product.price} FCFA ?`;
                        action = { type: 'INSUFFICIENT_STOCK', product, requested: qty, available: product.stock };
                    }

                    await addToHistory(tenantId, simUserId, 'user', message);
                    await addToHistory(tenantId, simUserId, 'model', responseText);
                    res.json({ response: responseText, action, images });
                    return;
                }

                // Stock suffisant - procéder à l'ajout au panier
                const total = product.price * qty;

                responseText = `J'ai ajouté ${qty}x ${product.name} au panier (Total: ${total} FCFA). 🛒\n\nÀ quelle adresse (quartier, ville) doit-on livrer ?`;
                action = { type: 'ADD_TO_CART', product, quantity: qty };

                // Mettre à jour l'état session pour que le prochain message soit l'adresse
                await updateSession(tenantId, simUserId, { state: 'WAITING_FOR_ADDRESS' });

                await addToHistory(tenantId, simUserId, 'user', message);
                await addToHistory(tenantId, simUserId, 'model', responseText);

                res.json({ response: responseText, action, images });
                return;
            }
        }

        // --- Réponse IA Standard ---
        const inventoryContext = products.map(p => {
            const isUnlimited = p.manageStock === false;
            const stockInfo = isUnlimited ? '(Stock: Sur commande / Illimité)' : (p.stock !== undefined ? `[Stock: ${p.stock}]` : '[Stock: Illimité]');

            // Si stock limité et <= 0 => Rupture. Sinon => stockInfo
            let status = stockInfo;
            if (!isUnlimited && p.stock !== undefined && p.stock <= 0) {
                status = 'RUPTURE DE STOCK';
            }

            let base = `- ${p.name} (${p.price} FCFA): ${status}`;

            // Add Variations details with Explicit Price Calculations AND Stock
            if (p.variations && p.variations.length > 0) {
                const vars = p.variations.map(v =>
                    `  * ${v.name}: ${v.options.map(o => {
                        const mod = o.priceModifier || 0;
                        const total = p.price + mod;
                        const sign = mod > 0 ? '+' : '';

                        let optStock = '[Stock: Illimité]';
                        if (!isUnlimited) {
                            optStock = o.stock !== undefined ? `[Stock: ${o.stock}]` : '[Stock: Illimité]';
                        } else {
                            optStock = '[Stock: Sur commande]';
                        }

                        return `${o.value}${mod !== 0 ? ` (${sign}${mod}, Total: ${total} FCFA)` : ''} ${optStock}`;
                    }).join(', ')}`
                ).join('\n');
                base += `\n${vars}`;
            }

            // Add Image Tags for the System Prompt to pick up
            if (p.images && p.images.length > 0) {
                base += ` [IMAGES_AVAILABLE: ${p.images.join(', ')}]`;
            }

            return base;
        }).join('\n\n');

        responseText = await generateAIResponse(message, {
            settings,
            inventoryContext,
            history: session.history
        });

        // Extract images from AI response if it used [IMAGE: url] tags
        const imageMatch = responseText.match(/\[IMAGE:\s*(.*?)\]/g);
        if (imageMatch) {
            images = imageMatch.map(tag => {
                const urlMatch = tag.match(/\[IMAGE:\s*(.*?)\]/);
                return urlMatch ? urlMatch[1].trim() : '';
            }).filter(url => url.length > 0);

            // Remove the [IMAGE: url] tags from the response text
            responseText = responseText.replace(/\[IMAGE:\s*.*?\]/g, '').trim();
        }

        // update history
        await addToHistory(tenantId, simUserId, 'user', message);
        await addToHistory(tenantId, simUserId, 'model', responseText);

        res.json({ response: responseText, images });

    } catch (error: any) {
        console.error('Erreur simulation IA:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Reset de la session de simulation
 * POST /api/ai/reset
 */
router.post('/reset', async (req: Request, res: Response) => {
    const { sessionId } = req.body;
    const tenantId = req.tenantId!;
    const simUserId = sessionId || `sim-${tenantId}`;

    await clearHistory(tenantId, simUserId);
    res.json({ success: true, message: 'Mémoire effacée' });
});

/**
 * Générer un résumé de l'identité du bot (Simulation)
 * POST /api/ai/summarize-identity
 */
router.post('/summarize-identity', async (req: Request, res: Response) => {
    try {
        const dummySettings = req.body; // Settings envoyés par le client (draft)
        const summary = await generateIdentitySummary(dummySettings as any);
        res.json({ summary });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});


export default router;
