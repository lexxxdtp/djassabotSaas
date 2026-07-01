// Types et calculs purs de la fiche produit (ProductDetail) — séparés du
// composant pour rester réutilisables (preview, futurs tests) et respecter
// la règle fast-refresh (un fichier de composants n'exporte que des composants).

export interface VariationOption {
    value: string;
    stock?: number;
    priceModifier?: number;
    images?: string[];
}

export interface ProductVariation {
    name: string;
    options: VariationOption[];
}

export interface Product {
    id?: string;
    name: string;
    price: number | string;
    stock: number | string;
    description: string;
    images: string[];
    variations: ProductVariation[];
    aiInstructions: string;
}

export interface VariationTemplate {
    name: string;
    default_options: { value: string; priceModifier: number }[];
    isSystem: boolean;
}

export const hasActiveVariations = (variations: ProductVariation[] | undefined): boolean =>
    !!variations && variations.some(v => v.name && v.name.trim() !== '' && v.options && v.options.length > 0);

export const computeTotalStock = (product: Product): number | string => {
    if (!hasActiveVariations(product.variations)) return product.stock;
    return product.variations
        .filter(v => v.name && v.name.trim() !== '' && v.options && v.options.length > 0)
        .reduce((total, variation) => total + variation.options.reduce((sum, opt) => sum + (opt.stock || 0), 0), 0);
};
