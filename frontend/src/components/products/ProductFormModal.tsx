import { useState, useEffect } from 'react';
import { X, Camera, Loader2, Plus } from 'lucide-react';
import { apiClient } from '../../utils/apiClient';
import type { Product, ProductVariation, VariationTemplate } from '../../types';
import ProductVariations from './ProductVariations';
import { toast } from 'react-hot-toast';


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
    const [aiAnalyzing, setAiAnalyzing] = useState(false);
    const [variationsEnabled, setVariationsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);


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

            let response;
            if (productToEdit) {
                response = await apiClient(`/products/${productToEdit.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                response = await apiClient('/products', {
                    method: 'POST',
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
                        await apiClient('/variation-templates', {
                            method: 'POST',
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

    // Analyse IA de la photo → pré-remplit nom + description (non bloquant)
    const analyzePhotoAndPrefill = async (file: File) => {
        setAiAnalyzing(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient('/ai/analyze-product-photo', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) return;
            const suggestion = await res.json();
            if (suggestion.name || suggestion.description) {
                setForm(prev => ({
                    ...prev,
                    name: prev.name.trim() ? prev.name : (suggestion.name || prev.name),
                    description: prev.description.trim() ? prev.description : (suggestion.description || prev.description),
                }));
                toast.success('✨ Nom et description proposés par l\'IA — vérifiez et ajustez !');
            }
        } catch {
            // Silencieux : la suggestion IA est un bonus, jamais bloquante
        } finally {
            setAiAnalyzing(false);
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
                const formData = new FormData();
                formData.append('file', file);

                const response = await apiClient('/products/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Erreur lors du téléversement');
                }

                const data = await response.json();
                newUrls.push(data.url);
            }

            // PHOTO D'ABORD : si le nom est vide, l'IA propose nom + description
            // à partir de la première photo (le vendeur n'a plus qu'à mettre le prix)
            if (target === 'main' && !form.name.trim() && files[0]) {
                analyzePhotoAndPrefill(files[0]);
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
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111] border-t sm:border border-[#1a1a1a] w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl shadow-black/40 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 ease-out"
            >
                {/* Poignée + en-tête, collés en haut */}
                <div className="sticky top-0 z-20 bg-[#111]/95 backdrop-blur-sm px-5 pt-3 pb-3 border-b border-[#1a1a1a]">
                    <div className="sm:hidden mx-auto mb-3 w-10 h-1.5 rounded-full bg-[#333]" />
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-white">
                            {productToEdit ? 'Modifier le produit' : 'Nouveau produit'}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Fermer"
                            className="w-9 h-9 grid place-items-center rounded-full text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="px-5 py-5 space-y-6">
                    {/* PHOTOS — en premier, le geste le plus naturel. Déclenche le pré-remplissage IA. */}
                    <div>
                        {form.images.length === 0 ? (
                            <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-[#00D97E]/40 rounded-2xl cursor-pointer bg-[#00D97E]/[0.06] hover:bg-[#00D97E]/10 text-[#00D97E] transition-colors active:scale-[0.99]">
                                {uploading || aiAnalyzing ? (
                                    <>
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                        <span className="text-sm font-semibold mt-3">{aiAnalyzing ? 'L\'IA analyse la photo…' : 'Envoi de la photo…'}</span>
                                    </>
                                ) : (
                                    <>
                                        <Camera className="w-9 h-9" strokeWidth={1.75} />
                                        <span className="text-[15px] font-bold mt-2">Ajouter une photo</span>
                                        {!productToEdit && <span className="text-[12px] text-[#888] mt-1 px-4 text-center">L'IA remplit le nom et la description pour vous</span>}
                                    </>
                                )}
                                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e, 'main')} />
                            </label>
                        ) : (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-white">Photos ({form.images.length}/5)</span>
                                    {aiAnalyzing && <span className="text-xs text-[#00D97E] flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Analyse IA…</span>}
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {form.images.map((img, idx) => (
                                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-[#1a1a1a]">
                                            <img src={img} alt="Produit" className="w-full h-full object-cover" />
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, images: form.images.filter((_, i) => i !== idx) })}
                                                aria-label="Retirer la photo"
                                                className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center bg-black/60 backdrop-blur-md text-white rounded-full active:scale-90 hover:bg-red-500 transition-[transform,background-color]"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {form.images.length < 5 && (
                                        <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed border-[#1a1a1a] rounded-xl cursor-pointer text-[#888] hover:text-[#00D97E] hover:border-[#00D97E]/40 transition-colors active:scale-[0.98]">
                                            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-6 h-6" />}
                                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleUpload(e, 'main')} />
                                        </label>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Nom */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Nom du produit</label>
                        <input
                            required
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            className="w-full bg-black border border-[#1a1a1a] rounded-xl h-12 px-4 text-white focus:border-[#00D97E]/50 outline-none placeholder:text-[#555] transition-colors"
                            placeholder="Ex : Robe wax fleurie"
                        />
                    </div>

                    {/* Prix & Stock */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">Prix (FCFA)</label>
                            <input
                                required
                                type="number"
                                inputMode="numeric"
                                value={form.price}
                                onChange={e => setForm({ ...form, price: e.target.value })}
                                className="w-full bg-black border border-[#1a1a1a] rounded-xl h-12 px-4 text-white focus:border-[#00D97E]/50 outline-none placeholder:text-[#555] font-mono transition-colors"
                                placeholder="5000"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-white mb-2">
                                Stock {variationsEnabled && <span className="text-[#00D97E] text-xs font-normal">(auto)</span>}
                            </label>
                            <input
                                required
                                type="number"
                                inputMode="numeric"
                                min="0"
                                disabled={variationsEnabled}
                                value={form.stock}
                                onChange={e => setForm({ ...form, stock: Math.max(0, Number(e.target.value) || 0).toString() })}
                                className={`w-full bg-black border border-[#1a1a1a] rounded-xl h-12 px-4 text-white focus:border-[#00D97E]/50 outline-none placeholder:text-[#555] font-mono transition-colors ${variationsEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                placeholder="10"
                            />
                        </div>
                    </div>

                    {/* Bloquer la vente si épuisé (ex "STRICT/FLEXIBLE") */}
                    <button
                        type="button"
                        onClick={() => setForm({ ...form, manageStock: !form.manageStock })}
                        className="flex items-center justify-between w-full text-left bg-black border border-[#1a1a1a] rounded-xl p-4 active:scale-[0.99] transition-transform"
                    >
                        <div className="pr-3">
                            <div className="text-white text-sm font-medium">Bloquer la vente si épuisé</div>
                            <div className="text-[#888] text-xs mt-0.5">
                                {form.manageStock ? 'Le bot arrête de vendre à 0 en stock' : 'Vente illimitée, le stock n\'est pas suivi'}
                            </div>
                        </div>
                        <div className={`shrink-0 w-12 h-7 rounded-full relative transition-colors ${form.manageStock ? 'bg-[#00D97E]' : 'bg-[#2a2a2a]'}`}>
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-200 ${form.manageStock ? 'left-6' : 'left-1'}`} />
                        </div>
                    </button>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-2">Description <span className="text-[#555] font-normal text-xs">(optionnel)</span></label>
                        <textarea
                            className="w-full bg-black border border-[#1a1a1a] rounded-xl p-4 text-white focus:border-[#00D97E]/50 outline-none h-20 placeholder:text-[#555] resize-none transition-colors"
                            placeholder="Détails du produit…"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    {/* Consignes IA */}
                    <div>
                        <label className="block text-sm font-medium text-[#00D97E] mb-2">🤖 Consignes pour le bot</label>
                        <textarea
                            className="w-full bg-black border border-[#1a1a1a] rounded-xl p-4 text-white focus:border-[#00D97E]/50 outline-none h-20 placeholder:text-[#555] resize-none text-sm transition-colors"
                            placeholder="Ex : si le client prend 3 ou plus, propose -10 %"
                            value={form.aiInstructions}
                            onChange={e => setForm({ ...form, aiInstructions: e.target.value })}
                        />
                    </div>

                    {/* Déclinaisons */}
                    <ProductVariations
                        variations={form.variations}
                        onChange={(vars) => setForm({ ...form, variations: vars })}
                        onUploadImage={(e, vIdx, oIdx) => handleUpload(e, 'variation', vIdx, oIdx)}
                        uploading={uploading}
                        templates={templates}
                        enabled={variationsEnabled}
                        setEnabled={setVariationsEnabled}
                    />

                    {/* Barre d'action collée en bas */}
                    <div className="sticky bottom-0 -mx-5 px-5 pt-4 pb-5 bg-[#111]/95 backdrop-blur-sm border-t border-[#1a1a1a] flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl font-bold bg-[#1a1a1a] text-[#888] hover:text-white transition-colors"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={loading || uploading}
                            className="flex-[2] h-12 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black rounded-xl font-bold transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <><Loader2 size={18} className="animate-spin" /> Enregistrement…</> : (productToEdit ? 'Enregistrer' : 'Ajouter le produit')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
