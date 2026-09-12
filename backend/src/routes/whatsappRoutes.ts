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

        // Lecture passive : cette route est interrogée toutes les 15 secondes par
        // le tableau de bord. Elle n'ouvre une session que s'il n'en existe
        // aucune ET que le vendeur ne s'est pas déconnecté volontairement.
        whatsappManager.ensureSession(tenantId);

        // Renvoyer le QR s'il est dispo en mémoire (ou attendre un peu ?)
        // Ici on renvoie ce qu'on a. Le frontend fera du polling.
        res.json({
            connected: false,
            status: session?.status || 'disconnected',
            qrCode: session?.qr
        });

    } catch (error: any) {
        console.error('Erreur status WhatsApp:', error);
        res.status(500).json({ error: 'Statut du bot indisponible pour le moment.' });
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
        res.status(500).json({ error: 'Impossible de générer le code de jumelage. Vérifiez le numéro et réessayez.' });
    }
});

// Déconnexion
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        await whatsappManager.disconnect(tenantId);
        res.json({ success: true, message: 'Déconnecté avec succès' });
    } catch (error: any) {
        console.error('Erreur déconnexion WhatsApp:', error);
        res.status(500).json({ error: 'La déconnexion a échoué. Réessayez dans un instant.' });
    }
});

export default router;
