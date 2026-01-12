import { Router, Request, Response } from 'express';
import { whatsappManager } from '../services/baileysManager';
import { authenticateTenant } from '../middleware/auth';
import { db } from '../services/dbService';

const router = Router();

// Toutes les routes WhatsApp nécessitent une auth
router.use(authenticateTenant);

// Vérifier le statut (et générer QR si nécessaire)
router.get('/status', async (req: Request, res: Response): Promise<void> => {
    try {
        const tenantId = req.tenantId!;

        // Récupérer le statut actuel depuis la DB
        const tenant = await db.getTenantById(tenantId);
        if (!tenant) {
            res.status(404).json({ error: 'Tenant non trouvé' });
            return;
        }

        // Vérifier la session active en mémoire
        const session = await whatsappManager.getSession(tenantId);

        if (tenant.whatsappConnected && session?.status === 'connected') {
            res.json({
                connected: true,
                status: 'connected',
                phoneNumber: tenant.whatsappPhoneNumber
            });
            return;
        }

        // Si non connecté, s'assurer qu'une session de connexion est lancée pour avoir un QR
        if (!session || session.status === 'disconnected') {
            // Lancer la création de session en arrière-plan si pas déjà fait
            whatsappManager.createSession(tenantId).catch(console.error);
        }

        // Renvoyer le QR s'il est dispo en mémoire (ou attendre un peu ?)
        // Ici on renvoie ce qu'on a. Le frontend fera du polling.
        res.json({
            connected: false,
            status: session?.status || 'disconnected',
            qrCode: session?.qr
        });

    } catch (error: any) {
        console.error('Erreur status WhatsApp:', error);
        res.status(500).json({ error: error.message });
    }
});

// Obtenir un code de jumelage (Pairing Code)
router.post('/pair-code', async (req: Request, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            res.status(400).json({ error: 'Numéro de téléphone requis' });
            return;
        }

        const code = await whatsappManager.requestPairingCode(tenantId, phoneNumber);
        res.json({ success: true, code });

    } catch (error: any) {
        console.error('Erreur Pairing Code:', error);
        res.status(500).json({ error: error.message });
    }
});

// Déconnexion
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        await whatsappManager.disconnect(tenantId);
        res.json({ success: true, message: 'Déconnecté avec succès' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
