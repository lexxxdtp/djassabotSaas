import type { SettingsConfig } from '../../types';

interface SettingsIdentityProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

export default function SettingsIdentity({ config, setConfig }: SettingsIdentityProps) {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                <span className="w-2 h-2 rounded-full bg-[#00D97E]"></span> Identité de l'Assistant
            </h2>

            <div className="flex items-start gap-6">
                {/* Avatar Preview */}
                <div className="w-20 h-20 rounded-2xl bg-[#00D97E] flex items-center justify-center text-black font-bold text-3xl shrink-0">
                    {config.botName?.substring(0, 1) || 'A'}
                </div>

                {/* Name & Greeting */}
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-[#888] mb-2 uppercase tracking-wide">Nom de l'Assistant</label>
                        <input
                            type="text"
                            value={config.botName}
                            onChange={e => setConfig({ ...config, botName: e.target.value })}
                            className="w-full bg-white/5 border border-[#1a1a1a] rounded-lg p-3 text-white text-lg font-bold focus:border-[#00D97E] outline-none transition-all placeholder:text-[#555]"
                            placeholder="Ex: Awa, Koffi, Maya..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-[#888] mb-2 uppercase tracking-wide">Message d'accueil</label>
                        <input
                            type="text"
                            value={config.greeting}
                            onChange={e => setConfig({ ...config, greeting: e.target.value })}
                            className="w-full bg-white/5 border border-[#1a1a1a] rounded-lg p-3 text-white focus:border-[#00D97E] outline-none transition-all placeholder:text-[#555]"
                            placeholder="Bonjour ! Comment puis-je vous aider ?"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
