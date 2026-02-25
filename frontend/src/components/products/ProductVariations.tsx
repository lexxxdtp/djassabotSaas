import { useState } from 'react';
import { Plus, X, Tags, ImageIcon, Trash2 } from 'lucide-react';
import type { ProductVariation, VariationTemplate } from '../../types';

interface ProductVariationsProps {
    variations: ProductVariation[];
    onChange: (variations: ProductVariation[]) => void;
    onUploadImage: (e: React.ChangeEvent<HTMLInputElement>, varIdx: number, optIdx: number) => void;
    uploading: boolean;
    templates: VariationTemplate[];
    enabled: boolean;
    setEnabled: (enabled: boolean) => void;
}

export default function ProductVariations({
    variations,
    onChange,
    onUploadImage,
    uploading,
    templates,
    enabled,
    setEnabled
}: ProductVariationsProps) {

    // Local state for temporary inputs when adding new options
    const [newOptionInputs, setNewOptionInputs] = useState<Record<number, { name: string; price: string; stock: string }>>({});

    const handleAddOption = (varIdx: number) => {
        const inputs = newOptionInputs[varIdx];
        if (!inputs || !inputs.name.trim()) return;

        const newVars = [...variations];
        newVars[varIdx].options = [
            ...newVars[varIdx].options,
            {
                value: inputs.name.trim(),
                priceModifier: inputs.price ? Number(inputs.price) : 0,
                stock: inputs.stock ? Number(inputs.stock) : undefined
            }
        ];
        onChange(newVars);

        // Reset inputs
        setNewOptionInputs(prev => ({
            ...prev,
            [varIdx]: { name: '', price: '', stock: '' }
        }));
    };

    const removeOption = (varIdx: number, optIdx: number) => {
        const newVars = [...variations];
        newVars[varIdx].options = newVars[varIdx].options.filter((_, i) => i !== optIdx);
        onChange(newVars);
    };

    const removeVariation = (varIdx: number) => {
        const newVars = variations.filter((_, i) => i !== varIdx);
        onChange(newVars);
    };

    return (
        <div className="border-t border-white/5 pt-4 mt-4">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                    <Tags size={16} className="text-indigo-500" />
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Déclinaisons</span>

                    {/* Toggle Switch */}
                    <button
                        type="button"
                        onClick={() => {
                            const newState = !enabled;
                            setEnabled(newState);
                            if (!newState) {
                                onChange([]);
                            }
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                    >
                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-[10px] ${enabled ? 'text-indigo-400' : 'text-zinc-600'}`}>
                        {enabled ? 'ON' : 'OFF'}
                    </span>
                </div>

                {enabled && (
                    <button
                        type="button"
                        onClick={() => onChange([...variations, { name: '', options: [] }])}
                        className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                    >
                        <Plus size={14} />
                        Ajouter
                    </button>
                )}
            </div>

            <p className="text-zinc-600 text-[10px] mb-3">
                {enabled
                    ? 'Définissez les options (Taille, Couleur...). Le stock sera géré par variation.'
                    : 'Activez si votre produit a des tailles, couleurs, saveurs...'
                }
            </p>

            {!enabled ? null : variations.length === 0 ? (
                <p className="text-zinc-500 text-xs py-2 text-center border border-dashed border-white/5 rounded-lg">Cliquez sur "Ajouter" pour créer une déclinaison</p>
            ) : (
                <div className="space-y-3">
                    {variations.map((variation, varIdx) => (
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
                                                const newVars = [...variations];
                                                newVars[varIdx].name = e.target.value;
                                                onChange(newVars);
                                            }}
                                            className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white text-sm focus:border-indigo-500 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newVars = [...variations];
                                                newVars[varIdx].isCustom = false;
                                                onChange(newVars);
                                            }}
                                            className="text-xs text-zinc-500 hover:text-white"
                                        >
                                            Annuler
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                        {templates.map(t => t.name).concat(['Taille', 'Couleur', 'Format']).filter((v, i, a) => a.indexOf(v) === i).map((optName) => (
                                            <button
                                                key={optName}
                                                type="button"
                                                onClick={() => {
                                                    const newVars = [...variations];
                                                    newVars[varIdx].name = optName;

                                                    // Auto-fill defaults if matches template
                                                    const tpl = templates.find(t => t.name.toLowerCase() === optName.toLowerCase());
                                                    if (tpl && newVars[varIdx].options.length === 0) {
                                                        newVars[varIdx].options = tpl.default_options.map(o => ({
                                                            value: o.value,
                                                            priceModifier: o.priceModifier,
                                                            stock: 10 // Default stock for convenience
                                                        }));
                                                    }

                                                    onChange(newVars);
                                                }}
                                                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${variation.name === optName
                                                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50'
                                                    : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                {optName}
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newVars = [...variations];
                                                newVars[varIdx].isCustom = true;
                                                newVars[varIdx].name = '';
                                                onChange(newVars);
                                            }}
                                            className="px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-white/5 text-zinc-400 border border-white/5 hover:bg-white/10 hover:text-white"
                                        >
                                            + Autre
                                        </button>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => removeVariation(varIdx)}
                                    className="p-1 text-zinc-600 hover:text-red-500 transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            {/* Options List */}
                            <div className="space-y-2 pl-2 border-l border-white/10 ml-1">
                                {variation.options.map((opt, optIdx) => (
                                    <div key={optIdx} className="group relative bg-white/5 rounded p-2 flex items-start gap-3">
                                        {/* Image Upload for Option */}
                                        <label className="relative w-10 h-10 flex-shrink-0 bg-black/30 rounded border border-white/10 flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden">
                                            {uploading ? (
                                                <span className="animate-spin text-[8px]">⏳</span>
                                            ) : opt.images?.[0] ? (
                                                <img src={opt.images[0]} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <ImageIcon size={14} className="text-zinc-600" />
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => onUploadImage(e, varIdx, optIdx)}
                                            />
                                        </label>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-baseline">
                                                <span className="text-sm text-white font-medium truncate">{opt.value}</span>
                                                <span className="text-[10px] bg-white/10 text-zinc-400 px-1.5 py-0.5 rounded ml-2">
                                                    Stock: {opt.stock ?? 'Inf'}
                                                </span>
                                            </div>
                                            {opt.priceModifier !== 0 && (
                                                <div className="text-[10px] text-zinc-500">
                                                    Prix: {opt.priceModifier && opt.priceModifier > 0 ? '+' : ''}{opt.priceModifier} FCFA
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => removeOption(varIdx, optIdx)}
                                            className="opacity-0 group-hover:opacity-100 absolute top-1 right-1 text-zinc-600 hover:text-red-500 bg-black/50 rounded-full p-0.5"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}

                                {/* Add New Option Row */}
                                <div className="flex gap-2 items-center mt-2">
                                    <input
                                        type="text"
                                        placeholder="Nom (ex: XL)"
                                        value={newOptionInputs[varIdx]?.name || ''}
                                        onChange={(e) => setNewOptionInputs({
                                            ...newOptionInputs,
                                            [varIdx]: { ...newOptionInputs[varIdx], name: e.target.value }
                                        })}
                                        className="flex-1 w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption(varIdx))}
                                    />
                                    <input
                                        type="number"
                                        placeholder="+Prix"
                                        value={newOptionInputs[varIdx]?.price || ''}
                                        onChange={(e) => setNewOptionInputs({
                                            ...newOptionInputs,
                                            [varIdx]: { ...newOptionInputs[varIdx], price: e.target.value }
                                        })}
                                        className="w-16 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
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
                                        className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white focus:border-indigo-500 outline-none"
                                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddOption(varIdx))}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddOption(varIdx)}
                                        className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded hover:bg-indigo-500 hover:text-white transition-colors"
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
    );
}
