import { Handshake } from 'lucide-react';
import type { SettingsConfig } from '../../types';

interface SettingsTogglesProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

export default function SettingsToggles({ config, setConfig }: SettingsTogglesProps) {
    return (
        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Options Rapides
            </h2>
            <div className="space-y-4">
                {/* Negotiation Switch */}
                <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-500">
                            <Handshake size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Négociation</div>
                            <div className="text-xs text-zinc-400">Autoriser l'IA à négocier les prix dans une limite raisonnable</div>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.negotiationEnabled}
                            onChange={e => setConfig({ ...config, negotiationEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                    </label>
                </div>


            </div>
        </div>
    );
}
