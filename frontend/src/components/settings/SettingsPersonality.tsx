import { CheckCircle } from 'lucide-react';
import type { SettingsConfig } from '../../types';

interface SettingsPersonalityProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

const COMMUNICATION_STYLES = [
    {
        id: 'professional',
        icon: '🎩',
        name: 'Professionnel',
        description: 'Vouvoiement, formel, sans emojis',
        presets: { politeness: 'formal', emojiLevel: 'none', slangLevel: 'none', humorLevel: 'low' }
    },
    {
        id: 'friendly',
        icon: '😊',
        name: 'Amical',
        description: 'Tutoiement, emojis modérés, chaleureux',
        recommended: true,
        presets: { politeness: 'informal', emojiLevel: 'medium', slangLevel: 'low', humorLevel: 'medium' }
    },
    {
        id: 'commercial',
        icon: '📣',
        name: 'Commercial',
        description: 'Direct, persuasif, focus vente',
        presets: { politeness: 'informal', emojiLevel: 'high', slangLevel: 'low', humorLevel: 'low' }
    },
    {
        id: 'local',
        icon: '🗣️',
        name: 'Local / Ivoirien',
        description: 'Expressions locales, très décontracté',
        presets: { politeness: 'informal', emojiLevel: 'high', slangLevel: 'high', humorLevel: 'high' }
    }
];

export default function SettingsPersonality({ config, setConfig }: SettingsPersonalityProps) {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-8">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 uppercase tracking-wider text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500"></span> Style de Communication
            </h2>
            <p className="text-[#888] text-sm mb-6">Choisissez comment votre assistant s'adresse aux clients.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COMMUNICATION_STYLES.map(style => {
                    const isActive = config.persona === style.id;
                    return (
                        <button
                            key={style.id}
                            onClick={() => setConfig({
                                ...config,
                                persona: style.id,
                                ...style.presets // Apply all presets at once
                            })}
                            className={`relative p-5 rounded-xl border text-left transition-all group ${isActive
                                ? 'bg-[#00D97E]/10 border-[#00D97E]/50 ring-2 ring-[#00D97E]/30'
                                : 'bg-[#111] border-[#1a1a1a] hover:bg-[#1a1a1a] hover:border-[#333]'
                                }`}
                        >
                            {/* Selection Indicator */}
                            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-[#00D97E] bg-[#00D97E]' : 'border-zinc-600'
                                }`}>
                                {isActive && <CheckCircle size={12} className="text-white" />}
                            </div>

                            {/* Recommended Badge */}
                            {'recommended' in style && style.recommended && (
                                <div className="absolute top-4 left-4 text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                    Recommandé
                                </div>
                            )}

                            {/* Content */}
                            <div className="flex items-center gap-4 mt-2">
                                <span className="text-3xl">{style.icon}</span>
                                <div>
                                    <div className="font-bold text-white text-base">{style.name}</div>
                                    <div className="text-xs text-[#888] mt-1">{style.description}</div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
