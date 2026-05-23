import { Handshake } from 'lucide-react';
import type { SettingsConfig } from '../../types';

interface SettingsTogglesProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

export default function SettingsToggles({ config, setConfig }: SettingsTogglesProps) {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-5 md:p-8">
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                <span className="w-2 h-2 rounded-full bg-[#00D97E]"></span> Options Rapides
            </h2>
            <div className="space-y-4">
                {/* Negotiation Switch */}
                <div className="flex items-center justify-between bg-black border border-[#1a1a1a] p-4 rounded-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#00D97E]/10 flex items-center justify-center text-[#00D97E]">
                            <Handshake size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-white text-sm">Négociation</div>
                            <div className="text-xs text-[#888]">Autoriser l&apos;IA à négocier les prix dans une limite raisonnable</div>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.negotiationEnabled}
                            onChange={e => setConfig({ ...config, negotiationEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[#333] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00D97E]"></div>
                    </label>
                </div>


            </div>
        </div>
    );
}
