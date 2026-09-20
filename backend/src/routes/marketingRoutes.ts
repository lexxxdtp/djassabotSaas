import { Router } from 'express';
import { authenticateTenant } from '../middleware/auth';
import { getActiveSessions, addToHistory } from '../services/sessionService';
import { whatsappManager } from '../services/baileysManager';
import { db } from '../services/dbService';
import { supabase, isSupabaseEnabled } from '../config/supabase';
import { logger } from '../utils/logger';
import { reserverCampagne, libererCampagne, CAMPAGNES_PAR_JOUR } from '../services/broadcastLock';

const router = Router();
router.use(authenticateTenant);

const VIP_THRESHOLD_FCFA = 100_000;
/**
 * Statuts qui valent de l'argent encaissé. PENDING et CONFIRMED attendent
 * toujours un paiement, CANCELLED n'en verra jamais : aucun des trois ne
 * représente une dépense du client.
 */
const PAID_STATUSES = new Set(['PAID', 'SHIPPING', 'SHIPPED', 'DELIVERED']);
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

    // VIP : clients dont le total RÉELLEMENT PAYÉ dépasse le seuil.
    // Toutes les commandes étaient additionnées, statut compris : un client qui
    // avait commandé pour 150 000 FCFA sans jamais payer, ou qui avait annulé,
    // était classé VIP. Le vendeur visait alors ses meilleurs clients auprès de
    // gens qui ne lui avaient rien rapporté.
    const orders = await db.getOrders(tenantId);
    const totals = new Map<string, number>();
    for (const o of orders) {
        const jid = (o as any).userId;
        if (!jid) continue;
        if (!PAID_STATUSES.has(o.status)) continue;
        const amount = Number(o.total);
        if (!Number.isFinite(amount) || amount <= 0) continue;
        totals.set(jid, (totals.get(jid) || 0) + amount);
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
 * GET /api/marketing/stats
 * Statistiques réelles des campagnes (depuis activity_logs type 'campaign').
 */
router.get('/stats', async (req: any, res) => {
    try {
        const tenantId = req.tenantId;
        if (!isSupabaseEnabled || !supabase) {
            return res.json({ campaigns: 0, sent: 0, lastCampaignAt: null });
        }
        const { data, error } = await supabase
            .from('activity_logs')
            .select('metadata, created_at')
            .eq('tenant_id', tenantId)
            .eq('type', 'campaign')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        const rows = data || [];
        const sent = rows.reduce((s, r: any) => s + (r.metadata?.sent || 0), 0);
        res.json({
            campaigns: rows.length,
            sent,
            lastCampaignAt: rows[0]?.created_at || null,
        });
    } catch (error) {
        logger.error({ err: error }, '[Marketing] stats error');
        res.status(500).json({ error: 'Impossible de charger les statistiques' });
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

        // Deux campagnes simultanées, c'est le double de messages pour le client
        // et un délai anti-ban divisé par deux : le meilleur moyen de faire
        // bannir le numéro WhatsApp du vendeur.
        const refus = reserverCampagne(tenantId);
        if (refus === 'EN_COURS') {
            return res.status(409).json({
                error: 'Une campagne est déjà en cours. Attendez qu\'elle se termine.',
                code: 'CAMPAGNE_EN_COURS',
            });
        }
        if (refus === 'PLAFOND_QUOTIDIEN') {
            return res.status(429).json({
                error: `Vous avez atteint la limite de ${CAMPAGNES_PAR_JOUR} campagnes pour aujourd'hui. Trop de messages d'un coup font bloquer un numéro WhatsApp.`,
                code: 'PLAFOND_CAMPAGNES',
            });
        }

        // Répondre tout de suite, puis envoyer en arrière-plan
        res.json({ success: true, queued: jids.length });

        (async () => {
          try {
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
                // Le type 'campaign' était refusé par la contrainte de la table
                // (info/sale/warning/action) : la trace des campagnes n'a jamais
                // été écrite. 'action' passe, et metadata garde la nature exacte.
                const { error } = await supabase.from('activity_logs').insert([{
                    tenant_id: tenantId,
                    type: 'action',
                    message: `Campagne envoyée à ${sent} client(s)${failed ? ` (${failed} échec(s))` : ''}`,
                    metadata: { kind: 'campaign', audience, sent, failed, preview: text.slice(0, 120) }
                }]);
                if (error) logger.warn({ err: error, tenantId }, '[Broadcast] log activité refusé par la base');
            }
          } finally {
            // Sans ce relâchement, un échec en cours de route interdisait
            // définitivement les campagnes jusqu'au prochain redémarrage.
            libererCampagne(tenantId);
          }
        })();
    } catch (error) {
        logger.error({ err: error }, '[Marketing] broadcast error');
        if (!res.headersSent) res.status(500).json({ error: "Erreur lors de l'envoi de la campagne" });
    }
});

export default router;
