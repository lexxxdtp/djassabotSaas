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

/**
 * Retourne un message d'erreur en français, ou null si l'entrée est acceptable.
 *
 * `requireName` distingue la création (le nom est obligatoire) de la mise à
 * jour partielle (seuls les champs présents sont vérifiés).
 */
export function validateProductInput(input: ProductInput, { requireName = false } = {}): string | null {
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
        // Un plancher au-dessus du prix public ne veut rien dire : le moteur de
        // vente refuserait alors toute vente au prix affiché.
        if (isPositiveAmount(price) && minPrice > price) {
            return 'Le prix minimum ne peut pas dépasser le prix de vente';
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

    return null;
}
