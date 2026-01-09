
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, Image as ImageIcon, X, Plus, Tags } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getApiUrl } from '../utils/apiConfig';

// Option within a variation (with stock and price modifier)
interface VariationOption {
    value: string;          // e.g., "M", "XL", "Rouge"
    stock?: number;         // Stock for this option
    priceModifier?: number; // Price adjustment: +500, -200, 0
}

// Interface for product variations/déclinaisons
interface ProductVariation {
    name: string;               // e.g., "Taille", "Couleur", "Saveur"
    options: VariationOption[]; // Array of options with stock/price
}

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [product, setProduct] = useState<any>({
        name: '',
        price: '',
        stock: '',
        description: '',
        images: [],
        variations: [] as ProductVariation[]
    });

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    navigate('/login');
                    return;
                }

                const API_URL = getApiUrl();
                const res = await fetch(`${API_URL}/products`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!res.ok) {
                    console.error('Failed to fetch products');
                    navigate('/dashboard/products');
                    return;
                }

                const data = await res.json();
                const found = data.find((p: any) => p.id === id);
                if (found) {
                    setProduct({
                        ...found,
                        images: found.images || [],
                        variations: found.variations || []
                    });
                } else {
                    navigate('/dashboard/products');
                }
            } catch (error) {
                console.error('Failed to fetch product', error);
                navigate('/dashboard/products');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchProduct();
    }, [id, navigate]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('token');
            const API_URL = getApiUrl();
            const res = await fetch(`${API_URL}/products/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...product,
                    price: Number(product.price),
                    stock: Number(product.stock)
                })
            });
            if (res.ok) {
                alert('Produit mis à jour !');
            } else {
                alert('Erreur lors de la mise à jour');
            }
        } catch (error) {
            console.error('Error updating product', error);
            alert('Erreur lors de la mise à jour');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Voulez-vous vraiment supprimer ce produit ?')) return;
        try {
            const token = localStorage.getItem('token');
            const API_URL = getApiUrl();
            await fetch(`${API_URL}/products/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            navigate('/dashboard/products');
        } catch (error) {
            console.error('Error deleting product', error);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;

        const files = Array.from(e.target.files);
        const newImages = [];

        try {
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

            setProduct({
                ...product,
                images: [...product.images, ...newImages]
            });
        } catch (error) {
            console.error('Upload failed', error);
            alert('Erreur upload');
        }
    };

    // === Variation Management Functions ===
    const addVariation = () => {
        setProduct({
            ...product,
            variations: [...(product.variations || []), { name: '', options: [] }]
        });
    };

    const removeVariation = (index: number) => {
        setProduct({
            ...product,
            variations: product.variations.filter((_: ProductVariation, i: number) => i !== index)
        });
    };

    const updateVariationName = (index: number, name: string) => {
        const newVariations = [...product.variations];
        newVariations[index] = { ...newVariations[index], name };
        setProduct({ ...product, variations: newVariations });
    };

    const addVariationOption = (varIndex: number, value: string) => {
        if (!value.trim()) return;
        const newVariations = [...product.variations];
        const existingValues = newVariations[varIndex].options.map((o: VariationOption) => o.value);
        if (!existingValues.includes(value.trim())) {
            newVariations[varIndex] = {
                ...newVariations[varIndex],
                options: [...newVariations[varIndex].options, { value: value.trim(), stock: undefined, priceModifier: 0 }]
            };
            setProduct({ ...product, variations: newVariations });
        }
    };

    const removeVariationOption = (varIndex: number, optionIndex: number) => {
        const newVariations = [...product.variations];
        newVariations[varIndex] = {
            ...newVariations[varIndex],
            options: newVariations[varIndex].options.filter((_: VariationOption, i: number) => i !== optionIndex)
        };
        setProduct({ ...product, variations: newVariations });
    };

    const updateVariationOption = (varIndex: number, optionIndex: number, field: 'stock' | 'priceModifier', value: number | undefined) => {
        const newVariations = [...product.variations];
        newVariations[varIndex].options[optionIndex] = {
            ...newVariations[varIndex].options[optionIndex],
            [field]: value
        };
        setProduct({ ...product, variations: newVariations });
    };

    if (loading) return <div className="text-white p-8">Chargement...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/dashboard/products')}
                    className="flex items-center text-zinc-400 hover:text-white transition-colors"
                >
                    <ArrowLeft className="mr-2" size={20} />
                    Retour aux produits
                </button>
                <div className="flex space-x-3">
                    <button
                        onClick={handleDelete}
                        className="flex items-center px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                        <Trash2 size={18} className="mr-2" />
                        Supprimer
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-6 py-2 bg-orange-500 text-black font-semibold rounded-lg hover:bg-orange-400 transition-colors shadow-lg shadow-orange-500/20"
                    >
                        <Save size={18} className="mr-2" />
                        {saving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Left Column - Images */}
                <div className="md:col-span-1 space-y-4">
                    <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative group">
                        {product.images?.[0] ? (
                            <img
                                src={product.images[0]}
                                alt={product.name}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-zinc-600">
                                <ImageIcon size={48} />
                            </div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="cursor-pointer bg-white/10 backdrop-blur-md text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors">
                                Changer la couverture
                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {product.images?.slice(1).map((img: string, idx: number) => (
                            <div key={idx} className="aspect-square bg-zinc-900 rounded-lg overflow-hidden relative group">
                                <img src={img} alt="" className="w-full h-full object-cover" />
                                <button
                                    onClick={() => setProduct({
                                        ...product,
                                        images: product.images.filter((_: any, i: number) => i !== idx + 1)
                                    })}
                                    className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                        <label className="aspect-square bg-zinc-900/50 border-2 border-dashed border-zinc-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-orange-500 hover:bg-zinc-900 transition-all text-zinc-500 hover:text-white">
                            <Plus size={24} />
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageUpload} />
                        </label>
                    </div>
                </div>

                {/* Right Column - Details Form */}
                <div className="md:col-span-2 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Nom du produit</label>
                        <input
                            type="text"
                            value={product.name}
                            onChange={e => setProduct({ ...product, name: e.target.value })}
                            className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-orange-500 outline-none text-lg font-bold"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Prix (FCFA)</label>
                            <input
                                type="number"
                                value={product.price}
                                onChange={e => setProduct({ ...product, price: e.target.value })}
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-orange-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Stock disponible</label>
                            <input
                                type="number"
                                value={product.stock}
                                onChange={e => setProduct({ ...product, stock: e.target.value })}
                                className="w-full bg-black border border-zinc-700 rounded-xl p-3 text-white focus:border-orange-500 outline-none font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Description détaillée</label>
                        <textarea
                            value={product.description}
                            onChange={e => setProduct({ ...product, description: e.target.value })}
                            className="w-full bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-orange-500 outline-none min-h-[150px] leading-relaxed"
                            placeholder="Décrivez votre produit..."
                        />
                    </div>

                    {/* === Section Déclinaisons === */}
                    <div className="border-t border-zinc-800 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <Tags size={20} className="text-orange-500" />
                                <h3 className="text-white font-semibold">Déclinaisons / Variations</h3>
                            </div>
                            <button
                                type="button"
                                onClick={addVariation}
                                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/10 text-orange-500 rounded-lg hover:bg-orange-500/20 transition-colors text-sm"
                            >
                                <Plus size={16} />
                                Ajouter une déclinaison
                            </button>
                        </div>

                        <p className="text-zinc-500 text-sm mb-4">
                            Définissez des options comme Taille, Couleur, Saveur, etc. Ex: Taille → S, M, L, XL
                        </p>

                        {product.variations && product.variations.length > 0 ? (
                            <div className="space-y-4">
                                {product.variations.map((variation: ProductVariation, varIndex: number) => (
                                    <div key={varIndex} className="bg-black border border-zinc-800 rounded-xl p-4">
                                        <div className="flex items-center gap-3 mb-3">
                                            <input
                                                type="text"
                                                value={variation.name}
                                                onChange={(e) => updateVariationName(varIndex, e.target.value)}
                                                placeholder="Nom (ex: Taille, Couleur, Saveur)"
                                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 outline-none text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeVariation(varIndex)}
                                                className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Supprimer cette déclinaison"
                                            >
                                                <X size={18} />
                                            </button>
                                        </div>

                                        {/* Options with stock and price */}
                                        {variation.options && variation.options.length > 0 && (
                                            <div className="space-y-2 mb-3">
                                                <div className="grid grid-cols-12 gap-2 text-xs text-zinc-500 px-2">
                                                    <div className="col-span-4">Valeur</div>
                                                    <div className="col-span-3">Stock</div>
                                                    <div className="col-span-4">Prix (+/-)</div>
                                                    <div className="col-span-1"></div>
                                                </div>
                                                {variation.options.map((option: VariationOption, optIndex: number) => (
                                                    <div key={optIndex} className="grid grid-cols-12 gap-2 items-center bg-zinc-900/50 rounded-lg p-2">
                                                        <div className="col-span-4">
                                                            <span className="text-white text-sm font-medium">{option.value}</span>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <input
                                                                type="number"
                                                                value={option.stock ?? ''}
                                                                onChange={(e) => updateVariationOption(varIndex, optIndex, 'stock', e.target.value ? Number(e.target.value) : undefined)}
                                                                placeholder="∞"
                                                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm focus:border-orange-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="col-span-4 flex items-center">
                                                            <span className="text-zinc-500 text-xs mr-1">FCFA</span>
                                                            <input
                                                                type="number"
                                                                value={option.priceModifier ?? 0}
                                                                onChange={(e) => updateVariationOption(varIndex, optIndex, 'priceModifier', Number(e.target.value))}
                                                                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-white text-sm focus:border-orange-500 outline-none"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 flex justify-end">
                                                            <button
                                                                type="button"
                                                                onClick={() => removeVariationOption(varIndex, optIndex)}
                                                                className="text-zinc-500 hover:text-red-500 transition-colors p-1"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add new option input */}
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Ajouter une option (ex: XL, Rouge, Nutella)"
                                                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:border-orange-500 outline-none text-sm"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addVariationOption(varIndex, (e.target as HTMLInputElement).value);
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }}
                                            />
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    const input = (e.target as HTMLElement).closest('div')?.querySelector('input') as HTMLInputElement;
                                                    if (input) {
                                                        addVariationOption(varIndex, input.value);
                                                        input.value = '';
                                                    }
                                                }}
                                                className="px-3 py-2 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors text-sm"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-black border border-dashed border-zinc-800 rounded-xl">
                                <Tags size={32} className="mx-auto text-zinc-700 mb-2" />
                                <p className="text-zinc-500 text-sm">Aucune déclinaison définie</p>
                                <p className="text-zinc-600 text-xs mt-1">Cliquez sur "Ajouter une déclinaison" pour commencer</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductDetail;
