import { Edit, Trash2 } from 'lucide-react';
import type { Product, ProductVariation, VariationOption } from '../../types';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../utils/apiClient';

interface ProductCardProps {
    product: Product;
    onEdit: (product: Product) => void;
    onDelete: (id: string) => void;
    onUpdate: (product: Product) => void; // To update local state after quick stock change
}

export default function ProductCard({ product, onEdit, onDelete, onUpdate }: ProductCardProps) {
    const navigate = useNavigate();

    // Check availability logic
    const hasActiveVariations = product.variations && product.variations.some((v: ProductVariation) =>
        v.name && v.name.trim() !== '' && v.options && v.options.length > 0
    );

    const displayStock = hasActiveVariations
        ? product.variations!
            .filter((v: ProductVariation) => v.name && v.name.trim() !== '' && v.options && v.options.length > 0)
            .reduce((total: number, variation: ProductVariation) => {
                return total + variation.options.reduce((sum: number, opt: VariationOption) => sum + (opt.stock || 0), 0);
            }, 0)
        : product.stock || 0;

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

    return (
        <div
            onClick={() => navigate(`/dashboard/products/${product.id}`)}
            className="bg-[#111] rounded-xl border border-[#1a1a1a] overflow-hidden group hover:border-[#00D97E]/20 transition-all shadow-sm hover:shadow-[#00D97E]/5 cursor-pointer"
        >
            <div className="h-32 sm:h-48 overflow-hidden relative bg-black/50">
                <img
                    src={product.images?.[0] || 'https://via.placeholder.com/150/18181b/71717a?text=No+Image'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(product);
                        }}
                        className="bg-black/60 hover:bg-[#00D97E] hover:text-white p-1.5 rounded-lg text-white backdrop-blur-md transition-colors border border-[#1a1a1a]"
                    >
                        <Edit size={14} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(product.id);
                        }}
                        className="bg-black/60 hover:bg-red-500 p-1.5 rounded-lg text-white backdrop-blur-md transition-colors border border-[#1a1a1a]"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="p-3 sm:p-5">
                <h3 className="text-sm sm:text-lg font-bold mb-0.5 text-white truncate">{product.name}</h3>
                <p className="text-[#00D97E] font-bold mb-2 sm:mb-4 font-mono text-xs sm:text-sm">{Number(product.price).toLocaleString()} FCFA</p>

                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] uppercase font-bold tracking-wider flex items-center ${displayStock > 10 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {displayStock > 0 ? `${displayStock} U` : 'ÉPUISÉ'}
                            {hasActiveVariations && <span className="ml-0.5 opacity-60 text-[7px] sm:text-[9px] lowercase">(var.)</span>}
                        </span>

                        {/* Badge Mode Stock */}
                        <span className={`px-1.5 py-0.5 rounded text-[8px] sm:text-[10px] uppercase font-bold tracking-wider flex items-center border cursor-pointer hover:opacity-80 transition-opacity ${!product.manageStock ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-[#111] text-[#888] border-[#1a1a1a]'}`}
                            title={!product.manageStock ? "Vente illimitée autorisée" : "Vente bloquée si épuisé"}
                        >
                            {!product.manageStock ? 'FLX' : 'STRCT'}
                        </span>
                    </div>

                    {/* Quick Stock Actions */}
                    {!hasActiveVariations && product.manageStock !== false && (
                        <div className="flex items-center bg-black rounded border border-zinc-800 w-fit" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => handleStockChange(-1)}
                                className="px-1.5 py-0.5 text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors text-[10px]"
                            >
                                -
                            </button>
                            <span className="text-[10px] font-mono font-bold w-5 text-center text-white">{product.stock}</span>
                            <button
                                onClick={() => handleStockChange(1)}
                                className="px-1.5 py-0.5 text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors text-[10px]"
                            >
                                +
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
