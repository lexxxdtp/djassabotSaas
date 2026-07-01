import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Trash2, Image as ImageIcon, X, Plus, Tags, Bot, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import {
    hasActiveVariations,
    computeTotalStock,
    type Product,
    type ProductVariation,
    type VariationOption,
    type VariationTemplate,
} from '../utils/productHelpers';

export type { Product, ProductVariation, VariationOption, VariationTemplate };

// ---------- CONTAINER (data) ----------

const ProductDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [product, setProduct] = useState<Product>({
        name: '', price: '', stock: '', description: '', images: [], variations: [], aiInstructions: '',
    });
    const [variationsEnabled, setVariationsEnabled] = useState(false);
    const [variationTemplates, setVariationTemplates] = useState<VariationTemplate[]>([]);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const res = await apiClient('/variation-templates');
                if (res.ok) setVariationTemplates(await res.json());
            } catch (error) {
                console.error('Failed to fetch variation templates', error);
            }
        };
        if (token) fetchTemplates();
    }, [token]);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                if (!token) { navigate('/login'); return; }
                const res = await apiClient('/products');
                if (!res.ok) { navigate('/dashboard/products'); return; }
                const data = await res.json();
                const found = data.find((p: Product) => p.id === id);
                if (found) {
                    const productData: Product = {
                        ...found,
                        images: found.images || [],
                        variations: found.variations || [],
                        aiInstructions: found.aiInstructions || found.ai_instructions || '',
                    };
                    setProduct(productData);
                    setVariationsEnabled(hasActiveVariations(productData.variations));
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
    }, [id, navigate, token]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await apiClient(`/products/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ ...product, price: Number(product.price), stock: Number(product.stock) }),
            });
            if (res.ok) toast.success('Produit enregistré');
            else toast.error('Erreur lors de la mise à jour');
        } catch (error) {
            console.error('Error updating product', error);
            toast.error('Erreur lors de la mise à jour');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await apiClient(`/products/${id}`, { method: 'DELETE' });
            toast.success('Produit supprimé');
            navigate('/dashboard/products');
        } catch (error) {
            console.error('Error deleting product', error);
            toast.error('Erreur lors de la suppression');
        }
    };

    const uploadFiles = async (files: File[]): Promise<string[]> => {
        const urls: string[] = [];
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            const response = await apiClient('/products/upload', { method: 'POST', body: formData });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Erreur lors du téléversement');
            }
            urls.push((await response.json()).url);
        }
        return urls;
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        try {
            const urls = await uploadFiles(Array.from(e.target.files));
            setProduct(prev => ({ ...prev, images: [...prev.images, ...urls] }));
        } catch (error) {
            console.error('Upload failed', error);
            toast.error('Erreur lors de l\'envoi de la photo');
        }
    };

    const removeImage = (absoluteIndex: number) => {
        setProduct(prev => ({ ...prev, images: prev.images.filter((_, i) => i !== absoluteIndex) }));
    };

    // === Variations ===
    const addVariation = () => setProduct(prev => ({ ...prev, variations: [...(prev.variations || []), { name: '', options: [] }] }));
    const removeVariation = (index: number) => setProduct(prev => ({ ...prev, variations: prev.variations.filter((_, i) => i !== index) }));

    const updateVariationName = (index: number, name: string) => {
        const newVariations = [...product.variations];
        const selectedTemplate = variationTemplates.find(t => t.name === name);
        if (selectedTemplate && selectedTemplate.default_options) {
            newVariations[index] = { name, options: [...selectedTemplate.default_options] };
        } else {
            newVariations[index] = { ...newVariations[index], name };
        }
        setProduct({ ...product, variations: newVariations });
    };

    const saveVariationTemplate = async (name: string, options: VariationOption[]) => {
        try {
            await apiClient('/variation-templates', { method: 'POST', body: JSON.stringify({ name, default_options: options }) });
        } catch (error) {
            console.error('Failed to save variation template', error);
        }
    };

    const addVariationOption = (varIndex: number, value: string) => {
        if (!value.trim()) return;
        const newVariations = [...product.variations];
        const existingValues = newVariations[varIndex].options.map(o => o.value);
        if (!existingValues.includes(value.trim())) {
            newVariations[varIndex] = {
                ...newVariations[varIndex],
                options: [...newVariations[varIndex].options, { value: value.trim(), stock: undefined, priceModifier: 0 }],
            };
            setProduct({ ...product, variations: newVariations });
        }
    };

    const removeVariationOption = (varIndex: number, optionIndex: number) => {
        const newVariations = [...product.variations];
        newVariations[varIndex] = {
            ...newVariations[varIndex],
            options: newVariations[varIndex].options.filter((_, i) => i !== optionIndex),
        };
        setProduct({ ...product, variations: newVariations });
    };

    const updateVariationOption = (varIndex: number, optionIndex: number, field: 'stock' | 'priceModifier' | 'value' | 'images', value: number | string | string[] | undefined) => {
        const newVariations = [...product.variations];
        newVariations[varIndex].options[optionIndex] = { ...newVariations[varIndex].options[optionIndex], [field]: value };
        setProduct({ ...product, variations: newVariations });
    };

    const handleVariationImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, varIndex: number, optIndex: number) => {
        if (!e.target.files?.length) return;
        const currentImages = product.variations[varIndex].options[optIndex].images || [];
        if (currentImages.length + e.target.files.length > 2) {
            toast.error('Maximum 2 photos par déclinaison');
            return;
        }
        try {
            const urls = await uploadFiles(Array.from(e.target.files));
            updateVariationOption(varIndex, optIndex, 'images', [...currentImages, ...urls]);
            setProduct(prev => ({ ...prev, images: [...prev.images, ...urls] }));
        } catch (error) {
            console.error('Upload failed', error);
            toast.error('Erreur lors de l\'envoi de la photo');
        }
    };

    const toggleVariations = () => {
        const newState = !variationsEnabled;
        setVariationsEnabled(newState);
        if (!newState) setProduct(prev => ({ ...prev, variations: [] }));
    };

    if (loading) return <ProductDetailSkeleton />;

    return (
        <ProductDetailView
            product={product}
            variationTemplates={variationTemplates}
            variationsEnabled={variationsEnabled}
            saving={saving}
            onBack={() => navigate('/dashboard/products')}
            onSave={handleSave}
            onDelete={handleDelete}
            onChange={patch => setProduct(prev => ({ ...prev, ...patch }))}
            onImageUpload={handleImageUpload}
            onRemoveImage={removeImage}
            onToggleVariations={toggleVariations}
            onAddVariation={addVariation}
            onRemoveVariation={removeVariation}
            onUpdateVariationName={updateVariationName}
            onSaveTemplate={saveVariationTemplate}
            onAddOption={addVariationOption}
            onRemoveOption={removeVariationOption}
            onUpdateOption={updateVariationOption}
            onVariationImageUpload={handleVariationImageUpload}
        />
    );
};

// ---------- PRESENTATIONAL VIEW (réutilisée par la preview) ----------

export interface ProductDetailViewProps {
    product: Product;
    variationTemplates: VariationTemplate[];
    variationsEnabled: boolean;
    saving: boolean;
    onBack: () => void;
    onSave: () => void;
    onDelete: () => void;
    onChange: (patch: Partial<Product>) => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveImage: (absoluteIndex: number) => void;
    onToggleVariations: () => void;
    onAddVariation: () => void;
    onRemoveVariation: (index: number) => void;
    onUpdateVariationName: (index: number, name: string) => void;
    onSaveTemplate: (name: string, options: VariationOption[]) => void;
    onAddOption: (varIndex: number, value: string) => void;
    onRemoveOption: (varIndex: number, optionIndex: number) => void;
    onUpdateOption: (varIndex: number, optionIndex: number, field: 'stock' | 'priceModifier' | 'value' | 'images', value: number | string | string[] | undefined) => void;
    onVariationImageUpload: (e: React.ChangeEvent<HTMLInputElement>, varIndex: number, optIndex: number) => void;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = (props) => {
    const {
        product, variationTemplates, variationsEnabled, saving,
        onBack, onSave, onDelete, onChange, onImageUpload, onRemoveImage, onToggleVariations,
    } = props;
    const [confirmDelete, setConfirmDelete] = useState(false);

    const active = hasActiveVariations(product.variations);
    const stockValue = computeTotalStock(product);

    const anim = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both';
    const delay = (i: number): React.CSSProperties => ({ animationDuration: '450ms', animationDelay: `${i * 60}ms` });

    return (
        <div className="space-y-5 pb-4">
            {/* TOP BAR */}
            <div className={`flex items-center justify-between gap-3 ${anim}`} style={delay(0)}>
                <button
                    onClick={onBack}
                    aria-label="Retour aux produits"
                    className="flex items-center gap-2 text-[#888] hover:text-white transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    <span className="text-sm font-medium">Produits</span>
                </button>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#00D97E] text-black disabled:opacity-60 px-5 py-2.5 rounded-xl text-sm font-bold transition-[transform,background-color] active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none"
                >
                    {saving ? <span>Enregistrement…</span> : <><Check className="w-4 h-4" aria-hidden="true" /><span>Enregistrer</span></>}
                </button>
            </div>

            {/* PHOTOS */}
            <section className={anim} style={delay(1)}>
                <div className="relative aspect-square bg-[#111] rounded-2xl overflow-hidden border border-[#1a1a1a]">
                    {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name || 'Photo du produit'} className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-[#555] gap-2">
                            <ImageIcon className="w-12 h-12" aria-hidden="true" />
                            <span className="text-xs">Aucune photo</span>
                        </div>
                    )}
                    <label className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-md text-white text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer active:scale-95 transition-transform border border-white/10">
                        <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                        {product.images?.[0] ? 'Changer la photo' : 'Ajouter une photo'}
                        <input type="file" className="hidden" accept="image/*" onChange={onImageUpload} />
                    </label>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-2">
                    {product.images?.slice(1).map((img, idx) => (
                        <div key={idx} className="relative aspect-square bg-[#111] rounded-xl overflow-hidden border border-[#1a1a1a]">
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            <button
                                onClick={() => onRemoveImage(idx + 1)}
                                aria-label="Retirer cette photo"
                                className="absolute top-1 right-1 bg-black/70 text-white p-1 rounded-full active:scale-90 transition-transform"
                            >
                                <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                        </div>
                    ))}
                    <label className="aspect-square bg-[#111] border border-dashed border-[#1a1a1a] rounded-xl flex items-center justify-center cursor-pointer active:scale-95 hover:border-[#00D97E]/40 transition-all text-[#888] hover:text-white">
                        <Plus className="w-5 h-5" aria-hidden="true" />
                        <input type="file" className="hidden" multiple accept="image/*" onChange={onImageUpload} />
                    </label>
                </div>
            </section>

            {/* INFOS PRINCIPALES */}
            <section className={`bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-4 ${anim}`} style={delay(2)}>
                <div>
                    <label htmlFor="pd-name" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Nom du produit</label>
                    <input
                        id="pd-name"
                        type="text"
                        value={product.name}
                        onChange={e => onChange({ name: e.target.value })}
                        className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3.5 text-white text-base font-semibold focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/10 outline-none transition-colors"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="pd-price" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Prix (FCFA)</label>
                        <input
                            id="pd-price"
                            type="number"
                            inputMode="numeric"
                            value={product.price}
                            onChange={e => onChange({ price: e.target.value })}
                            className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3.5 text-white tabular-nums focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/10 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label htmlFor="pd-stock" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">
                            Stock {active && <span className="text-[#00D97E] normal-case">· auto</span>}
                        </label>
                        <input
                            id="pd-stock"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            value={stockValue}
                            disabled={active}
                            onChange={e => { if (!active) onChange({ stock: Math.max(0, Number(e.target.value) || 0) }); }}
                            className={`w-full border rounded-xl p-3.5 tabular-nums outline-none transition-colors ${active
                                ? 'bg-[#0a0a0a] border-[#1a1a1a] text-[#666] cursor-not-allowed'
                                : 'bg-black border-[#1a1a1a] text-white focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/10'}`}
                        />
                        {active && <p className="text-[11px] text-[#555] mt-1.5">Calculé depuis vos déclinaisons.</p>}
                    </div>
                </div>

                <div>
                    <label htmlFor="pd-desc" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Description</label>
                    <textarea
                        id="pd-desc"
                        value={product.description}
                        onChange={e => onChange({ description: e.target.value })}
                        placeholder="Décrivez votre produit en quelques mots…"
                        className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3.5 text-white text-sm leading-relaxed min-h-[110px] resize-none focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/10 outline-none placeholder:text-[#555] transition-colors"
                    />
                </div>
            </section>

            {/* CONSIGNES POUR LE BOT */}
            <section className={`bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 ${anim}`} style={delay(3)}>
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-[#00D97E]/10 text-[#00D97E]"><Bot className="w-4 h-4" aria-hidden="true" /></div>
                    <label htmlFor="pd-ai" className="text-sm font-semibold text-white">Consignes pour le bot</label>
                </div>
                <p className="text-xs text-[#888] mb-3 leading-relaxed">
                    Des règles spéciales que le bot appliquera pour ce produit lors des ventes.
                </p>
                <textarea
                    id="pd-ai"
                    value={product.aiInstructions || ''}
                    onChange={e => onChange({ aiInstructions: e.target.value })}
                    placeholder="Ex : à partir de 3 articles, proposer -10%. À partir de 5, offrir la livraison."
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3.5 text-white text-sm leading-relaxed min-h-[90px] resize-none focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/10 outline-none placeholder:text-[#555] transition-colors"
                />
                <div className="mt-3 space-y-1.5 text-xs text-[#555]">
                    <p className="text-[#888] font-medium">Quelques exemples :</p>
                    <p>— « Si le client en prend 3 ou plus, proposer une remise de 10 % »</p>
                    <p>— « Suggérer l'accessoire assorti à chaque achat »</p>
                    <p>— « Pour une commande avant midi, proposer la livraison le jour même »</p>
                </div>
            </section>

            {/* DÉCLINAISONS */}
            <section className={`bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 ${anim}`} style={delay(4)}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-lg bg-[#00D97E]/10 text-[#00D97E] shrink-0 mt-0.5"><Tags className="w-4 h-4" aria-hidden="true" /></div>
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-white">Déclinaisons</p>
                            <p className="text-xs text-[#888] leading-relaxed mt-0.5">
                                {variationsEnabled
                                    ? 'Plusieurs versions (taille, couleur…). Le stock total est calculé tout seul.'
                                    : 'Activez si votre produit existe en plusieurs versions (tailles, couleurs, saveurs…).'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={variationsEnabled}
                        aria-label="Activer les déclinaisons"
                        onClick={onToggleVariations}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none ${variationsEnabled ? 'bg-[#00D97E]' : 'bg-[#1a1a1a]'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${variationsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {variationsEnabled && (
                    <div className="mt-4 pt-4 border-t border-[#1a1a1a] space-y-3">
                        {product.variations && product.variations.length > 0 ? (
                            product.variations.map((variation, varIndex) => (
                                <VariationCard key={varIndex} variation={variation} varIndex={varIndex} templates={variationTemplates} {...props} />
                            ))
                        ) : (
                            <div className="text-center py-8 bg-black border border-dashed border-[#1a1a1a] rounded-xl">
                                <Tags className="w-8 h-8 mx-auto text-[#444] mb-2" aria-hidden="true" />
                                <p className="text-[#888] text-sm">Aucune déclinaison pour l'instant.</p>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={props.onAddVariation}
                            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-[#1a1a1a] text-[#00D97E] text-sm font-semibold active:scale-[0.99] hover:border-[#00D97E]/40 transition-all cursor-pointer"
                        >
                            <Plus className="w-4 h-4" aria-hidden="true" />
                            Ajouter une déclinaison
                        </button>
                    </div>
                )}
            </section>

            {/* ACTIONS BAS */}
            <div className={`space-y-3 pt-2 ${anim}`} style={delay(5)}>
                <button
                    onClick={onSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-[#00D97E] text-black disabled:opacity-60 px-6 py-3.5 rounded-xl font-bold text-sm transition-[transform,background-color] active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none"
                >
                    {saving ? <span>Enregistrement…</span> : <><Check className="w-4 h-4" aria-hidden="true" /><span>Enregistrer les modifications</span></>}
                </button>
                <button
                    onClick={() => setConfirmDelete(true)}
                    className="w-full flex items-center justify-center gap-2 text-red-400 hover:text-red-300 px-6 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500/30 outline-none"
                >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Supprimer ce produit
                </button>
            </div>

            {/* CONFIRMATION SUPPRESSION */}
            {confirmDelete && (
                <div
                    className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => setConfirmDelete(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirmer la suppression"
                        onClick={e => e.stopPropagation()}
                        className="bg-[#111] border-t md:border border-[#1a1a1a] rounded-t-3xl md:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300"
                    >
                        <div className="p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400 shrink-0"><Trash2 className="w-5 h-5" aria-hidden="true" /></div>
                                <div>
                                    <p className="text-white font-bold">Supprimer ce produit ?</p>
                                    <p className="text-[#888] text-sm mt-0.5">Cette action est définitive.</p>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <button
                                    onClick={() => { setConfirmDelete(false); onDelete(); }}
                                    className="w-full bg-red-500 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-transform active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-red-500/40 outline-none"
                                >
                                    Oui, supprimer
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="w-full px-6 py-3 rounded-xl font-semibold text-sm text-[#888] hover:text-white transition-colors cursor-pointer"
                                >
                                    Annuler
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------- VARIATION CARD ----------

interface VariationCardProps extends ProductDetailViewProps {
    variation: ProductVariation;
    varIndex: number;
    templates: VariationTemplate[];
}

const VariationCard: React.FC<VariationCardProps> = ({
    variation, varIndex, templates,
    onRemoveVariation, onUpdateVariationName, onSaveTemplate,
    onAddOption, onRemoveOption, onUpdateOption, onVariationImageUpload,
}) => {
    const [newOption, setNewOption] = useState('');
    const isKnownTemplate = !!templates.find(t => t.name === variation.name);
    const showSelector = variation.name === '' || !isKnownTemplate;

    const commitOption = () => {
        if (newOption.trim()) { onAddOption(varIndex, newOption.trim()); setNewOption(''); }
    };

    return (
        <div className="bg-black border border-[#1a1a1a] rounded-xl p-3.5 space-y-3">
            {/* Nom de la déclinaison */}
            <div className="flex items-center gap-2">
                {showSelector ? (
                    <div className="flex-1 flex flex-col gap-2">
                        <select
                            value={variation.name}
                            onChange={e => { if (e.target.value !== '__custom__') onUpdateVariationName(varIndex, e.target.value); }}
                            className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#00D97E] outline-none"
                        >
                            <option value="">Choisir un type…</option>
                            {templates.map((template, idx) => (
                                <option key={idx} value={template.name}>
                                    {template.name}{template.isSystem ? '' : ' (personnalisé)'}
                                </option>
                            ))}
                            <option value="__custom__">Autre (personnalisé)</option>
                        </select>
                        {variation.name === '' && (
                            <input
                                type="text"
                                placeholder="Nom personnalisé (ex : Pointure)"
                                onBlur={async e => {
                                    const v = e.target.value.trim();
                                    if (v) {
                                        onUpdateVariationName(varIndex, v);
                                        if (variation.options && variation.options.length > 0) onSaveTemplate(v, variation.options);
                                    }
                                }}
                                onKeyDown={e => { if (e.key === 'Enter' && e.currentTarget.value.trim()) onUpdateVariationName(varIndex, e.currentTarget.value.trim()); }}
                                className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#00D97E] outline-none"
                            />
                        )}
                    </div>
                ) : (
                    <div className="flex-1 flex items-center justify-between px-3 py-2.5 bg-[#111] border border-[#1a1a1a] rounded-lg text-white text-sm">
                        <span className="font-medium">{variation.name}</span>
                        <button type="button" onClick={() => onUpdateVariationName(varIndex, '')} className="text-xs text-[#888] hover:text-[#00D97E] cursor-pointer">Changer</button>
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => onRemoveVariation(varIndex)}
                    aria-label="Supprimer cette déclinaison"
                    className="p-2.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>

            {/* Options (stacked cards, mobile-friendly) */}
            {variation.options && variation.options.length > 0 && (
                <div className="space-y-2">
                    {variation.options.map((option, optIndex) => (
                        <div key={optIndex} className="bg-[#111] border border-[#1a1a1a] rounded-lg p-3 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={option.value}
                                    onChange={e => onUpdateOption(varIndex, optIndex, 'value', e.target.value)}
                                    placeholder="Valeur (ex : XL)"
                                    className="flex-1 bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm font-medium focus:border-[#00D97E] outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={() => onRemoveOption(varIndex, optIndex)}
                                    aria-label="Retirer cette option"
                                    className="p-2 text-[#888] hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                                >
                                    <X className="w-4 h-4" aria-hidden="true" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-[#555] font-bold mb-1">Stock</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min="0"
                                        value={option.stock ?? ''}
                                        placeholder="∞"
                                        onChange={e => onUpdateOption(varIndex, optIndex, 'stock', e.target.value ? Math.max(0, Number(e.target.value)) : undefined)}
                                        className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm tabular-nums focus:border-[#00D97E] outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider text-[#555] font-bold mb-1">Prix +/− (F)</label>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        value={option.priceModifier ?? 0}
                                        onChange={e => onUpdateOption(varIndex, optIndex, 'priceModifier', Number(e.target.value))}
                                        className="w-full bg-black border border-[#1a1a1a] rounded-lg px-3 py-2 text-white text-sm tabular-nums focus:border-[#00D97E] outline-none"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {option.images && option.images.map((img, imgIdx) => (
                                    <div key={imgIdx} className="relative w-10 h-10 rounded-lg border border-[#1a1a1a] overflow-hidden">
                                        <img src={img} alt="" className="w-full h-full object-cover" />
                                        <button
                                            onClick={() => onUpdateOption(varIndex, optIndex, 'images', option.images?.filter((_, i) => i !== imgIdx))}
                                            aria-label="Retirer la photo"
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 active:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3.5 h-3.5 text-white" aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                {(!option.images || option.images.length < 2) && (
                                    <label className="w-10 h-10 flex items-center justify-center bg-black border border-dashed border-[#1a1a1a] rounded-lg cursor-pointer hover:border-[#00D97E] hover:text-[#00D97E] text-[#888] transition-colors">
                                        <ImageIcon className="w-4 h-4" aria-hidden="true" />
                                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => onVariationImageUpload(e, varIndex, optIndex)} />
                                    </label>
                                )}
                                <span className="text-[11px] text-[#555] ml-1">Photos (2 max)</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Ajouter une option */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={newOption}
                    onChange={e => setNewOption(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitOption(); } }}
                    placeholder="Ajouter une option (ex : XL, Rouge…)"
                    className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-lg px-3 py-2.5 text-white text-sm focus:border-[#00D97E] outline-none placeholder:text-[#555]"
                />
                <button
                    type="button"
                    onClick={commitOption}
                    aria-label="Ajouter l'option"
                    className="px-3 py-2.5 bg-[#00D97E]/10 text-[#00D97E] rounded-lg hover:bg-[#00D97E]/20 transition-colors shrink-0 cursor-pointer"
                >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
            </div>
        </div>
    );
};

// ---------- SKELETON ----------

const ProductDetailSkeleton = () => (
    <div className="space-y-5 pb-4">
        <div className="flex items-center justify-between">
            <div className="h-5 w-24 bg-[#111] rounded animate-pulse" />
            <div className="h-10 w-32 bg-[#111] rounded-xl animate-pulse" />
        </div>
        <div className="aspect-square bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
        <div className="h-52 bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
        <div className="h-40 bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
    </div>
);

export default ProductDetail;
