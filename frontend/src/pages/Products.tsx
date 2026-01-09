
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, X, Image as ImageIcon, Tags } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getApiUrl } from '../utils/apiConfig';

// Types for variations
interface VariationOption {
    value: string;
    stock?: number;
    priceModifier?: number;
}

interface ProductVariation {
    name: string;
    options: VariationOption[];
}

const Products: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

    // Form State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [productForm, setProductForm] = useState({
        name: '',
        price: '',
        stock: '',
        description: '',
        images: [] as string[],
        variations: [] as ProductVariation[]
    });
    const [uploading, setUploading] = useState(false);

    // Fetch Products
    const fetchProducts = async () => {
        try {
            const API_URL = getApiUrl();
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/products`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Failed to fetch');

            const data = await res.json();
            if (Array.isArray(data)) {
                setProducts(data);
            } else {
                setProducts([]);
            }
        } catch (error) {
            console.error('Failed to fetch products', error);
            setProducts([]); // Fallback to empty array to prevent crash
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    // Open Modal for Create
    const openCreateModal = () => {
        setEditingId(null);
        setProductForm({ name: '', price: '', stock: '', description: '', images: [], variations: [] });
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const openEditModal = (product: any) => {
        setEditingId(product.id);
        setProductForm({
            name: product.name,
            price: product.price,
            stock: product.stock,
            description: product.description || '',
            images: product.images || [],
            variations: product.variations || []
        });
        setIsModalOpen(true);
    };

    // Handle Delete (Trigger Modal)
    const handleDelete = (id: string) => {
        setDeleteProductId(id);
        setIsDeleteModalOpen(true);
    };

    // Confirm Delete (API Call)
    const confirmDelete = async () => {
        if (!deleteProductId) return;
        try {
            const API_URL = getApiUrl();
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/products/${deleteProductId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            fetchProducts();
        } catch (error) {
            console.error('Failed to delete product', error);
        } finally {
            setIsDeleteModalOpen(false);
            setDeleteProductId(null);
        }
    };

    // Handle Submit (Create or Update)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: productForm.name,
                price: Number(productForm.price),
                stock: Number(productForm.stock),
                description: productForm.description,
                images: productForm.images,
                variations: productForm.variations
            };

            const API_URL = getApiUrl();
            const token = localStorage.getItem('token');
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            let response;
            if (editingId) {
                // Update
                response = await fetch(`${API_URL}/products/${editingId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                // Create
                response = await fetch(`${API_URL}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erreur lors de la sauvegarde');
            }

            setIsModalOpen(false);
            fetchProducts();
        } catch (error: any) {
            console.error('Failed to save product', error);
            alert(`Erreur: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6 relative animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-zinc-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Inventaire</h1>
                    <p className="text-zinc-500">Gérez vos produits en vente sur WhatsApp</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-orange-500 hover:bg-orange-600 text-black px-6 py-3 rounded-lg font-bold shadow-lg shadow-orange-500/20 flex items-center space-x-2 transition-all"
                >
                    <Plus size={20} />
                    <span>Ajouter Produit</span>
                </button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="text-zinc-500 text-center py-20 flex flex-col items-center">
                    <div className="animate-spin text-orange-500 mb-4">⌛️</div>
                    Chargement de l'inventaire...
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => navigate(`/dashboard/products/${product.id}`)}
                            className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden group hover:border-orange-500/50 transition-all shadow-sm hover:shadow-orange-500/10 cursor-pointer"
                        >
                            <div className="h-48 overflow-hidden relative bg-zinc-950">
                                <img
                                    src={product.images?.[0] || 'https://via.placeholder.com/150/18181b/71717a?text=No+Image'}
                                    alt={product.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90 group-hover:opacity-100"
                                />
                                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openEditModal(product); // Fix: Use openEditModal instead of navigation if intended for quick edit, or allow nav.
                                            // Navigation is default behavior for card click, keeping edit separate
                                        }}
                                        className="bg-black/80 hover:bg-orange-500 hover:text-black p-2 rounded-lg text-white backdrop-blur-sm transition-colors border border-zinc-800"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(product.id);
                                        }}
                                        className="bg-black/80 hover:bg-red-500 p-2 rounded-lg text-white backdrop-blur-sm transition-colors border border-zinc-800"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5">
                                <h3 className="text-lg font-bold mb-1 text-white truncate">{product.name}</h3>
                                <p className="text-orange-500 font-bold mb-4 font-mono text-sm">{Number(product.price).toLocaleString()} FCFA</p>

                                <div className="flex justify-between items-center">
                                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${product.stock > 10 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                        {product.stock > 0 ? `${product.stock} EN STOCK` : 'ÉPUISÉ'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* Empty State if no products */}
                    {products.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                            <ImageIcon className="mx-auto h-12 w-12 text-zinc-600 mb-4" />
                            <h3 className="text-lg font-medium text-white">Votre boutique est vide</h3>
                            <p className="text-zinc-500 mt-1 mb-6">Commencez par ajouter votre premier produit.</p>
                            <button
                                onClick={openCreateModal}
                                className="text-orange-500 hover:text-orange-400 font-bold text-sm uppercase tracking-wide border-b border-orange-500/30 hover:border-orange-500"
                            >
                                + Ajouter maintenant
                            </button>
                        </div>
                    )}
                </div>
            )}


            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 relative animate-in fade-in zoom-in duration-200 shadow-2xl shadow-black/50">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                            {editingId ? 'MODIFIER PRODUIT' : 'NOUVEAU PRODUIT'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Nom du Produit</label>
                                <input
                                    required
                                    type="text"
                                    value={productForm.name}
                                    onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none placeholder:text-zinc-700 transition-colors"
                                    placeholder="Ex: Robe rouge"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Prix (FCFA)</label>
                                    <input
                                        required
                                        type="number"
                                        value={productForm.price}
                                        onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none placeholder:text-zinc-700 font-mono"
                                        placeholder="5000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Qqté Stock</label>
                                    <input
                                        required
                                        type="number"
                                        value={productForm.stock}
                                        onChange={e => setProductForm({ ...productForm, stock: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none placeholder:text-zinc-700 font-mono"
                                        placeholder="10"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Description</label>
                                <textarea
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none h-24 placeholder:text-zinc-700 resize-none"
                                    placeholder="Détails du produit (matière, coupe, etc.)"
                                    value={productForm.description}
                                    onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Galerie</label>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    {productForm.images.map((img, idx) => (
                                        <div key={idx} className="relative h-20 rounded-lg overflow-hidden group border border-zinc-800">
                                            <img src={img} alt="Product" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setProductForm({
                                                    ...productForm,
                                                    images: productForm.images.filter((_, i) => i !== idx)
                                                })}
                                                className="absolute top-1 right-1 bg-red-500 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    <label
                                        htmlFor="file-upload"
                                        className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-zinc-800 hover:border-orange-500 rounded-lg cursor-pointer transition-all text-zinc-600 hover:text-orange-500 bg-black hover:bg-orange-500/5 group"
                                    >
                                        {uploading ? (
                                            <span className="animate-spin text-lg">⏳</span>
                                        ) : (
                                            <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                        )}
                                    </label>
                                </div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={async (e) => {
                                        if (!e.target.files) return;

                                        // CHECK: Maximum 5 photos per product
                                        const remainingSlots = 5 - productForm.images.length;
                                        if (remainingSlots <= 0) {
                                            alert('❌ Maximum 5 photos par produit. Supprimez une photo existante pour en ajouter une nouvelle.');
                                            return;
                                        }

                                        setUploading(true);
                                        try {
                                            const files = Array.from(e.target.files).slice(0, remainingSlots); // Limit to remaining slots
                                            const newImages: string[] = [];

                                            for (const file of files) {
                                                const fileExt = file.name.split('.').pop();
                                                const fileName = `${Math.random()}.${fileExt}`;
                                                const { error } = await supabase.storage
                                                    .from('product-images')
                                                    .upload(fileName, file);

                                                if (error) throw error;

                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('product-images')
                                                    .getPublicUrl(fileName);

                                                newImages.push(publicUrl);
                                            }

                                            setProductForm(prev => ({
                                                ...prev,
                                                images: [...prev.images, ...newImages]
                                            }));

                                            if (files.length < e.target.files.length) {
                                                alert(`✅ ${files.length} photo(s) ajoutée(s). Limite atteinte (5 max).`);
                                            }
                                        } catch (error) {
                                            console.error('Upload failed:', error);
                                            alert('Erreur lors de l\'upload des images (Vérifiez votre connexion Supabase)');
                                        } finally {
                                            setUploading(false);
                                        }
                                    }}
                                    className="hidden"
                                    id="file-upload"
                                />
                                <div className="mt-2">
                                    <input
                                        type="text"
                                        placeholder={productForm.images.length >= 5 ? "Limite atteinte (5 photos max)" : "Ou collez une URL d'image ici..."}
                                        disabled={productForm.images.length >= 5}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-400 focus:border-orange-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const val = e.currentTarget.value;
                                                if (val && productForm.images.length < 5) {
                                                    setProductForm(prev => ({ ...prev, images: [...prev.images, val] }));
                                                    e.currentTarget.value = '';
                                                } else if (productForm.images.length >= 5) {
                                                    alert('❌ Maximum 5 photos par produit atteint.');
                                                }
                                            }
                                        }}
                                    />
                                    <p className="text-[10px] text-zinc-600 mt-1">
                                        {productForm.images.length >= 5
                                            ? "🚫 Limite de 5 photos atteinte"
                                            : `Appuyez sur Entrée pour ajouter l'URL (${5 - productForm.images.length} restantes)`}
                                    </p>
                                </div>
                            </div>

                            {/* Section Déclinaisons */}
                            <div className="border-t border-zinc-800 pt-4 mt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <Tags size={16} className="text-orange-500" />
                                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Déclinaisons</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setProductForm({
                                            ...productForm,
                                            variations: [...productForm.variations, { name: '', options: [] }]
                                        })}
                                        className="text-xs text-orange-500 hover:text-orange-400 flex items-center gap-1"
                                    >
                                        <Plus size={14} />
                                        Ajouter
                                    </button>
                                </div>

                                {productForm.variations.length === 0 ? (
                                    <p className="text-zinc-600 text-xs">Optionnel: Taille, Couleur, Saveur...</p>
                                ) : (
                                    <div className="space-y-3">
                                        {productForm.variations.map((variation, varIdx) => (
                                            <div key={varIdx} className="bg-black border border-zinc-800 rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={variation.name}
                                                        onChange={(e) => {
                                                            const newVars = [...productForm.variations];
                                                            newVars[varIdx].name = e.target.value;
                                                            setProductForm({ ...productForm, variations: newVars });
                                                        }}
                                                        placeholder="Nom (ex: Taille)"
                                                        className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-sm focus:border-orange-500 outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setProductForm({
                                                                ...productForm,
                                                                variations: productForm.variations.filter((_, i) => i !== varIdx)
                                                            });
                                                        }}
                                                        className="text-red-500 hover:text-red-400 p-1"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>

                                                {/* Options */}
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {variation.options.map((opt, optIdx) => (
                                                        <span key={optIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded text-xs">
                                                            {opt.value}
                                                            {opt.priceModifier ? ` (${opt.priceModifier > 0 ? '+' : ''}${opt.priceModifier})` : ''}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newVars = [...productForm.variations];
                                                                    newVars[varIdx].options = newVars[varIdx].options.filter((_, i) => i !== optIdx);
                                                                    setProductForm({ ...productForm, variations: newVars });
                                                                }}
                                                                className="text-zinc-500 hover:text-red-500"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Add option input */}
                                                <input
                                                    type="text"
                                                    placeholder="Ajouter option (ex: XL) + Entrée"
                                                    className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-white text-xs focus:border-orange-500 outline-none"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = e.currentTarget.value.trim();
                                                            if (val) {
                                                                const newVars = [...productForm.variations];
                                                                newVars[varIdx].options = [...newVars[varIdx].options, { value: val, stock: undefined, priceModifier: 0 }];
                                                                setProductForm({ ...productForm, variations: newVars });
                                                                e.currentTarget.value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-white hover:bg-zinc-200 text-black font-bold uppercase tracking-wide py-3 rounded-lg transition-all mt-4"
                            >
                                {editingId ? 'Enregistrer modifications' : 'Créer le Produit'}
                            </button>
                        </form>
                    </div>
                </div >
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200 shadow-2xl shadow-red-900/10">
                        <div className="text-center">
                            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 className="text-red-500 w-6 h-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Confirmer la suppression</h3>
                            <p className="text-zinc-500 text-sm mb-6 leading-relaxed">
                                Êtes-vous sûr de vouloir supprimer ce produit ?<br />
                                Cette action est irréversible.
                            </p>
                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setIsDeleteModalOpen(false)}
                                    className="flex-1 py-3 rounded-lg border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-lg shadow-red-500/20"
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Products;
