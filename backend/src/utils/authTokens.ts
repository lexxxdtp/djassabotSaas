import crypto from 'crypto';

/**
 * Codes OTP et jetons de réinitialisation : ce qui est stocké n'est jamais
 * ce qui est envoyé.
 *
 * Avant ce module, `auth_tokens.token_value` contenait le code à six chiffres
 * ou le jeton de reset EN CLAIR. Une lecture de la base — fuite, sauvegarde mal
 * rangée, clé service_role compromise — suffisait à réinitialiser le mot de
 * passe de n'importe quel commerçant. On stocke désormais une empreinte
 * SHA-256 : elle permet de vérifier un code sans jamais pouvoir le rejouer.
 *
 * SHA-256 sans sel est adapté ICI, et seulement ici : ces jetons sont à haute
 * entropie (UUID v4) ou à vie très courte (OTP de 6 chiffres valable 10 min,
 * avec limitation de débit). Un mot de passe, lui, reste sous bcrypt.
 */
export const hashAuthToken = (valeur: string): string =>
    crypto.createHash('sha256').update(valeur).digest('hex');

/**
 * Valeurs acceptées à la vérification : l'empreinte, et — le temps que les
 * jetons émis avant cette version expirent (une heure au plus) — la valeur en
 * clair. Cette tolérance est datée : elle peut être retirée dès le lendemain
 * du déploiement, sans rien casser d'autre que d'anciens liens déjà expirés.
 */
export const candidatsJeton = (valeur: string): string[] => [hashAuthToken(valeur), valeur];
