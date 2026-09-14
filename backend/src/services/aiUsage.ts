import { logger } from '../utils/logger';

/**
 * Plafond de consommation IA (audit du 14 septembre 2026, A07).
 *
 * Chaque appel Gemini — réponse, vocal, photo, reçu, outils du dashboard —
 * réserve sa place ici AVANT de partir. Au-delà du plafond quotidien de la
 * boutique ou du plafond global du serveur, l'appel est refusé : une alerte de
 * facturation ne remplace pas un arrêt effectif.
 *
 * Plafonds réglables sans redéployer (.env) :
 *   AI_DAILY_CALLS_PER_TENANT  (défaut 300)
 *   AI_DAILY_CALLS_GLOBAL      (défaut 2000)
 *
 * Compteurs en mémoire du processus, remis à zéro chaque jour (UTC, soit
 * l'heure d'Abidjan). Un redémarrage les remet aussi à zéro : c'est un garde-fou
 * de dépense pour le pilote, pas une facturation.
 */

export type AiCallKind = 'reply' | 'voice' | 'image' | 'receipt' | 'dashboard';

export class AiQuotaExceededError extends Error {
    readonly code = 'AI_QUOTA_EXCEEDED';

    constructor(readonly scope: 'tenant' | 'global') {
        super(scope === 'tenant'
            ? 'Plafond quotidien IA de la boutique atteint'
            : 'Plafond quotidien IA du serveur atteint');
    }
}

const readLimit = (name: string, fallback: number): number => {
    const value = Number(process.env[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
};

let currentDay = '';
let globalCount = 0;
const perTenant = new Map<string, number>();

const rollDay = (now: number) => {
    const day = new Date(now).toISOString().slice(0, 10);
    if (day === currentDay) return;
    currentDay = day;
    globalCount = 0;
    perTenant.clear();
};

/** Réserve un appel IA ; lève AiQuotaExceededError si un plafond est atteint. */
export const reserveAiCall = (tenantId: string | undefined, kind: AiCallKind, now: number = Date.now()): void => {
    rollDay(now);

    if (globalCount >= readLimit('AI_DAILY_CALLS_GLOBAL', 2000)) {
        logger.warn({ kind, globalCount }, '[AI] Plafond global atteint — appel refusé');
        throw new AiQuotaExceededError('global');
    }

    const key = tenantId || 'sans-boutique';
    const used = perTenant.get(key) ?? 0;
    if (used >= readLimit('AI_DAILY_CALLS_PER_TENANT', 300)) {
        logger.warn({ tenantId, kind, used }, '[AI] Plafond boutique atteint — appel refusé');
        throw new AiQuotaExceededError('tenant');
    }

    perTenant.set(key, used + 1);
    globalCount++;
};

/** Journalise la consommation rapportée par Gemini, jamais le contenu échangé. */
export const recordAiUsage = (
    tenantId: string | undefined,
    kind: AiCallKind,
    usage: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number } | undefined,
): void => {
    if (!usage) return;
    logger.info({
        tenantId,
        kind,
        promptTokens: usage.promptTokenCount,
        outputTokens: usage.candidatesTokenCount,
        thoughtTokens: (usage as { thoughtsTokenCount?: number }).thoughtsTokenCount,
        totalTokens: usage.totalTokenCount,
    }, '[AI] usage');
};
