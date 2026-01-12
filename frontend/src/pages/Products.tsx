
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
    images?: string[];
}

interface ProductVariation {
    name: string;
    options: VariationOption[];
    isCustom?: boolean; // UI flag for custom name input
}

interface Product {
    id: string;
    name: string;
    price: string | number;
    stock: number;
    description?: string;
    images: string[];
    variations?: ProductVariation[];
    aiInstructions?: string;
    ai_instructions?: string;
    manageStock?: boolean;
}

interface VariationTemplate {
    name: string;
    default_options: { value: string; priceModifier: number }[];
    isSystem: boolean;
}

const Products: React.FC = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState<Product[]>([]);
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
        variations: [] as ProductVariation[],
        aiInstructions: '',
        manageStock: true
    });
    const [uploading, setUploading] = useState(false);
    const [variationsEnabled, setVariationsEnabled] = useState(false);
    const [variationTemplates, setVariationTemplates] = useState<VariationTemplate[]>([]);

    // New Option Inputs State (per variation index)
    const [newOptionInputs, setNewOptionInputs] = useState<Record<number, { name: string; price: string; stock: string }>>({});

    const handleAddOption = (varIdx: number) => {
        const inputs = newOptionInputs[varIdx];
        if (!inputs || !inputs.name.trim()) return;

        const newVars = [...productForm.variations];
        newVars[varIdx].options = [
            ...newVars[varIdx].options,
            {
                value: inputs.name.trim(),
                priceModifier: inputs.price ? Number(inputs.price) : 0,
                stock: inputs.stock ? Number(inputs.stock) : undefined
            }
        ];
        setProductForm({ ...productForm, variations: newVars });

        // Reset inputs
        setNewOptionInputs(prev => ({
            ...prev,
            [varIdx]: { name: '', price: '', stock: '' }
        }));
    };

    // Auto-calculate global stock when variations change
    useEffect(() => {
        if (variationsEnabled && productForm.variations.length > 0) {
            let totalStock = 0;
            productForm.variations.forEach(v => {
                v.options.forEach(opt => {
                    if (opt.stock) totalStock += opt.stock;
                });
            });
            // Only update if different to avoid infinite loops if strictly checked, though React state checks usually handle equality.
            if (productForm.stock !== totalStock.toString()) {
                setProductForm(prev => ({ ...prev, stock: totalStock.toString() }));
            }
        }
    }, [productForm.variations, variationsEnabled, productForm.stock]);

    // Fetch Variation Templates
    const fetchVariationTemplates = async () => {
        try {
            const token = localStorage.getItem('token');
            const API_URL = getApiUrl();
            const res = await fetch(`${API_URL}/variation-templates`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data: VariationTemplate[] = await res.json();
                setVariationTemplates(data);
            }
        } catch (error) {
            console.error('Failed to fetch variation templates', error);
        }
    };

    useEffect(() => {
        fetchVariationTemplates();
    }, []);

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

    // Variation Image Upload Handler
    const handleVariationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, varIdx: number, optIdx: number) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        // Check local limit for this option
        const currentOptionImages = productForm.variations[varIdx].options[optIdx].images || [];
        if (currentOptionImages.length + files.length > 2) {
            alert('Maximum 2 images par déclinaison');
            return;
        }

        setUploading(true);
        try {
            const newImages: string[] = [];
            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `var-${Date.now()}-${Math.random()}.${fileExt}`;
                const { error } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                newImages.push(publicUrl);
            }

            // Update form state
            const newVars = [...productForm.variations];
            const targetOption = newVars[varIdx].options[optIdx];
            targetOption.images = [...(targetOption.images || []), ...newImages];

            // Also add to main product images (if not exceeding 5)
            let newMainImages = [...productForm.images];
            const remainingMainSlots = 5 - newMainImages.length;
            if (remainingMainSlots > 0) {
                newMainImages = [...newMainImages, ...newImages.slice(0, remainingMainSlots)];
            }

            setProductForm(prev => ({
                ...prev,
                variations: newVars,
                images: newMainImages
            }));

        } catch (error) {
            console.error('Upload failed', error);
            alert('Erreur upload');
        } finally {
            setUploading(false);
        }
    };

    // Open Modal for Create
    const openCreateModal = () => {
        setEditingId(null);
        setProductForm({ name: '', price: '', stock: '', description: '', images: [], variations: [], aiInstructions: '', manageStock: true });
        setVariationsEnabled(false);
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const openEditModal = (product: Product) => {
        setEditingId(product.id);
        setProductForm({
            name: product.name,
            price: String(product.price),
            stock: String(product.stock),
            description: product.description || '',
            images: product.images || [],
            variations: product.variations || [],
            aiInstructions: product.aiInstructions || product.ai_instructions || '',
            manageStock: product.manageStock ?? true
        });
        // Enable variations toggle if product has active variations
        const hasActiveVariations = product.variations && product.variations.some((v: ProductVariation) =>
            v.name && v.options && v.options.length > 0
        );
        setVariationsEnabled(!!hasActiveVariations);
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
                variations: productForm.variations,
                aiInstructions: productForm.aiInstructions,
                manageStock: productForm.manageStock
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

            // AUTO-SAVE CUSTOM VARIATION TEMPLATES
            // Check if any used variation name is NOT in current templates, then save it.
            if (payload.variations && payload.variations.length > 0) {
                const uniqueNewTemplates = payload.variations
                    .filter(v => v.name && v.options.length > 0)
                    .filter(v => !variationTemplates.some(t => t.name.toLowerCase() === v.name.toLowerCase()));

                for (const newVar of uniqueNewTemplates) {
                    try {
                        const templatePayload = {
                            name: newVar.name,
                            default_options: newVar.options.map(o => ({ value: o.value, priceModifier: 0 }))
                        };
                        await fetch(`${API_URL}/variation-templates`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(templatePayload)
                        });
                        console.log(`Auto-saved new variation template: ${newVar.name}`);
                    } catch (e) {
                        console.warn('Failed to auto-save template', e);
                    }
                }
                // Refresh templates for next time
                fetchVariationTemplates();
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erreur lors de la sauvegarde');
            }

            setIsModalOpen(false);
            fetchProducts();
        } catch (error: unknown) {
            console.error('Failed to save product', error);
            const msg = error instanceof Error ? error.message : "Une erreur est survenue";
            alert(`Erreur: ${msg}`);
        }
    };

    return (
        <div className="space-y-6 relative animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Inventaire</h1>
                    <p className="text-zinc-400">Gérez vos produits en vente sur WhatsApp</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white px-6 py-3 rounded-lg font-bold flex items-center space-x-2 transition-all hover:scale-[1.02]"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {products.map((product) => (
                        <div
                            key={product.id}
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
                                            openEditModal(product);
                                        }}
                                        className="bg-black/60 hover:bg-indigo-500 hover:text-white p-2 rounded-lg text-white backdrop-blur-md transition-colors border border-white/10"
                                    >
                                        <Edit size={16} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(product.id);
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
                                    {(() => {
                                        // Calculer le stock selon si le produit a des variations ACTIVES ou non
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

                                        return (
                                            <>
                                                <div className="flex flex-wrap gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider flex items-center ${displayStock > 10 ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                                                        {displayStock > 0 ? `${displayStock} STOCK` : 'ÉPUISÉ'}
                                                        {hasActiveVariations && <span className="ml-1 opacity-60 text-[9px] lowercase">(var.)</span>}
                                                    </span>

                                                    {/* Badge Mode Stock (Clean & Sans Emoji) */}
                                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider flex items-center border cursor-pointer hover:opacity-80 transition-opacity ${!product.manageStock ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 'bg-white/5 text-zinc-400 border-white/10'}`}
                                                        title={!product.manageStock ? "Vente illimitée autorisée" : "Vente bloquée si épuisé"}
                                                    >
                                                        {!product.manageStock ? 'FLEXIBLE' : 'STRICT'}
                                                    </span>
                                                </div>

                                                {/* Quick Stock Actions - Désactivé pour les produits avec variations */}
                                                {!hasActiveVariations && product.manageStock !== false && (
                                                    <div className="flex items-center bg-black rounded border border-zinc-800 w-fit mt-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={async () => {
                                                                const newStock = Math.max(0, product.stock - 1);
                                                                setProducts(products.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
                                                                const API_URL = getApiUrl();
                                                                const token = localStorage.getItem('token');
                                                                await fetch(`${API_URL}/products/${product.id}`, {
                                                                    method: 'PUT',
                                                                    headers: {
                                                                        'Content-Type': 'application/json',
                                                                        'Authorization': `Bearer ${token}`
                                                                    },
                                                                    body: JSON.stringify({ stock: newStock })
                                                                });
                                                            }}
                                                            className="px-2 py-0.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors text-xs"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="text-xs font-mono font-bold w-6 text-center text-white">{product.stock}</span>
                                                        <button
                                                            onClick={async () => {
                                                                const newStock = product.stock + 1;
                                                                setProducts(products.map(p => p.id === product.id ? { ...p, stock: newStock } : p));
                                                                const API_URL = getApiUrl();
                                                                const token = localStorage.getItem('token');
                                                                await fetch(`${API_URL}/products/${product.id}`, {
                                                                    method: 'PUT',
                                                                    headers: {
                                                                        'Content-Type': 'application/json',
                                                                        'Authorization': `Bearer ${token}`
                                                                    },
                                                                    body: JSON.stringify({ stock: newStock })
                                                                });
                                                            }}
                                                            className="px-2 py-0.5 text-zinc-500 hover:text-white hover:bg-white/10 transition-colors text-xs"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {/* Empty State if no products */}
                    {products.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-2xl bg-white/5">
                            <ImageIcon className="mx-auto h-12 w-12 text-zinc-600 mb-4" />
                            <h3 className="text-lg font-medium text-white">Votre boutique est vide</h3>
                            <p className="text-zinc-500 mt-1 mb-6">Commencez par ajouter votre premier produit.</p>
                            <button
                                onClick={openCreateModal}
                                className="text-indigo-400 hover:text-indigo-300 font-bold text-sm uppercase tracking-wide border-b border-indigo-500/30 hover:border-indigo-500"
                            >
                                + Ajouter maintenant
                            </button>
                        </div>
                    )}
                </div>
            )}


            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md">
                    <div className="bg-[#0a0c10] border border-white/5 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative animate-in fade-in zoom-in duration-200 shadow-2xl shadow-indigo-500/10">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                            {editingId ? 'MODIFIER PRODUIT' : 'NOUVEAU PRODUIT'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Nom du Produit</label>
                                <input
                                    required
                                    type="text"
                                    value={productForm.name}
                                    onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-gray-600 transition-colors"
                                    placeholder="Ex: Robe rouge"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Prix (FCFA)</label>
                                    <input
                                        required
                                        type="number"
                                        value={productForm.price}
                                        onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-gray-600 font-mono"
                                        placeholder="5000"
                                    />
                                </div>
                                <div className="bg-black/30 p-2 rounded border border-white/5">
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                            Stock {variationsEnabled && <span className="text-indigo-400 text-[10px] ml-1">(Auto)</span>}
                                        </label>

                                        {/* BOUTON SWITCH STOCK BIEN VISIBLE */}
                                        <button
                                            type="button"
                                            onClick={() => setProductForm({ ...productForm, manageStock: !productForm.manageStock })}
                                            className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
                                            title={productForm.manageStock ? "Mode Strict: Vente bloquée si stock épuisé" : "Mode Flexible: Vente autorisée même si stock épuisé"}
                                        >
                                            <span className={`text-[9px] font-bold uppercase ${productForm.manageStock ? 'text-zinc-400 group-hover:text-white' : 'text-indigo-400'}`}>
                                                {productForm.manageStock ? 'STRICT' : 'FLEXIBLE'}
                                            </span>
                                            <div className={`w-6 h-3 rounded-full relative transition-colors ${productForm.manageStock ? 'bg-white/20' : 'bg-indigo-500'}`}>
                                                <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform ${productForm.manageStock ? 'left-0.5' : 'left-3.5'}`}></div>
                                            </div>
                                        </button>
                                    </div>
                                    <input
                                        required
                                        type="number"
                                        min="0"
                                        disabled={variationsEnabled}
                                        value={productForm.stock}
                                        onChange={e => setProductForm({ ...productForm, stock: Math.max(0, Number(e.target.value) || 0).toString() })}
                                        className={`w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-gray-600 font-mono ${variationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        placeholder="10"
                                        title={variationsEnabled ? "Calculé automatiquement via les déclinaisons" : "Stock global"}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Description</label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none h-20 placeholder:text-gray-600 resize-none"
                                    placeholder="Détails du produit (matière, coupe, etc.)"
                                    value={productForm.description}
                                    onChange={e => setProductForm({ ...productForm, description: e.target.value })}
                                />
                            </div>

                            {/* Consignes IA */}
                            <div className="border-t border-white/5 pt-3 mt-2">
                                <label className="block text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wide">
                                    🤖 Consignes IA
                                </label>
                                <textarea
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none h-20 placeholder:text-gray-600 resize-none text-sm"
                                    placeholder="Ex: Si le client prend 3+, proposer -10%. À partir de 5, livraison offerte."
                                    value={productForm.aiInstructions}
                                    onChange={e => setProductForm({ ...productForm, aiInstructions: e.target.value })}
                                />
                                <p className="text-[10px] text-zinc-600 mt-1">
                                    L'IA appliquera ces instructions lors des conversations avec les clients.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Galerie</label>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    {productForm.images.map((img, idx) => (
                                        <div key={idx} className="relative h-20 rounded-lg overflow-hidden group border border-white/10">
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
                                        className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/10 hover:border-indigo-500 rounded-lg cursor-pointer transition-all text-zinc-500 hover:text-indigo-400 bg-black/20 hover:bg-indigo-500/5 group"
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
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-gray-400 focus:border-indigo-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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

                            {/* Section Déclinaisons avec Toggle */}
                            <div className="border-t border-white/5 pt-4 mt-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <Tags size={16} className="text-indigo-500" />
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Déclinaisons</span>

                                        {/* Toggle Switch */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newState = !variationsEnabled;
                                                setVariationsEnabled(newState);
                                                if (!newState) {
                                                    setProductForm({ ...productForm, variations: [] });
                                                }
                                            }}
                                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${variationsEnabled ? 'bg-indigo-500' : 'bg-gray-700'}`}
                                        >
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${variationsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </button>
                                        <span className={`text-[10px] ${variationsEnabled ? 'text-indigo-400' : 'text-gray-600'}`}>
                                            {variationsEnabled ? 'ON' : 'OFF'}
                                        </span>
                                    </div>

                                    {variationsEnabled && (
                                        <button
                                            type="button"
                                            onClick={() => setProductForm({
                                                ...productForm,
                                                variations: [...productForm.variations, { name: '', options: [] }]
                                            })}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                        >
                                            <Plus size={14} />
                                            Ajouter
                                        </button>
                                    )}
                                </div>

                                <p className="text-zinc-600 text-[10px] mb-3">
                                    {variationsEnabled
                                        ? 'Définissez les options (Taille, Couleur...). Le stock sera géré par variation.'
                                        : 'Activez si votre produit a des tailles, couleurs, saveurs...'
                                    }
                                </p>

                                {!variationsEnabled ? null : productForm.variations.length === 0 ? (
                                    <p className="text-zinc-500 text-xs py-2 text-center border border-dashed border-white/5 rounded-lg">Cliquez sur "Ajouter" pour créer une déclinaison</p>
                                ) : (
                                    <div className="space-y-3">
                                        {productForm.variations.map((variation, varIdx) => (
                                            <div key={varIdx} className="bg-black/40 border border-white/5 rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    {variation.isCustom ? (
                                                        <div className="flex-1 flex gap-2">
                                                            <input
                                                                autoFocus
                                                                type="text"
                                                                placeholder="Nom (ex: Motif)"
                                                                value={variation.name}
                                                                onChange={(e) => {
                                                                    const newVars = [...productForm.variations];
                                                                    newVars[varIdx].name = e.target.value;
                                                                    setProductForm({ ...productForm, variations: newVars });
                                                                }}
                                                                className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newVars = [...productForm.variations];
                                                                    // If empty, removing the card logic might fit here but let's just keep as is
                                                                    newVars[varIdx].isCustom = false;
                                                                    setProductForm({ ...productForm, variations: newVars });
                                                                }}
                                                                className="text-gray-500 hover:text-white"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <select
                                                            value={variation.name}
                                                            onChange={(e) => {
                                                                const val = e.target.value;
                                                                const newVars = [...productForm.variations];
                                                                if (val === 'custom') {
                                                                    newVars[varIdx].name = '';
                                                                    newVars[varIdx].isCustom = true;
                                                                } else {
                                                                    newVars[varIdx].name = val;
                                                                    // Pre-fill options if template exists
                                                                    const tmpl = variationTemplates.find(t => t.name === val);
                                                                    if (tmpl && newVars[varIdx].options.length === 0) {
                                                                        newVars[varIdx].options = tmpl.default_options.map(o => ({
                                                                            value: o.value,
                                                                            priceModifier: 0,
                                                                            stock: 0
                                                                        }));
                                                                    }
                                                                }
                                                                setProductForm({ ...productForm, variations: newVars });
                                                            }}
                                                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none"
                                                        >
                                                            <option value="" disabled>Choisir un type (Taille, Couleur...)</option>
                                                            {variationTemplates.map(t => (
                                                                <option key={t.name} value={t.name} className="text-black">{t.name}</option>
                                                            ))}
                                                            <option value="custom" className="text-indigo-400 font-semibold">+ Nouveau Type</option>
                                                        </select>
                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newVars = productForm.variations.filter((_, i) => i !== varIdx);
                                                            setProductForm({ ...productForm, variations: newVars });
                                                        }}
                                                        className="text-red-500 hover:text-red-400 p-1"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>

                                                {/* Options List */}
                                                <div className="space-y-2 pl-2 border-l-2 border-white/5">
                                                    {variation.options.map((option, optIdx) => (
                                                        <div key={optIdx} className="flex flex-wrap items-center gap-2 text-sm bg-white/5 rounded p-2">
                                                            <span className="font-bold text-white w-16 truncate">{option.value}</span>
                                                            <input
                                                                type="text"
                                                                placeholder="Stock"
                                                                value={option.stock ?? ''}
                                                                onChange={(e) => {
                                                                    const val = Number(e.target.value);
                                                                    const newVars = [...productForm.variations];
                                                                    newVars[varIdx].options[optIdx].stock = isNaN(val) ? 0 : val;
                                                                    setProductForm({ ...productForm, variations: newVars });
                                                                }}
                                                                className="w-16 bg-black border border-white/10 rounded px-2 py-1 text-white text-xs outline-none focus:border-indigo-500"
                                                            />
                                                            <label htmlFor={`file-upload-${varIdx}-${optIdx}`} className="cursor-pointer text-gray-400 hover:text-indigo-400">
                                                                <ImageIcon size={14} />
                                                                <input
                                                                    id={`file-upload-${varIdx}-${optIdx}`}
                                                                    type="file"
                                                                    multiple
                                                                    className="hidden"
                                                                    onChange={(e) => handleVariationImageUpload(e, varIdx, optIdx)}
                                                                />
                                                            </label>
                                                            {(option.images?.length || 0) > 0 && <span className="text-[10px] text-green-500">({option.images?.length} img)</span>}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newVars = [...productForm.variations];
                                                                    newVars[varIdx].options = newVars[varIdx].options.filter((_, i) => i !== optIdx);
                                                                    setProductForm({ ...productForm, variations: newVars });
                                                                }}
                                                                className="ml-auto text-gray-500 hover:text-red-400"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}

                                                    {/* Add Option Input */}
                                                    <div className="flex gap-2 items-center mt-2">
                                                        <input
                                                            type="text"
                                                            placeholder="Nouvelle option (ex: XL)"
                                                            value={newOptionInputs[varIdx]?.name || ''}
                                                            onChange={(e) => setNewOptionInputs({
                                                                ...newOptionInputs,
                                                                [varIdx]: { ...newOptionInputs[varIdx], name: e.target.value }
                                                            })}
                                                            className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 outline-none"
                                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption(varIdx))}
                                                        />
                                                        <input
                                                            type="number"
                                                            placeholder="Stock"
                                                            value={newOptionInputs[varIdx]?.stock || ''}
                                                            onChange={(e) => setNewOptionInputs({
                                                                ...newOptionInputs,
                                                                [varIdx]: { ...newOptionInputs[varIdx], stock: e.target.value }
                                                            })}
                                                            className="w-16 bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white placeholder-zinc-600 focus:border-indigo-500 outline-none"
                                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption(varIdx))}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAddOption(varIdx)}
                                                            className="bg-white/10 hover:bg-indigo-500 hover:text-white text-zinc-400 rounded-lg p-1.5 transition-colors"
                                                        >
                                                            <Plus size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                {editingId ? 'Mettre à jour' : 'Créer Produit'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md">
                    <div className="bg-[#0a0c10] border border-white/10 rounded-xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Supprimer le produit ?</h3>
                        <p className="text-zinc-400 text-sm mb-6">Cette action est irréversible. Le produit sera retiré de la vente.</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="px-4 py-2 text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 rounded-lg transition-all text-sm font-bold"
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Products;
