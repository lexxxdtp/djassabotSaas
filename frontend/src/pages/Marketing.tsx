
import { useState } from 'react';
import { Megaphone, Users, Calendar, Send, Sparkles, Tag, MessageCircle } from 'lucide-react';

export default function MarketingTools() {
    const [activeTab, setActiveTab] = useState<'broadcast' | 'coupons'>('broadcast');

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Outils Marketing 🚀</h1>
                <p className="text-zinc-500">Boostez vos ventes en relançant vos clients automatiquement.</p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center space-x-4 hover:border-orange-500/30 transition-colors">
                    <div className="p-3 bg-orange-500/10 rounded-xl text-orange-500 border border-orange-500/20">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Audience Totale</p>
                        <h3 className="text-2xl font-bold text-white font-mono">1,240</h3>
                        <p className="text-xs text-emerald-500 font-bold">+12 cette semaine</p>
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center space-x-4 hover:border-orange-500/30 transition-colors">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
                        <MessageCircle size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Campagnes Envoyées</p>
                        <h3 className="text-2xl font-bold text-white font-mono">8</h3>
                        <p className="text-xs text-zinc-500">Dernière: Promo Tabaski</p>
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center space-x-4 hover:border-orange-500/30 transition-colors">
                    <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 border border-purple-500/20">
                        <Tag size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Coupons Actifs</p>
                        <h3 className="text-2xl font-bold text-white font-mono">3</h3>
                        <p className="text-xs text-zinc-500">145 utilisations</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-zinc-800 pb-1">
                <button
                    onClick={() => setActiveTab('broadcast')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative ${activeTab === 'broadcast' ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <Megaphone size={18} />
                        <span>Diffusion (Broadcast)</span>
                    </div>
                    {activeTab === 'broadcast' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('coupons')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative ${activeTab === 'coupons' ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <Tag size={18} />
                        <span>Codes Promo</span>
                    </div>
                    {activeTab === 'coupons' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500" />
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Action Form */}
                <div className="lg:col-span-2 space-y-6">
                    {activeTab === 'broadcast' ? (
                        <BroadcastForm />
                    ) : (
                        <CouponForm />
                    )}
                </div>

                {/* Right Column: Preview / Helper */}
                <div className="space-y-6">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                            <Sparkles className="text-amber-400" size={18} />
                            <span>Conseil IA du Jour</span>
                        </h3>
                        <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                            "Vos clients achètent souvent des <strong className="text-white">robes</strong> le vendredi.
                            Programmez une diffusion ce jeudi soir à 18h pour maximiser vos ventes ce weekend !"
                        </p>
                        <button className="w-full py-3 bg-orange-500/10 text-orange-500 rounded-lg text-sm font-bold uppercase tracking-wide hover:bg-orange-500/20 transition-colors border border-orange-500/20">
                            Utiliser ce conseil
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BroadcastForm() {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
                CRÉER UNE CAMPAGNE
            </h2>

            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Message</label>
                <textarea
                    rows={4}
                    placeholder="Salut 👋 ! Nouvelle collection disponible. Profitez de -10% ce weekend !"
                    className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-white focus:border-orange-500 outline-none resize-none placeholder:text-zinc-700 transition-colors"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Envoyer à</label>
                    <select className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:border-orange-500 outline-none">
                        <option>Tous les clients (1,240)</option>
                        <option>Clients VIP (&gt; 100k FCFA)</option>
                        <option>Nouveaux clients (30 jours)</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Planifier pour</label>
                    <div className="relative group">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors" size={18} />
                        <input
                            type="datetime-local"
                            className="w-full bg-black border border-zinc-800 rounded-xl p-3 pl-10 text-white focus:border-orange-500 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="p-8 bg-black/50 rounded-xl border border-dashed border-zinc-800 flex items-center justify-center text-zinc-500 cursor-pointer hover:border-orange-500 hover:text-orange-500 transition-all group">
                <span className="group-hover:scale-105 transition-transform font-medium">+ Ajouter une image ou vidéo</span>
            </div>

            <div className="flex justify-end pt-2">
                <button className="flex items-center space-x-2 bg-white hover:bg-zinc-200 text-black px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-white/5 transition-all uppercase tracking-wide">
                    <Send size={18} />
                    <span>Envoyer la campagne</span>
                </button>
            </div>
        </div>
    );
}

function CouponForm() {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                GÉNÉRER UN CODE PROMO
            </h2>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Code (ex: PROMO10)</label>
                    <input
                        type="text"
                        placeholder="SUMMER2024"
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:border-purple-500 outline-none uppercase font-mono placeholder:text-zinc-700"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Réduction</label>
                    <div className="flex">
                        <input
                            type="number"
                            placeholder="10"
                            className="w-full bg-black border border-zinc-800 rounded-l-xl p-3 text-white focus:border-purple-500 outline-none placeholder:text-zinc-700"
                        />
                        <select className="bg-zinc-800 border border-zinc-800 rounded-r-xl px-3 text-white outline-none font-bold">
                            <option>%</option>
                            <option>FCFA</option>
                        </select>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Limite d'utilisation</label>
                <select className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:border-purple-500 outline-none">
                    <option>Illimité</option>
                    <option>1 fois par client</option>
                    <option>100 premiers clients</option>
                </select>
            </div>

            <div className="flex justify-end pt-2">
                <button className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-500 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-purple-600/20 transition-all uppercase tracking-wide">
                    <Tag size={18} />
                    <span>Créer le coupon</span>
                </button>
            </div>
        </div>
    );
}
