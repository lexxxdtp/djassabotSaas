/**
 * Validation serveur des champs produit.
 *
 * Logique PURE (aucun accès base, réseau ou environnement) pour être testable.
 *
 * Pourquoi ce fichier existe : les routes vérifiaient `typeof price === 'number'
 * && price >= 0`. NaN et Infinity sont des nombres et ne sont pas négatifs, donc
 * ils passaient. Un produit à NaN contamine ensuite tous les totaux — panier,
 * commande, statistiques — sans qu'aucune erreur ne soit levée.
 *
 * `minPrice` n'était pas validé du tout alors qu'il sert de plancher à la
 * négociation : un plancher au-dessus du prix public ou négatif fait dire
 * n'importe quoi au moteur de vente.
 */

/** Nombre réellement utilisable comme montant ou quantité. */
const isUsableNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

const isPositiveAmount = (value: unknown): value is number =>
    isUsableNumber(value) && value >= 0;

const isCount = (value: unknown): value is number =>
    isUsableNumber(value) && Number.isInteger(value) && value >= 0;

export interface ProductInput {
    name?: unknown;
    price?: unknown;
    minPrice?: unknown;
    stock?: unknown;
    variations?: unknown;
}

/** Valeurs déjà enregistrées, pour contrôler une mise à jour partielle comme un tout. */
export interface CurrentProduct {
    price?: unknown;
    minPrice?: unknown;
    variations?: unknown;
}

/**
 * Retourne un message d'erreur en français, ou null si l'entrée est acceptable.
 *
 * `requireName` distingue la création (le nom est obligatoire) de la mise à
 * jour partielle (seuls les champs présents sont vérifiés). `current` fournit
 * les valeurs enregistrées : prix, plancher et suppléments sont alors
 * contrôlés ensemble même si la requête n'en envoie qu'un.
 */
export function validateProductInput(
    input: ProductInput,
    { requireName = false, current }: { requireName?: boolean; current?: CurrentProduct } = {},
): string | null {
    const { name, price, minPrice, stock, variations } = input;

    if (requireName || name !== undefined) {
        if (typeof name !== 'string' || name.trim().length === 0) {
            return 'Nom du produit requis';
        }
        if (name.length > 200) {
            return 'Nom du produit trop long (200 caractères maximum)';
        }
    }

    if (price !== undefined && !isPositiveAmount(price)) {
        return 'Prix invalide';
    }

    if (minPrice !== undefined && minPrice !== null) {
        if (!isPositiveAmount(minPrice)) {
            return 'Prix minimum invalide';
        }
    }

    if (stock !== undefined && stock !== null && !isCount(stock)) {
        return 'Stock invalide';
    }

    if (variations !== undefined) {
        if (!Array.isArray(variations)) {
            return 'Variantes invalides';
        }
        for (const variation of variations) {
            if (!variation || typeof variation !== 'object') {
                return 'Variantes invalides';
            }
            const { name: variationName, options } = variation as { name?: unknown; options?: unknown };
            if (typeof variationName !== 'string' || variationName.trim().length === 0) {
                return 'Chaque variante doit avoir un nom';
            }
            if (!Array.isArray(options) || options.length === 0) {
                return `La variante "${variationName}" doit avoir au moins une option`;
            }
            for (const option of options) {
                if (!option || typeof option !== 'object') {
                    return `Option invalide dans la variante "${variationName}"`;
                }
                const { value, stock: optionStock, priceModifier } = option as {
                    value?: unknown; stock?: unknown; priceModifier?: unknown;
                };
                if (typeof value !== 'string' || value.trim().length === 0) {
                    return `Chaque option de "${variationName}" doit avoir une valeur`;
                }
                if (optionStock !== undefined && optionStock !== null && !isCount(optionStock)) {
                    return `Stock invalide pour l'option "${value}"`;
                }
                // Un supplément peut être négatif (remise), mais jamais NaN.
                if (priceModifier !== undefined && priceModifier !== null && !isUsableNumber(priceModifier)) {
                    return `Supplément invalide pour l'option "${value}"`;
                }
            }
        }
    }

    // Cohérence des montants, avec les valeurs enregistrées pour les champs absents.
    if (price !== undefined || minPrice !== undefined || variations !== undefined) {
        const effectivePrice = price !== undefined ? price : current?.price;
        const effectiveMin = minPrice !== undefined ? minPrice : current?.minPrice;
        const effectiveVariations = variations !== undefined ? variations : current?.variations;

        // Un plancher au-dessus du prix public ne veut rien dire : le moteur de
        // vente refuserait alors toute vente au prix affiché.
        if (isPositiveAmount(effectivePrice) && isPositiveAmount(effectiveMin) && effectiveMin > effectivePrice) {
            return 'Le prix minimum ne peut pas dépasser le prix de vente';
        }

        // Des remises d'options cumulées ne doivent jamais rendre un prix négatif :
        // 1 000 FCFA avec deux options à −800 donnait −600 FCFA au panier.
        if (isPositiveAmount(effectivePrice) && Array.isArray(effectiveVariations) && effectiveVariations.length > 0) {
            let lowest = isPositiveAmount(effectiveMin) && effectiveMin > 0 ? effectiveMin : effectivePrice;
            for (const variation of effectiveVariations) {
                const options = (variation as { options?: unknown } | null)?.options;
                const modifiers = (Array.isArray(options) ? options : []).map(option => {
                    const modifier = (option as { priceModifier?: unknown } | null)?.priceModifier;
                    return isUsableNumber(modifier) ? modifier : 0;
                });
                if (modifiers.length > 0) lowest += Math.min(...modifiers);
            }
            if (lowest < 0) {
                return `Une combinaison d'options reviendrait à ${Math.round(lowest)} FCFA : réduisez les remises des options pour que le prix reste positif.`;
            }
        }
    }

    return null;
}
