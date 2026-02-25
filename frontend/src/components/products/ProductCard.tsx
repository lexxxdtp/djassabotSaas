import { Edit, Trash2 } from 'lucide-react';
import type { Product, ProductVariation, VariationOption } from '../../types';
import { getApiUrl } from '../../utils/apiConfig';
import { useNavigate } from 'react-router-dom';

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

        const API_URL = getApiUrl();
        const token = localStorage.getItem('token');
        try {
            await fetch(`${API_URL}/products/${product.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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
            className="bg-[#0a0c10] rounded-xl border border-white/5 overflow-hidden group hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-indigo-500/10 cursor-pointer"
        >
            <div className="h-48 overflow-hidden relative bg-black/50">
                <img
                    src={product.images?.[0] || 'https://via.placeholder.com/150/18181b/71717a?text=No+Image'}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                />
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(product);
                        }}
                        className="bg-black/60 hover:bg-indigo-500 hover:text-white p-2 rounded-lg text-white backdrop-blur-md transition-colors border border-white/10"
                    >
                        <Edit size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(product.id);
                        }}
                        className="bg-black/60 hover:bg-red-500 p-2 rounded-lg text-white backdrop-blur-md transition-colors border border-white/10"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div className="p-5">
                <h3 className="text-lg font-bold mb-1 text-white truncate">{product.name}</h3>
                <p className="text-indigo-400 font-bold mb-4 font-mono text-sm">{Number(product.price).toLocaleString()} FCFA</p>

                <div className="flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider flex items-center ${displayStock > 10 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                            {displayStock > 0 ? `${displayStock} STOCK` : 'ÉPUISÉ'}
                            {hasActiveVariations && <span className="ml-1 opacity-60 text-[9px] lowercase">(var.)</span>}
                        </span>

                        {/* Badge Mode Stock */}
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider flex items-center border cursor-pointer hover:opacity-80 transition-opacity ${!product.manageStock ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-white/5 text-zinc-400 border-white/10'}`}
                            title={!product.manageStock ? "Vente illimitée autorisée" : "Vente bloquée si épuisé"}
                        >
                            {!product.manageStock ? 'FLEXIBLE' : 'STRICT'}
                        </span>
                    </div>

                    {/* Quick Stock Actions */}
                    {!hasActiveVariations && product.manageStock !== false && (
                        <div className="flex items-center bg-black rounded border border-zinc-800 w-fit mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => handleStockChange(-1)}
                                className="px-2 py-0.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors text-xs"
                            >
                                -
                            </button>
                            <span className="text-xs font-mono font-bold w-6 text-center text-white">{product.stock}</span>
                            <button
                                onClick={() => handleStockChange(1)}
                                className="px-2 py-0.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors text-xs"
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
