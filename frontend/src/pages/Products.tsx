import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, PackageOpen } from 'lucide-react';
import type { Product, VariationTemplate } from '../types';
import ProductCard from '../components/products/ProductCard';
import ProductFormModal from '../components/products/ProductFormModal';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';

function CardSkeleton() {
    return (
        <div className="bg-[#111] rounded-2xl border border-[#1a1a1a] overflow-hidden">
            <div className="aspect-square bg-[#161616] animate-pulse" />
            <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-[#1a1a1a] animate-pulse" />
                <div className="h-3 w-1/2 rounded bg-[#1a1a1a] animate-pulse" />
                <div className="h-11 rounded-xl bg-[#161616] animate-pulse mt-3" />
            </div>
        </div>
    );
}

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [variationTemplates, setVariationTemplates] = useState<VariationTemplate[]>([]);
    const [query, setQuery] = useState('');

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

    const { token } = useAuth();

    const fetchProducts = useCallback(async () => {
        try {
            const res = await apiClient('/products');
            if (res.ok) {
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            } else {
                toast.error('Impossible de charger les produits.');
            }
        } catch (error) {
            console.error('Failed to fetch products', error);
            toast.error('Erreur réseau. Impossible de charger les produits.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchVariationTemplates = useCallback(async () => {
        try {
            const res = await apiClient('/variation-templates');
            if (res.ok) {
                const data = await res.json();
                setVariationTemplates(data);
            }
        } catch (error) {
            console.error('Failed to fetch variation templates', error);
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchProducts();
            fetchVariationTemplates();
        }
    }, [token, fetchProducts, fetchVariationTemplates]);

    const handleCreate = () => {
        setEditingProduct(undefined);
        setIsModalOpen(true);
    };

    const handleEdit = (product: Product) => {
        setEditingProduct(product);
        setIsModalOpen(true);
    };

    const handleDeleteClick = (id: string) => {
        setDeleteProductId(id);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!deleteProductId) return;
        try {
            await apiClient(`/products/${deleteProductId}`, {
                method: 'DELETE'
            });
            toast.success('Produit supprimé');
            fetchProducts();
        } catch (error) {
            console.error('Failed to delete', error);
            toast.error('Erreur lors de la suppression');
        } finally {
            setIsDeleteModalOpen(false);
            setDeleteProductId(null);
        }
    };

    const handleProductUpdate = (updatedProduct: Product) => {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return products;
        return products.filter(p => p.name.toLowerCase().includes(q));
    }, [products, query]);

    return (
        <div className="relative">
            {/* Header */}
            <div className="flex items-end justify-between gap-4 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Inventaire</h1>
                    <p className="text-[#888] text-sm mt-0.5">
                        {loading ? 'Chargement…' : `${products.length} produit${products.length > 1 ? 's' : ''} en vente`}
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="hidden md:inline-flex bg-[#00D97E] hover:bg-[#00D97E]/95 text-black px-5 py-3 rounded-xl font-bold items-center gap-2 transition-transform active:scale-95 cursor-pointer"
                >
                    <Plus size={20} aria-hidden="true" />
                    <span>Ajouter</span>
                </button>
            </div>

            {/* Search — appears once there's something to search */}
            {!loading && products.length > 0 && (
                <div className="relative mb-5">
                    <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" aria-hidden="true" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher un produit…"
                        className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl h-12 pl-11 pr-4 text-white placeholder:text-[#555] outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow]"
                    />
                </div>
            )}

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                    {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            ) : products.length === 0 ? (
                <div className="py-16 px-6 text-center border border-dashed border-[#1a1a1a] rounded-2xl bg-[#0d0d0d]">
                    <div className="mx-auto w-14 h-14 grid place-items-center rounded-2xl bg-[#00D97E]/10 text-[#00D97E] mb-4">
                        <PackageOpen size={26} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">Votre boutique est vide</h3>
                    <p className="text-[#888] mt-1 mb-6 text-sm max-w-xs mx-auto">
                        Ajoutez votre premier produit — prenez juste une photo, l'IA remplit le reste.
                    </p>
                    <button
                        onClick={handleCreate}
                        className="inline-flex items-center gap-2 bg-[#00D97E] text-black px-5 py-3 rounded-xl font-bold transition-transform active:scale-95"
                    >
                        <Plus size={18} /> Ajouter un produit
                    </button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 text-center text-[#888] text-sm">
                    Aucun produit ne correspond à « <span className="text-white">{query}</span> ».
                </div>
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                    {filtered.map((product, i) => (
                        <div
                            key={product.id}
                            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                            style={{ animationDuration: '400ms', animationDelay: `${Math.min(i, 8) * 40}ms` }}
                        >
                            <ProductCard
                                product={product}
                                onEdit={handleEdit}
                                onDelete={handleDeleteClick}
                                onUpdate={handleProductUpdate}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            <ProductFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                productToEdit={editingProduct}
                onSuccess={fetchProducts}
                templates={variationTemplates}
            />

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Supprimer ce produit ?</h3>
                        <p className="text-[#888] text-sm mb-6">Cette action est irréversible. Le produit ne sera plus disponible.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-3 rounded-xl bg-[#1a1a1a] text-[#888] hover:text-white font-bold text-sm transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-sm transition-colors"
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile FAB — Add product */}
            <button
                onClick={handleCreate}
                aria-label="Ajouter un produit"
                className="md:hidden fixed bottom-24 right-4 z-40 w-14 h-14 bg-[#00D97E] rounded-full shadow-lg shadow-[#00D97E]/30 flex items-center justify-center text-black active:scale-90 transition-transform cursor-pointer"
            >
                <Plus size={26} aria-hidden="true" />
            </button>
        </div>
    );
}
