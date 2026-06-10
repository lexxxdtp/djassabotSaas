import { Router } from 'express';
import { authenticateTenant } from '../middleware/auth';
import { getActiveSessions, addToHistory } from '../services/sessionService';
import { whatsappManager } from '../services/baileysManager';
import { db } from '../services/dbService';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import { logger } from '../utils/logger';

const router = Router();
router.use(authenticateTenant);

const VIP_THRESHOLD_FCFA = 100_000;
const RECENT_DAYS = 30;

type Audience = 'all' | 'vip' | 'recent';

/** Construit la liste des JIDs clients selon l'audience choisie */
async function resolveAudience(tenantId: string, audience: Audience): Promise<string[]> {
    const sessions = (await getActiveSessions()).filter(s => s.tenantId === tenantId);
    const allJids = [...new Set(sessions.map(s => s.userId))];

    if (audience === 'all') return allJids;

    if (audience === 'recent') {
        const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
        return [...new Set(
            sessions
                .filter(s => new Date(s.lastInteraction).getTime() >= cutoff)
                .map(s => s.userId)
        )];
    }

    // VIP : clients dont le total des commandes dépasse le seuil
    const orders = await db.getOrders(tenantId);
    const totals = new Map<string, number>();
    for (const o of orders) {
        const jid = (o as any).userId;
        if (!jid) continue;
        totals.set(jid, (totals.get(jid) || 0) + (o.total || 0));
    }
    const vipJids = [...totals.entries()]
        .filter(([, total]) => total >= VIP_THRESHOLD_FCFA)
        .map(([jid]) => jid);
    // Ne garder que ceux qu'on connaît en session (sinon JID potentiellement invalide)
    const known = new Set(allJids);
    return vipJids.filter(j => known.has(j));
}

/**
 * GET /api/marketing/audience
 * Renvoie les tailles d'audience réelles pour le formulaire de campagne.
 */
router.get('/audience', async (req: any, res) => {
    try {
        const tenantId = req.tenantId;
        const [all, vip, recent] = await Promise.all([
            resolveAudience(tenantId, 'all'),
            resolveAudience(tenantId, 'vip'),
            resolveAudience(tenantId, 'recent'),
        ]);
        res.json({ all: all.length, vip: vip.length, recent: recent.length });
    } catch (error) {
        logger.error({ err: error }, '[Marketing] audience error');
        res.status(500).json({ error: "Impossible de calculer l'audience" });
    }
});

/**
 * POST /api/marketing/broadcast
 * body: { message: string, audience: 'all' | 'vip' | 'recent' }
 * Envoie le message à tous les clients de l'audience, avec un délai
 * aléatoire entre chaque envoi pour limiter le risque de ban WhatsApp.
 */
router.post('/broadcast', async (req: any, res) => {
    try {
        const tenantId = req.tenantId;
        const { message, audience = 'all' } = req.body as { message?: string; audience?: Audience };

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'Le message est requis' });
        }
        if (message.length > 4000) {
            return res.status(400).json({ error: 'Message trop long (4000 caractères max)' });
        }
        if (!['all', 'vip', 'recent'].includes(audience)) {
            return res.status(400).json({ error: 'Audience invalide' });
        }

        const waSession = await whatsappManager.getSession(tenantId);
        if (!waSession || waSession.status !== 'connected') {
            return res.status(503).json({ error: "WhatsApp n'est pas connecté. Connectez votre bot d'abord." });
        }

        const jids = await resolveAudience(tenantId, audience as Audience);
        if (jids.length === 0) {
            return res.status(400).json({ error: 'Aucun client dans cette audience pour le moment.' });
        }

        const text = message.trim();

        // Répondre tout de suite, puis envoyer en arrière-plan
        res.json({ success: true, queued: jids.length });

        (async () => {
            let sent = 0;
            let failed = 0;
            for (const jid of jids) {
                try {
                    const session = await whatsappManager.getSession(tenantId);
                    if (!session || session.status !== 'connected') {
                        logger.warn({ tenantId }, '[Broadcast] WhatsApp déconnecté en cours de campagne, arrêt');
                        break;
                    }
                    const remoteJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
                    await session.sock.sendMessage(remoteJid, { text });
                    await addToHistory(tenantId, jid, 'model', text);
                    sent++;
                } catch (e) {
                    failed++;
                    logger.warn({ err: e, jid }, '[Broadcast] envoi échoué');
                }
                // Délai anti-ban : 2 à 5 secondes entre chaque message
                await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
            }

            logger.info({ tenantId, sent, failed, audience }, '[Broadcast] campagne terminée');

            if (isSupabaseEnabled && supabase) {
                try {
                    await supabase.from('activity_logs').insert([{
                        tenant_id: tenantId,
                        type: 'campaign',
                        message: `Campagne envoyée à ${sent} client(s)${failed ? ` (${failed} échec(s))` : ''}`,
                        metadata: { audience, sent, failed, preview: text.slice(0, 120) }
                    }]);
                } catch (e) {
                    logger.warn({ err: e }, '[Broadcast] log activité échoué');
                }
            }
        })();
    } catch (error) {
        logger.error({ err: error }, '[Marketing] broadcast error');
        if (!res.headersSent) res.status(500).json({ error: "Erreur lors de l'envoi de la campagne" });
    }
});

export default router;
