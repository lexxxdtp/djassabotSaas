import crypto from 'crypto';

/**
 * Révocation des sessions après un changement de mot de passe.
 *
 * Les JWT valent sept jours et rien ne permettait de les annuler : quelqu'un
 * qui réinitialisait son mot de passe parce qu'il se croyait piraté gardait
 * en face de lui une session voleuse valide une semaine de plus.
 *
 * Plutôt qu'une colonne de version en base (migration, écritures
 * supplémentaires), le jeton porte une empreinte du mot de passe du moment.
 * Changer de mot de passe change l'empreinte, donc invalide d'un coup TOUTES
 * les sessions ouvertes avec l'ancien — sans rien ajouter au schéma.
 *
 * L'empreinte dérive du hash bcrypt, jamais du mot de passe : même divulguée,
 * elle n'apprend rien d'utilisable.
 */
export const empreinteMotDePasse = (hashBcrypt: string): string =>
    crypto.createHash('sha256').update(hashBcrypt).digest('hex').slice(0, 16);

/**
 * Une session est périmée quand l'empreinte portée par son jeton ne correspond
 * plus à celle du mot de passe actuel.
 *
 * Les DEUX paramètres sont des empreintes, jamais des hash : passer un hash
 * bcrypt ici le ferait hacher une seconde fois et rejetterait toutes les
 * sessions, y compris les bonnes. C'est exactement ce qui s'est produit à la
 * première mise en ligne, d'où la comparaison désormais littérale.
 *
 * Deux prudences volontaires :
 * - un jeton SANS empreinte est accepté : ceux émis avant cette version
 *   expireront d'eux-mêmes en sept jours, on ne déconnecte pas tout le monde ;
 * - une empreinte actuelle inconnue (panne de lecture) n'invalide rien : une
 *   panne de base ne doit pas jeter dehors des vendeurs légitimes.
 */
export const sessionPerimee = (empreinteDuJeton: string | undefined, empreinteActuelle: string | undefined | null): boolean => {
    if (!empreinteDuJeton) return false;
    if (!empreinteActuelle) return false;
    return empreinteDuJeton !== empreinteActuelle;
};
