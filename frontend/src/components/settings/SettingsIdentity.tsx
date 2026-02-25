import type { SettingsConfig } from '../../types';

interface SettingsIdentityProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

export default function SettingsIdentity({ config, setConfig }: SettingsIdentityProps) {
    return (
        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Identité de l'Assistant
            </h2>

            <div className="flex items-start gap-6">
                {/* Avatar Preview */}
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg shrink-0">
                    {config.botName?.substring(0, 1) || 'A'}
                </div>

                {/* Name & Greeting */}
                <div className="flex-1 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Nom de l'Assistant</label>
                        <input
                            type="text"
                            value={config.botName}
                            onChange={e => setConfig({ ...config, botName: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-lg font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                            placeholder="Ex: Awa, Koffi, Maya..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Message d'accueil</label>
                        <input
                            type="text"
                            value={config.greeting}
                            onChange={e => setConfig({ ...config, greeting: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                            placeholder="Bonjour ! Comment puis-je vous aider ?"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
