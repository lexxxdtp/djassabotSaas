import { Trash2, Minus, Plus, Layers, Infinity as InfinityIcon } from 'lucide-react';
import type { Product, ProductVariation, VariationOption } from '../../types';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../utils/apiClient';

interface ProductCardProps {
    product: Product;
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onUpdate: (product: Product) => void; // To update local state after quick stock change
}

export default function ProductCard({ product, onDelete, onUpdate }: ProductCardProps) {
    const navigate = useNavigate();

    // Check availability logic
    const hasActiveVariations = product.variations && product.variations.some((v: ProductVariation) =>
        v.name && v.name.trim() !== '' && v.options && v.options.length > 0
    );

    const activeVariationsCount = hasActiveVariations
        ? product.variations!.filter((v: ProductVariation) => v.name && v.name.trim() !== '' && v.options && v.options.length > 0).length
        : 0;

    const displayStock = hasActiveVariations
        ? product.variations!
            .filter((v: ProductVariation) => v.name && v.name.trim() !== '' && v.options && v.options.length > 0)
            .reduce((total: number, variation: ProductVariation) => {
                return total + variation.options.reduce((sum: number, opt: VariationOption) => sum + (opt.stock || 0), 0);
            }, 0)
        : product.stock || 0;

    const unlimited = product.manageStock === false;
    const out = !unlimited && displayStock <= 0;
    const low = !unlimited && displayStock > 0 && displayStock <= 5;

    const handleStockChange = async (delta: number) => {
        const newStock = Math.max(0, product.stock + delta);
        onUpdate({ ...product, stock: newStock }); // Optimistic update

        try {
            await apiClient(`/products/${product.id}`, {
                method: 'PUT',
                body: JSON.stringify({ stock: newStock })
            });
        } catch (error) {
            console.error('Failed to update stock', error);
            onUpdate({ ...product, stock: product.stock }); // Revert
        }
    };

    const stopTap = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <div
            onClick={() => navigate(`/dashboard/products/${product.id}`)}
            className="relative bg-[#111] rounded-2xl border border-[#1a1a1a] overflow-hidden cursor-pointer transition-[transform,border-color] duration-200 ease-out active:scale-[0.98] hover:border-[#00D97E]/25"
        >
            {/* Photo */}
            <div className="relative aspect-square bg-black overflow-hidden">
                {product.images?.[0] ? (
                    <img
                        src={product.images[0]}
                        alt={product.name}
                        loading="lazy"
                        className={`w-full h-full object-cover transition-opacity duration-300 ${out ? 'opacity-30' : 'opacity-100'}`}
                    />
                ) : (
                    <div className="w-full h-full grid place-items-center text-[#333]">
                        <Layers size={28} strokeWidth={1.5} />
                    </div>
                )}

                {/* Stock status pill */}
                <div className="absolute top-2 left-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold leading-none backdrop-blur-md ${
                        out ? 'bg-red-500/25 text-red-300'
                        : low ? 'bg-amber-500/25 text-amber-300'
                        : unlimited ? 'bg-black/50 text-white'
                        : 'bg-black/50 text-white'
                    }`}>
                        {unlimited ? <><InfinityIcon size={12} /> Illimité</> : out ? 'Épuisé' : `${displayStock} en stock`}
                    </span>
                </div>

                {/* Delete — always visible (touch has no hover) */}
                <button
                    onClick={(e) => { stopTap(e); onDelete(product.id); }}
                    aria-label="Supprimer"
                    className="absolute top-2 right-2 w-8 h-8 grid place-items-center rounded-full bg-black/50 backdrop-blur-md text-white/90 active:scale-90 hover:bg-red-500 hover:text-white transition-[transform,background-color,color] duration-150"
                >
                    <Trash2 size={14} />
                </button>
            </div>

            {/* Body */}
            <div className="p-3">
                <h3 className="text-[15px] font-semibold text-white truncate leading-tight">{product.name}</h3>
                <p className="text-[#00D97E] font-bold text-sm mt-0.5 tabular-nums">{Number(product.price).toLocaleString('fr-FR')} FCFA</p>

                {/* Quick action row */}
                <div className="mt-3" onClick={stopTap}>
                    {hasActiveVariations ? (
                        <div className="flex items-center gap-1.5 text-[#888] text-xs h-11">
                            <Layers size={14} className="text-[#00D97E]" />
                            {activeVariationsCount} déclinaison{activeVariationsCount > 1 ? 's' : ''}
                        </div>
                    ) : unlimited ? (
                        <div className="flex items-center gap-1.5 text-[#888] text-xs h-11">
                            <InfinityIcon size={14} /> Vente illimitée
                        </div>
                    ) : (
                        <div className="flex items-center justify-between rounded-xl bg-black border border-[#1a1a1a] p-1">
                            <button
                                onClick={() => handleStockChange(-1)}
                                aria-label="Retirer une unité"
                                className="w-11 h-9 grid place-items-center rounded-lg text-[#888] active:bg-[#1a1a1a] active:text-white hover:text-white transition-colors disabled:opacity-30"
                                disabled={displayStock <= 0}
                            >
                                <Minus size={16} />
                            </button>
                            <span className="font-mono font-semibold text-white text-sm tabular-nums min-w-[2ch] text-center">{product.stock}</span>
                            <button
                                onClick={() => handleStockChange(1)}
                                aria-label="Ajouter une unité"
                                className="w-11 h-9 grid place-items-center rounded-lg text-[#888] active:bg-[#1a1a1a] active:text-white hover:text-white transition-colors"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
