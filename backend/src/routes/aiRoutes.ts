import { Router, Request, Response } from 'express';
import { authenticateTenant } from '../middleware/auth';
import { db } from '../services/dbService';
import { generateAIResponse, detectPurchaseIntent } from '../services/aiService';
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
        const session = getSession(tenantId, simUserId);

        // 3. Logique simplifiée du bot (similaire à waManager mais focus réponse texte)
        const productContext = products.map(p => `${p.name} (${p.price} FCFA)`).join(', ');

        // --- Détection d'intention (Achat ?) ---
        const intentData = await detectPurchaseIntent(message, productContext);

        let responseText = '';
        let action = null; // Pour dire au frontend qu'une action spéciale a eu lieu (ex: ajout panier)

        if (intentData.intent === 'BUY' && intentData.productName) {
            const product = await db.getProductByName(tenantId, intentData.productName);
            if (product) {
                const qty = intentData.quantity || 1;
                const total = product.price * qty;

                responseText = `[SIMULATION] J'ai ajouté ${qty}x ${product.name} au panier (Total: ${total} FCFA). 🛒\n\nÀ quelle adresse (quartier, ville) doit-on livrer ?`;
                action = { type: 'ADD_TO_CART', product, quantity: qty };

                // Mettre à jour l'état session pour que le prochain message soit l'adresse
                updateSession(tenantId, simUserId, { state: 'WAITING_FOR_ADDRESS' });

                addToHistory(tenantId, simUserId, 'user', message);
                addToHistory(tenantId, simUserId, 'model', responseText);

                res.json({ response: responseText, action });
                return;
            }
        }

        // --- Réponse IA Standard ---
        const inventoryContext = products.map(p =>
            `- ${p.name} (${p.price} FCFA): ${p.stock > 0 ? 'En stock' : 'Épuisé'}`
        ).join('\n');

        responseText = await generateAIResponse(message, {
            settings,
            inventoryContext,
            history: session.history
        });

        // update history
        addToHistory(tenantId, simUserId, 'user', message);
        addToHistory(tenantId, simUserId, 'model', responseText);

        res.json({ response: responseText });

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

    clearHistory(tenantId, simUserId);
    res.json({ success: true, message: 'Mémoire effacée' });
});

export default router;
