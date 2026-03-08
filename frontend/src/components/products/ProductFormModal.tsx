import { useState, useEffect } from 'react';
import { X, ImageIcon } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { getApiUrl } from '../../utils/apiConfig';
import type { Product, ProductVariation, VariationTemplate } from '../../types';
import ProductVariations from './ProductVariations';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    productToEdit?: Product;
    onSuccess: () => void;
    templates: VariationTemplate[];
}

interface ProductFormState {
    name: string;
    price: string;
    stock: string;
    description: string;
    images: string[];
    variations: ProductVariation[];
    aiInstructions: string;
    manageStock: boolean;
}

const INITIAL_STATE: ProductFormState = {
    name: '',
    price: '',
    stock: '',
    description: '',
    images: [],
    variations: [],
    aiInstructions: '',
    manageStock: true
};

export default function ProductFormModal({
    isOpen,
    onClose,
    productToEdit,
    onSuccess,
    templates
}: ProductFormModalProps) {
    const [form, setForm] = useState<ProductFormState>(INITIAL_STATE);
    const [uploading, setUploading] = useState(false);
    const [variationsEnabled, setVariationsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);
    const { token } = useAuth();

    useEffect(() => {
        if (isOpen) {
            if (productToEdit) {
                setForm({
                    name: productToEdit.name,
                    price: String(productToEdit.price),
                    stock: String(productToEdit.stock),
                    description: productToEdit.description || '',
                    images: productToEdit.images || [],
                    variations: productToEdit.variations || [],
                    aiInstructions: productToEdit.aiInstructions || '',
                    manageStock: productToEdit.manageStock ?? true
                });
                const hasActiveVars = productToEdit.variations && productToEdit.variations.some(v => v.name && v.options.length > 0);
                setVariationsEnabled(!!hasActiveVars);
            } else {
                setForm(INITIAL_STATE);
                setVariationsEnabled(false);
            }
        }
    }, [isOpen, productToEdit]);

    // Auto-calculate global stock when variations change
    useEffect(() => {
        if (variationsEnabled && form.variations.length > 0) {
            let totalStock = 0;
            form.variations.forEach(v => {
                v.options.forEach(opt => {
                    if (opt.stock) totalStock += opt.stock;
                });
            });
            if (form.stock !== totalStock.toString()) {
                setForm(prev => ({ ...prev, stock: totalStock.toString() }));
            }
        }
    }, [form.variations, variationsEnabled, form.stock]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                name: form.name,
                price: Number(form.price),
                stock: Number(form.stock),
                description: form.description,
                images: form.images,
                variations: variationsEnabled ? form.variations : [],
                aiInstructions: form.aiInstructions,
                manageStock: form.manageStock
            };

            const API_URL = getApiUrl();
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            };

            let response;
            if (productToEdit) {
                response = await fetch(`${API_URL}/products/${productToEdit.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(payload)
                });
            } else {
                response = await fetch(`${API_URL}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload)
                });
            }

            // AUTO-SAVE NEW TEMPLATES
            if (payload.variations && payload.variations.length > 0) {
                const uniqueNewTemplates = payload.variations
                    .filter(v => v.name && v.options.length > 0)
                    .filter(v => !templates.some(t => t.name.toLowerCase() === v.name.toLowerCase()));

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
                    } catch (e) {
                        console.warn('Failed to auto-save template', e);
                    }
                }
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erreur lors de la sauvegarde');
            }

            toast.success(productToEdit ? 'Produit modifié !' : 'Produit créé !');
            onSuccess();
            onClose();
        } catch (error: unknown) {
            console.error('Failed to save product', error);
            toast.error(error instanceof Error ? error.message : "Une erreur est survenue");
        } finally {
            setLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'variation', varIdx?: number, optIdx?: number) => {
        if (!e.target.files?.length) return;

        // Validation limits
        if (target === 'main') {
            const slots = 5 - form.images.length;
            if (slots <= 0) {
                toast.error('Maximum 5 photos par produit');
                return;
            }
        } else if (target === 'variation' && varIdx !== undefined && optIdx !== undefined) {
            const existing = form.variations[varIdx].options[optIdx].images || [];
            if (existing.length + e.target.files.length > 2) {
                toast.error('Maximum 2 images par déclinaison');
                return;
            }
        }

        setUploading(true);
        try {
            const files = Array.from(e.target.files);
            const newUrls: string[] = [];

            for (const file of files) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${target}-${Date.now()}-${Math.random()}.${fileExt}`;
                const { error } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, file);

                if (error) throw error;

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);
                newUrls.push(publicUrl);
            }

            if (target === 'main') {
                setForm(prev => ({
                    ...prev,
                    images: [...prev.images, ...newUrls].slice(0, 5) // ensure max 5
                }));
            } else if (varIdx !== undefined && optIdx !== undefined) {
                const newVars = [...form.variations];
                const opt = newVars[varIdx].options[optIdx];
                opt.images = [...(opt.images || []), ...newUrls];

                // Also add to main images if space
                const mainCount = form.images.length;
                const toAdd = newUrls.slice(0, 5 - mainCount);

                setForm(prev => ({
                    ...prev,
                    variations: newVars,
                    images: [...prev.images, ...toAdd]
                }));
            }
        } catch (error) {
            console.error('Upload failed', error);
            toast.error('Erreur upload');
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#0a0c10] border border-white/5 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 relative shadow-2xl shadow-indigo-500/10">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full"></div>
                    {productToEdit ? 'MODIFIER PRODUIT' : 'NOUVEAU PRODUIT'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Nom du Produit</label>
                        <input
                            required
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 transition-colors"
                            placeholder="Ex: Robe rouge"
                        />
                    </div>

                    {/* Price & Stock */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Prix (FCFA)</label>
                            <input
                                required
                                type="number"
                                value={form.price}
                                onChange={e => setForm({ ...form, price: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 font-mono"
                                placeholder="5000"
                            />
                        </div>
                        <div className="bg-black/30 p-2 rounded border border-white/5">
                            <div className="flex justify-between items-center mb-1.5">
                                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                                    Stock {variationsEnabled && <span className="text-indigo-400 text-[10px] ml-1">(Auto)</span>}
                                </label>

                                {/* Switch Stock Mode */}
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, manageStock: !form.manageStock })}
                                    className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer group"
                                    title={form.manageStock ? "Mode Strict" : "Mode Flexible"}
                                >
                                    <span className={`text-[9px] font-bold uppercase ${form.manageStock ? 'text-zinc-400 group-hover:text-white' : 'text-indigo-400'}`}>
                                        {form.manageStock ? 'STRICT' : 'FLEXIBLE'}
                                    </span>
                                    <div className={`w-6 h-3 rounded-full relative transition-colors ${form.manageStock ? 'bg-white/20' : 'bg-indigo-500'}`}>
                                        <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-transform ${form.manageStock ? 'left-0.5' : 'left-3.5'}`}></div>
                                    </div>
                                </button>
                            </div>
                            <input
                                required
                                type="number"
                                min="0"
                                disabled={variationsEnabled}
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: Math.max(0, Number(e.target.value) || 0).toString() })}
                                className={`w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 font-mono ${variationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="10"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Description</label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none h-20 placeholder:text-zinc-600 resize-none"
                            placeholder="Détails du produit..."
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    {/* IA Instructions */}
                    <div className="border-t border-white/5 pt-3 mt-2">
                        <label className="block text-xs font-semibold text-purple-400 mb-2 uppercase tracking-wide">
                            🤖 Consignes IA
                        </label>
                        <textarea
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none h-20 placeholder:text-zinc-600 resize-none text-sm"
                            placeholder="Ex: Si le client prend 3+, proposer -10%..."
                            value={form.aiInstructions}
                            onChange={e => setForm({ ...form, aiInstructions: e.target.value })}
                        />
                    </div>

                    {/* Images */}
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Galerie</label>
                        <div className="grid grid-cols-3 gap-2 mb-2">
                            {form.images.map((img, idx) => (
                                <div key={idx} className="relative h-20 rounded-lg overflow-hidden group border border-white/10">
                                    <img src={img} alt="Product" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setForm({
                                            ...form,
                                            images: form.images.filter((_, i) => i !== idx)
                                        })}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                            <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-white/10 hover:border-indigo-500 rounded-lg cursor-pointer transition-all text-zinc-500 hover:text-indigo-400 bg-black/20 hover:bg-indigo-500/5 group">
                                {uploading ? <span className="animate-spin text-lg">⏳</span> : <ImageIcon className="w-5 h-5 group-hover:scale-110 transition-transform" />}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => handleUpload(e, 'main')}
                                />
                            </label>
                        </div>
                    </div>

                    {/* Variations */}
                    <ProductVariations
                        variations={form.variations}
                        onChange={(vars) => setForm({ ...form, variations: vars })}
                        onUploadImage={(e, vIdx, oIdx) => handleUpload(e, 'variation', vIdx, oIdx)}
                        uploading={uploading}
                        templates={templates}
                        enabled={variationsEnabled}
                        setEnabled={setVariationsEnabled}
                    />

                    {/* Submit */}
                    <div className="sticky bottom-0 bg-[#0a0c10] border-t border-white/5 pt-4 pb-2 z-10 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 rounded-lg font-bold bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading || uploading}
                            className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-lg font-bold hover:shadow-lg hover:shadow-indigo-500/25 transition-all text-sm uppercase tracking-wide disabled:opacity-50"
                        >
                            {loading ? 'Sauvegarde...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
