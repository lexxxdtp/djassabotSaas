/**
 * Quel modèle Gemini pour quel message.
 *
 * Répondre « oui, il reste 8 pièces » et valider un reçu Wave ne demandent pas
 * la même intelligence, et ne coûtent pas le même prix : sur le trafic mesuré,
 * Flash-Lite revient à 0,25 FCFA le message contre 0,88 pour Flash. Le gros du
 * trafic passe donc sur le petit modèle, et le grand est réservé aux moments
 * où une erreur coûte de l'argent au vendeur :
 *
 *   - un reçu de paiement (une fausse validation, c'est une commande offerte) ;
 *   - une négociation avec un prix plancher caché ;
 *   - le message qui précède l'écriture d'une commande.
 *
 * Retour en arrière en une commande : `GEMINI_MODEL=gemini-2.5-flash` force ce
 * modèle partout et désactive le routage.
 */
export type Difficulte = 'routine' | 'delicat';

/** Nature de l'appel, telle que déjà utilisée par les compteurs (aiUsage). */
export type NatureAppel = 'reply' | 'image' | 'receipt' | 'voice' | 'dashboard';

export const MODELE_ROUTINE_DEFAUT = 'gemini-2.5-flash-lite';
export const MODELE_DELICAT_DEFAUT = 'gemini-2.5-flash';

export interface ContexteAppel {
    nature: NatureAppel;
    /** Contexte d'inventaire envoyé au modèle (peut contenir un prix plancher). */
    inventaire?: string;
    /** Note d'état de la conversation (WAITING_FOR_CONFIRMATION…). */
    noteEtat?: string;
}

/**
 * Un prix plancher en jeu veut dire que le modèle peut engager de l'argent :
 * c'est le cas où une bêtise se paie comptant.
 */
const negociationEnJeu = (inventaire?: string): boolean =>
    !!inventaire && /minPrice/i.test(inventaire);

/** Le client est sur le point de dire « oui » : la commande va être écrite. */
const surLePointDeCommander = (noteEtat?: string): boolean =>
    !!noteEtat && /WAITING_FOR_CONFIRMATION|CONFIRMATION/i.test(noteEtat);

export const difficultePour = (contexte: ContexteAppel): Difficulte => {
    if (contexte.nature === 'receipt' || contexte.nature === 'image') return 'delicat';
    if (contexte.nature === 'voice' || contexte.nature === 'dashboard') return 'routine';
    if (negociationEnJeu(contexte.inventaire)) return 'delicat';
    if (surLePointDeCommander(contexte.noteEtat)) return 'delicat';
    return 'routine';
};

type Env = Record<string, string | undefined>;

/** `GEMINI_MODEL` imposé = ancien comportement, un seul modèle partout. */
export const routageActif = (env: Env = process.env): boolean => !env.GEMINI_MODEL;

export const nomDuModele = (difficulte: Difficulte, env: Env = process.env): string => {
    if (env.GEMINI_MODEL) return env.GEMINI_MODEL;
    return difficulte === 'delicat'
        ? (env.GEMINI_MODEL_DELICAT || MODELE_DELICAT_DEFAUT)
        : (env.GEMINI_MODEL_ROUTINE || MODELE_ROUTINE_DEFAUT);
};

/**
 * Budget de réflexion : facturé au prix de la sortie, donc réservé aux appels
 * délicats. Sur une réponse de vente courante il double le coût sans rien
 * apporter de visible.
 */
export const budgetReflexion = (difficulte: Difficulte, env: Env = process.env): number => {
    const brut = difficulte === 'delicat'
        ? env.GEMINI_THINKING_BUDGET
        : env.GEMINI_THINKING_BUDGET_ROUTINE;
    const valeur = Number(brut);
    if (Number.isSafeInteger(valeur) && valeur >= 0) return valeur;
    return difficulte === 'delicat' ? 512 : 0;
};
