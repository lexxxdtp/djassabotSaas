import { useState } from 'react';
import { CheckCircle, Sparkles, Wand2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { apiClient } from '../../utils/apiClient';
import type { SettingsConfig } from '../../types';

interface SettingsPersonalityProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

const COMMUNICATION_STYLES = [
    {
        id: 'friendly',
        icon: '😊',
        name: 'Amical',
        description: 'Tutoiement, chaleureux, emojis modérés',
        recommended: true,
        presets: { persona: 'friendly', politeness: 'informal', emojiLevel: 'medium', slangLevel: 'low', humorLevel: 'medium', responseLength: 'medium' }
    },
    {
        id: 'professional',
        icon: '🎩',
        name: 'Professionnel',
        description: 'Vouvoiement, formel, sans argot ni emojis',
        presets: { persona: 'professional', politeness: 'formal', emojiLevel: 'none', slangLevel: 'none', humorLevel: 'low', responseLength: 'medium' }
    },
    {
        id: 'commercial',
        icon: '📣',
        name: 'Commercial',
        description: 'Direct, focus vente, emojis élevés',
        presets: { persona: 'commercial', politeness: 'informal', emojiLevel: 'high', slangLevel: 'low', humorLevel: 'low', responseLength: 'medium' }
    },
    {
        id: 'local',
        icon: '🗣️',
        name: 'Local / Ivoirien',
        description: 'Expressions locales (nouchi), très décontracté',
        presets: { persona: 'local', politeness: 'informal', emojiLevel: 'high', slangLevel: 'high', humorLevel: 'high', responseLength: 'medium' }
    }
];

export default function SettingsPersonality({ config, setConfig }: SettingsPersonalityProps) {
    const [aiPrompt, setAiPrompt] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [showSliders, setShowSliders] = useState(false);

    // Determine if the current config matches a preset
    const activePreset = COMMUNICATION_STYLES.find(style => {
        return (
            config.persona === style.presets.persona &&
            config.politeness === style.presets.politeness &&
            config.emojiLevel === style.presets.emojiLevel &&
            config.slangLevel === style.presets.slangLevel &&
            config.humorLevel === style.presets.humorLevel
        );
    });

    const isCustom = !activePreset;

    const handleApplyPreset = (style: typeof COMMUNICATION_STYLES[0]) => {
        setConfig({
            ...config,
            ...style.presets
        });
    };

    const handleApplyCustom = () => {
        setConfig({
            ...config,
            persona: 'custom'
        });
        setShowSliders(true);
    };

    const handleAIConfigure = async () => {
        if (!aiPrompt.trim()) {
            toast.error('Veuillez décrire le ton de votre bot.');
            return;
        }

        setAnalyzing(true);
        try {
            const res = await apiClient('/ai/parse-personality', {
                method: 'POST',
                body: JSON.stringify({ description: aiPrompt })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erreur lors de l\'analyse');
            }

            const parsed = await res.json();
            
            setConfig({
                ...config,
                persona: parsed.persona || 'custom',
                politeness: parsed.politeness || config.politeness,
                emojiLevel: parsed.emojiLevel || config.emojiLevel,
                slangLevel: parsed.slangLevel || config.slangLevel,
                humorLevel: parsed.humorLevel || config.humorLevel,
                responseLength: parsed.responseLength || config.responseLength,
                greeting: parsed.greeting || config.greeting,
                systemInstructions: parsed.systemInstructions 
                    ? `${config.systemInstructions ? `${config.systemInstructions}\n` : ''}${parsed.systemInstructions}`
                    : config.systemInstructions
            });

            toast.success('Personnalité configurée avec succès par l\'IA ! ✨');
            setAiPrompt('');
            setShowSliders(true);
        } catch (error) {
            console.error('AI Config error:', error);
            toast.error(error instanceof Error ? error.message : 'Impossible d\'analyser la description');
        } finally {
            setAnalyzing(false);
        }
    };

    // Helper for reactive preview bubble
    const getPreviewMessage = () => {
        const p = config.politeness;
        const e = config.emojiLevel;
        const s = config.slangLevel;
        const h = config.humorLevel;
        const l = config.responseLength;

        let text = "";

        if (s === 'high') {
            text = "Yo patron ! La livraison sur Abidjan c'est 1500 frs seulement. On gère ça rapidement pour toi, tu valides ?";
        } else if (s === 'medium') {
            if (p === 'formal') {
                text = "Bonjour chef. Pour la livraison sur Abidjan, c'est 1500 FCFA. On gère ça pour vous rapidement.";
            } else {
                text = "Salut chef ! La livraison sur Abidjan c'est 1500 FCFA. On gère ça pour toi rapidement, c'est bon ?";
            }
        } else {
            if (p === 'formal') {
                text = "Bonjour. Le tarif pour la livraison sur Abidjan s'élève à 1500 FCFA. Souhaitez-vous que nous procédions à l'expédition ?";
            } else {
                text = "Salut ! La livraison sur Abidjan est à 1500 FCFA. Est-ce que cela te convient pour ta commande ?";
            }
        }

        if (e === 'none') {
            text = text.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, '');
        } else if (e === 'high') {
            text += " 🛍️📦✨";
        } else if (e === 'medium') {
            text += " 👋";
        }

        if (h === 'high') {
            text += e !== 'none' ? " Le patron va me tuer si je négocie plus ! 😂" : " Le patron va me tuer si je négocie plus !";
        }

        if (l === 'short') {
            if (s === 'high') {
                text = "Yo, la livraison c'est 1500 frs. Tu prends ?";
            } else if (p === 'formal') {
                text = "Bonjour. La livraison est à 1500 FCFA. Souhaitez-vous commander ?";
            } else {
                text = "Salut ! Livraison à 1500 FCFA. Tu confirmes ?";
            }
            if (e === 'high') text += " 📦⚡";
        } else if (l === 'long') {
            text += " Nous livrons dans toutes les communes d'Abidjan (Cocody, Yopougon, Marcory, etc.) et à l'intérieur du pays également. Nos livreurs sont fiables et rapides.";
        }

        return text;
    };

    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 md:p-8 space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#00D97E] animate-pulse"></span>
                    Style & Personnalité du Bot
                </h2>
                <p className="text-[#888] text-xs mt-1">Configurez le ton, le langage et la manière dont votre assistant s'adresse aux clients.</p>
            </div>

            {/* Grille de Presets */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {COMMUNICATION_STYLES.map(style => {
                    const isActive = !isCustom && config.persona === style.id;
                    return (
                        <button
                            key={style.id}
                            type="button"
                            onClick={() => handleApplyPreset(style)}
                            className={`relative p-4 rounded-xl border text-left transition-all ${isActive
                                ? 'bg-[#00D97E]/10 border-[#00D97E]/50 ring-2 ring-[#00D97E]/20'
                                : 'bg-[#111] border-[#1a1a1a] hover:bg-[#1a1a1a]'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-2xl">{style.icon}</span>
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isActive ? 'border-[#00D97E] bg-[#00D97E]' : 'border-zinc-700'
                                    }`}>
                                    {isActive && <CheckCircle size={10} className="text-black" />}
                                </div>
                            </div>
                            <div className="font-bold text-white text-xs">{style.name}</div>
                            <div className="text-[10px] text-[#888] mt-1 line-clamp-2 leading-snug">{style.description}</div>
                        </button>
                    );
                })}

                {/* Custom Preset Button */}
                <button
                    type="button"
                    onClick={handleApplyCustom}
                    className={`relative p-4 rounded-xl border text-left transition-all ${isCustom
                        ? 'bg-[#00D97E]/10 border-[#00D97E]/50 ring-2 ring-[#00D97E]/20'
                        : 'bg-[#111] border-[#1a1a1a] hover:bg-[#1a1a1a]'
                        }`}
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-2xl">⚙️</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isCustom ? 'border-[#00D97E] bg-[#00D97E]' : 'border-zinc-700'
                            }`}>
                            {isCustom && <CheckCircle size={10} className="text-black" />}
                        </div>
                    </div>
                    <div className="font-bold text-white text-xs">Personnalisé</div>
                    <div className="text-[10px] text-[#888] mt-1 line-clamp-2 leading-snug">Réglez vous-même chaque curseur.</div>
                </button>
            </div>

            {/* Assistant IA de description libre */}
            <div className="bg-black border border-[#1a1a1a] rounded-xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-white">
                    <div className="p-1.5 rounded-lg bg-[#00D97E]/10 text-[#00D97E]">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider">Assistant Personnalité IA</h3>
                        <p className="text-[10px] text-[#888]">Décrivez comment vous souhaitez que votre bot parle en texte libre.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <textarea
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        placeholder="Ex: Je veux qu'elle parle comme une grande sœur sympa d'Abidjan, respectueuse mais décontractée, qui dit 'yako' et 'dja' quand c'est approprié, et qui écrit des messages courts..."
                        className="w-full bg-white/5 border border-[#1a1a1a] rounded-lg p-3 text-xs text-white focus:border-[#00D97E] outline-none transition-all placeholder:text-[#555] leading-relaxed resize-none"
                        rows={3}
                        disabled={analyzing}
                    />
                    <button
                        type="button"
                        onClick={handleAIConfigure}
                        disabled={analyzing || !aiPrompt.trim()}
                        className="w-full bg-[#00D97E] hover:bg-[#00D97E]/90 disabled:opacity-50 text-black py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-98"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 size={14} className="animate-spin" />
                                <span>Analyse par l'IA en cours...</span>
                            </>
                        ) : (
                            <>
                                <Wand2 size={14} />
                                <span>Configurer automatiquement par l'IA</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Accordéon Curseurs Avancés */}
            <div className="border border-[#1a1a1a] rounded-xl overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowSliders(!showSliders)}
                    className="w-full flex items-center justify-between p-4 bg-black/40 hover:bg-black/60 transition-colors text-left"
                >
                    <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-3 bg-[#00D97E] rounded-full"></span>
                        <span className="text-xs font-bold text-white uppercase tracking-wider">Ajustements précis des curseurs</span>
                    </div>
                    {showSliders ? <ChevronUp size={16} className="text-[#888]" /> : <ChevronDown size={16} className="text-[#888]" />}
                </button>

                {showSliders && (
                    <div className="p-5 border-t border-[#1a1a1a] bg-black/20 grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Politesse */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wide">Politesse & Vouvoiement</label>
                            <div className="flex bg-black border border-[#1a1a1a] rounded-xl p-1 gap-1">
                                {[
                                    { v: 'formal', l: '🎩 Vous (Formel)' },
                                    { v: 'informal', l: '💬 Tu (Amical)' },
                                    { v: 'auto', l: '🔄 Adaptatif' }
                                ].map(opt => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => setConfig({ ...config, persona: 'custom', politeness: opt.v })}
                                        className={`flex-1 text-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${config.politeness === opt.v
                                            ? 'bg-[#00D97E] text-black'
                                            : 'text-[#888] hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Emojis */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wide">Densité des Emojis</label>
                            <div className="flex bg-black border border-[#1a1a1a] rounded-xl p-1 gap-1">
                                {[
                                    { v: 'none', l: '🚫 Aucun' },
                                    { v: 'medium', l: '😊 Moyen' },
                                    { v: 'high', l: '🔥 Élevé' },
                                    { v: 'auto', l: '🔄 Adaptatif' }
                                ].map(opt => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => setConfig({ ...config, persona: 'custom', emojiLevel: opt.v })}
                                        className={`flex-1 text-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${config.emojiLevel === opt.v
                                            ? 'bg-[#00D97E] text-black'
                                            : 'text-[#888] hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Slang / Argot */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wide">Expressions & Argot Local (Nouchi)</label>
                            <div className="flex bg-black border border-[#1a1a1a] rounded-xl p-1 gap-1">
                                {[
                                    { v: 'none', l: '🌍 Neutre' },
                                    { v: 'low', l: '🇨🇮 Léger' },
                                    { v: 'medium', l: '🗣️ Moyen' },
                                    { v: 'high', l: '🔥 Nouchi' }
                                ].map(opt => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => setConfig({ ...config, persona: 'custom', slangLevel: opt.v })}
                                        className={`flex-1 text-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${config.slangLevel === opt.v
                                            ? 'bg-[#00D97E] text-black'
                                            : 'text-[#888] hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Humour */}
                        <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wide">Niveau d'Humour</label>
                            <div className="flex bg-black border border-[#1a1a1a] rounded-xl p-1 gap-1">
                                {[
                                    { v: 'low', l: '💼 Sérieux' },
                                    { v: 'medium', l: '✨ Sympa' },
                                    { v: 'high', l: '😂 Rigolo' }
                                ].map(opt => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => setConfig({ ...config, persona: 'custom', humorLevel: opt.v })}
                                        className={`flex-1 text-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${config.humorLevel === opt.v
                                            ? 'bg-[#00D97E] text-black'
                                            : 'text-[#888] hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Longueur de réponse */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-wide">Longueur des réponses</label>
                            <div className="flex bg-black border border-[#1a1a1a] rounded-xl p-1 gap-1">
                                {[
                                    { v: 'short', l: '⚡ Court' },
                                    { v: 'medium', l: '📝 Moyen (Équilibré)' },
                                    { v: 'long', l: '📚 Détaillé / Long' },
                                    { v: 'auto', l: '🔄 Adaptatif' }
                                ].map(opt => (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => setConfig({ ...config, responseLength: opt.v })}
                                        className={`flex-1 text-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${config.responseLength === opt.v
                                            ? 'bg-[#00D97E] text-black'
                                            : 'text-[#888] hover:text-white hover:bg-white/5'
                                            }`}
                                    >
                                        {opt.l}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* WhatsApp Live Preview Widget */}
            <div className="border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl">
                {/* Simulated Header */}
                <div className="bg-[#075e54]/10 border-b border-[#1a1a1a] px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#00D97E] flex items-center justify-center text-black font-extrabold text-sm">
                            {config.botName?.substring(0, 1) || 'A'}
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-white">{config.botName || 'Assistant'}</h4>
                            <p className="text-[9px] text-[#00D97E] font-medium">En ligne</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-[#888] uppercase font-bold tracking-widest px-2 py-0.5 bg-black/40 rounded border border-[#1a1a1a]">Aperçu Live</span>
                    </div>
                </div>

                {/* Simulated Conversation Body */}
                <div className="bg-[#0b141a] p-4 space-y-4 min-h-[160px] flex flex-col justify-end">
                    {/* User Question */}
                    <div className="flex justify-end">
                        <div className="bg-[#005c4b] text-white p-3 rounded-lg text-xs max-w-[80%] rounded-tr-none shadow-md">
                            Salut, c'est combien la livraison ?
                        </div>
                    </div>

                    {/* Bot Answer */}
                    <div className="flex justify-start">
                        <div className="bg-[#202c33] text-white p-3 rounded-lg text-xs max-w-[80%] rounded-tl-none shadow-md space-y-1">
                            <p className="leading-relaxed whitespace-pre-wrap">{getPreviewMessage()}</p>
                            <span className="text-[8px] text-[#888] block text-right">Aujourd'hui</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

