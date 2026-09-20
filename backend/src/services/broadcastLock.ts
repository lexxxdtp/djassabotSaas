/**
 * Verrou et plafond des campagnes WhatsApp.
 *
 * La route de diffusion répond immédiatement puis envoie en arrière-plan.
 * Rien n'empêchait d'en lancer deux à la fois : deux boucles tournaient sur la
 * même audience, les clients recevaient les messages en double et le délai
 * anti-ban de 2 à 5 secondes était divisé par deux. C'est le scénario type qui
 * fait bannir un numéro WhatsApp — c'est-à-dire qui coupe la boutique.
 *
 * Le verrou est en mémoire du processus, comme l'envoi qu'il protège : si le
 * processus redémarre, la campagne qu'il protégeait est morte avec lui, donc
 * le verrou n'a plus rien à garder. Il faudra le déplacer en base le jour où
 * le backend tournera sur plusieurs instances.
 */
const enCours = new Set<string>();
const compteurQuotidien = new Map<string, { jour: string; envoyees: number }>();

/** Campagnes autorisées par boutique et par jour. */
export const CAMPAGNES_PAR_JOUR = Number(process.env.BROADCAST_DAILY_LIMIT || 3);

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export type RefusCampagne = 'EN_COURS' | 'PLAFOND_QUOTIDIEN';

/**
 * Réserve le droit d'envoyer. Renvoie le motif du refus, ou null si la
 * campagne peut partir — auquel cas l'appelant DOIT appeler `libererCampagne`
 * dans un `finally`.
 */
export const reserverCampagne = (tenantId: string): RefusCampagne | null => {
    if (enCours.has(tenantId)) return 'EN_COURS';

    const compteur = compteurQuotidien.get(tenantId);
    const jour = aujourdhui();
    const envoyees = compteur && compteur.jour === jour ? compteur.envoyees : 0;
    if (envoyees >= CAMPAGNES_PAR_JOUR) return 'PLAFOND_QUOTIDIEN';

    enCours.add(tenantId);
    compteurQuotidien.set(tenantId, { jour, envoyees: envoyees + 1 });
    return null;
};

export const libererCampagne = (tenantId: string): void => {
    enCours.delete(tenantId);
};

export const campagneEnCours = (tenantId: string): boolean => enCours.has(tenantId);

/** Réservé aux tests : remet compteurs et verrous à zéro. */
export const reinitialiserCampagnes = (): void => {
    enCours.clear();
    compteurQuotidien.clear();
};
