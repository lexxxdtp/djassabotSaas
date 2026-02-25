import { Bot } from 'lucide-react';
import type { SettingsConfig } from '../../types';

interface SettingsAdvancedProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

export default function SettingsAdvanced({ config, setConfig }: SettingsAdvancedProps) {
    return (
        <details className="group">
            <summary className="bg-[#0a0c10] border border-white/5 rounded-xl p-6 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Options Avancées</span>
                </div>
                <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
            </summary>

            <div className="mt-4 space-y-6">
                {/* Instructions Personnalisées */}
                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <Bot size={16} className="text-zinc-400" /> Instructions Personnalisées
                    </h3>
                    <p className="text-xs text-zinc-500 mb-4">Donnez des ordres spécifiques à l'IA (ex: "Ne jamais donner le prix sans demander la taille")</p>
                    <textarea
                        value={config.systemInstructions}
                        onChange={e => setConfig({ ...config, systemInstructions: e.target.value })}
                        rows={6}
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 leading-relaxed font-mono text-xs"
                        placeholder="Ex: Sois toujours très poli. Ne propose pas de réduction si le client n'insiste pas."
                    />
                </div>

                {/* Training Examples */}
                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span> Questions d'Entraînement
                    </h3>
                    <p className="text-xs text-zinc-500 mb-6">Ajoutez des exemples de questions/réponses pour aider l'IA à comprendre votre style.</p>

                    <div className="space-y-3">
                        {/* Headers */}
                        <div className="flex gap-4 px-2">
                            <div className="flex-1 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Question Client</div>
                            <div className="flex-1 text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Réponse Attendue</div>
                            <div className="w-6"></div>
                        </div>

                        {(config.trainingExamples || []).map((example, index) => {
                            const placeholders = [
                                { q: "Ex: C'est combien ?", a: "Ex: 5000 FCFA" },
                                { q: "Ex: Vous livrez à Cocody ?", a: "Ex: Oui, 1500 FCFA pour la livraison." },
                                { q: "Ex: Vous avez d'autres couleurs ?", a: "Ex: Oui, nous avons du bleu et du rouge." }
                            ];
                            const ph = placeholders[index % placeholders.length];

                            return (
                                <div key={index} className="flex gap-4 items-start group/item">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={example.question}
                                            onChange={e => {
                                                const newExamples = [...(config.trainingExamples || [])];
                                                newExamples[index].question = e.target.value;
                                                setConfig({ ...config, trainingExamples: newExamples });
                                            }}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-blue-500 outline-none placeholder:text-zinc-600"
                                            placeholder={ph.q}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            value={example.answer}
                                            onChange={e => {
                                                const newExamples = [...(config.trainingExamples || [])];
                                                newExamples[index].answer = e.target.value;
                                                setConfig({ ...config, trainingExamples: newExamples });
                                            }}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:border-blue-500 outline-none placeholder:text-zinc-600"
                                            placeholder={ph.a}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const newExamples = (config.trainingExamples || []).filter((_, i) => i !== index);
                                            setConfig({ ...config, trainingExamples: newExamples });
                                        }}
                                        className="w-6 h-[42px] flex items-center justify-center text-zinc-600 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}

                        <button
                            onClick={() => setConfig({
                                ...config,
                                trainingExamples: [...(config.trainingExamples || []), { question: '', answer: '' }]
                            })}
                            className="w-full py-3 border border-dashed border-zinc-700 hover:border-blue-500 hover:text-blue-400 text-zinc-500 text-sm font-medium rounded-lg transition-all border-2"
                        >
                            + Ajouter un exemple
                        </button>
                    </div>
                </div>
            </div>
        </details>
    );
}
