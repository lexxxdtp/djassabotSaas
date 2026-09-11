import { Router, Request, Response } from 'express';
import multer from 'multer';
import type { WASocket } from '@whiskeysockets/baileys';
import { authenticateTenant } from '../middleware/auth';
import { generateIdentitySummary, parsePersonalityFromDescription, analyzeProductPhoto } from '../services/aiService';
import { handleFlow } from '../services/whatsapp/flowHandler';
import { addToHistory, clearHistory } from '../services/sessionService';
import { runSimulation, SIMULATION_USER_ID, SimulationBusyError } from '../services/simulationContext';

const router = Router();

const photoUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Toutes les routes IA nécessitent une auth
router.use(authenticateTenant);

/**
 * "Photo d'abord" : le vendeur envoie la photo de son produit,
 * l'IA propose nom + description pour pré-remplir le formulaire.
 * POST /api/ai/analyze-product-photo (multipart, champ 'file')
 */
router.post('/analyze-product-photo', photoUpload.single('file'), async (req: any, res: Response): Promise<void> => {
    try {
        if (!req.file || !req.file.buffer) {
            res.status(400).json({ error: 'Photo requise' });
            return;
        }
        const suggestion = await analyzeProductPhoto(req.file.buffer, req.file.mimetype || 'image/jpeg');
        res.json(suggestion);
    } catch (e) {
        console.error('[AI] analyze-product-photo error:', e);
        res.status(500).json({ error: "Impossible d'analyser la photo" });
    }
});

/**
 * Endpoint de simulation de chat pour le Playground (Réglages → Mon Bot)
 * POST /api/ai/simulate
 * Body: { message: string }. L'identité de test est imposée côté serveur.
 *
 * IMPORTANT : le simulateur passe par LE MÊME moteur que le vrai bot WhatsApp
 * (flowHandler + salesEngine) en mode dryRun — mêmes règles de négociation,
 * de stock, de livraison — mais AUCUNE commande réelle n'est créée et AUCUN
 * stock n'est décrémenté. Historique et panier sont temporaires et séparés
 * des clients. La simulation ne valide pas les intégrations WhatsApp réelles.
 */
router.post('/simulate', async (req: Request, res: Response): Promise<void> => {
    try {
        const { message } = req.body;
        const tenantId = req.tenantId!;
        const simUserId = SIMULATION_USER_ID;

        if (typeof message !== 'string' || !message.trim() || message.length > 4000) {
            res.status(400).json({ error: 'Saisissez un message de 1 à 4 000 caractères.' });
            return;
        }

        // Faux socket : capture ce que le bot aurait envoyé sur WhatsApp
        const outgoing: { texts: string[]; images: string[] } = { texts: [], images: [] };
        const fakeSock = {
            sendMessage: async (_jid: string, content: any) => {
                if (content?.text) outgoing.texts.push(content.text);
                if (content?.image?.url) outgoing.images.push(content.image.url);
                return undefined;
            },
        } as unknown as WASocket;

        // Même séquence que messageHandler : message utilisateur en historique, puis flux
        await runSimulation(tenantId, async () => {
            await addToHistory(tenantId, simUserId, 'user', message);
            await handleFlow(tenantId, simUserId, message, fakeSock, { dryRun: true });
        });

        res.json({
            response: outgoing.texts.join('\n\n') || '…',
            images: outgoing.images,
        });
    } catch (error: any) {
        console.error('Erreur simulation IA:', error);
        res.status(error instanceof SimulationBusyError ? 409 : 500).json({ error: error instanceof SimulationBusyError
            ? 'Un test est en cours. Attendez sa réponse avant de réessayer.'
            : 'Le test a échoué. Réessayez dans un instant.' });
    }
});

/**
 * Reset de la session de simulation
 * POST /api/ai/reset
 */
router.post('/reset', async (req: Request, res: Response) => {
    const tenantId = req.tenantId!;
    try {
        await runSimulation(tenantId, () => clearHistory(tenantId, SIMULATION_USER_ID));
        res.json({ success: true, message: 'Mémoire du test effacée' });
    } catch (error) {
        res.status(error instanceof SimulationBusyError ? 409 : 500).json({ error: 'Impossible de remettre le test à zéro. Attendez la fin de la réponse et réessayez.' });
    }
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

/**
 * Analyser une description libre pour configurer la personnalité
 * POST /api/ai/parse-personality
 */
router.post('/parse-personality', async (req: Request, res: Response) => {
    try {
        const { description } = req.body;
        if (!description) {
            res.status(400).json({ error: 'Description requise' });
            return;
        }

        const config = await parsePersonalityFromDescription(description);
        res.json(config);
    } catch (e: any) {
        res.status(500).json({ error: e.message || 'Erreur lors de l\'analyse de la description' });
    }
});


export default router;
