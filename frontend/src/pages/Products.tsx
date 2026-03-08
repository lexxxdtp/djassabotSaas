import { useState, useEffect, useCallback } from 'react';
import { Plus, ImageIcon } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';
import type { Product, VariationTemplate } from '../types';
import ProductCard from '../components/products/ProductCard';
import ProductFormModal from '../components/products/ProductFormModal';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function Products() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
    const [variationTemplates, setVariationTemplates] = useState<VariationTemplate[]>([]);

    // Delete Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

    const API_URL = getApiUrl();
    const { token } = useAuth();

    const fetchProducts = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/products`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(Array.isArray(data) ? data : []);
            }
        } catch (error) {
            console.error('Failed to fetch products', error);
        } finally {
            setLoading(false);
        }
    }, [API_URL, token]);

    const fetchVariationTemplates = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/variation-templates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setVariationTemplates(data);
            }
        } catch (error) {
            console.error('Failed to fetch variation templates', error);
        }
    }, [API_URL, token]);

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
            await fetch(`${API_URL}/products/${deleteProductId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
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

    return (
        <div className="space-y-6 relative animate-in fade-in duration-500 p-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Inventaire</h1>
                    <p className="text-zinc-400 text-sm">Gérez vos produits en vente sur WhatsApp</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="hidden md:flex bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white px-6 py-3 rounded-lg font-bold items-center space-x-2 transition-all hover:scale-[1.02]"
                >
                    <Plus size={20} />
                    <span>Ajouter Produit</span>
                </button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="text-zinc-500 text-center py-20 flex flex-col items-center">
                    <div className="animate-spin text-indigo-500 mb-4">⌛️</div>
                    Chargement de l'inventaire...
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {products.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onUpdate={handleProductUpdate}
                        />
                    ))}

                    {/* Empty State */}
                    {products.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/5">
                            <ImageIcon className="mx-auto h-12 w-12 text-zinc-600 mb-4" />
                            <h3 className="text-lg font-medium text-white">Votre boutique est vide</h3>
                            <p className="text-zinc-500 mt-1 mb-6 text-sm">Commencez par ajouter votre premier produit.</p>
                            <button
                                onClick={handleCreate}
                                className="text-indigo-400 hover:text-indigo-300 font-bold text-sm uppercase tracking-wide border-b border-indigo-500/30 hover:border-indigo-500"
                            >
                                + Ajouter maintenant
                            </button>
                        </div>
                    )}
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
                    <div className="bg-[#0a0c10] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Supprimer ce produit ?</h3>
                        <p className="text-zinc-400 text-sm mb-6">Cette action est irréversible. Le produit ne sera plus disponible.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-2 rounded-lg bg-white/5 text-zinc-300 hover:bg-white/10 font-bold text-sm"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold text-sm"
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
                className="md:hidden fixed bottom-20 right-4 z-40 w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
                <Plus size={24} />
            </button>
        </div>
    );
}
