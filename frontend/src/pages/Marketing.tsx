
import { useState } from 'react';
import { Megaphone, Users, Calendar, Send, Sparkles, Tag, MessageCircle, ShoppingCart, TimerReset, Clock } from 'lucide-react';

export default function MarketingTools() {
    const [activeTab, setActiveTab] = useState<'broadcast' | 'coupons' | 'abandoned'>('broadcast');

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
                        <h3 className="text-2xl font-bold text-white font-mono">0</h3>
                        <p className="text-xs text-zinc-600 font-bold">-- cette semaine</p>
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center space-x-4 hover:border-orange-500/30 transition-colors">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
                        <MessageCircle size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Campagnes Envoyées</p>
                        <h3 className="text-2xl font-bold text-white font-mono">0</h3>
                        <p className="text-xs text-zinc-500">Aucune campagne</p>
                    </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center space-x-4 hover:border-orange-500/30 transition-colors">
                    <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 border border-rose-500/20">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Paniers Sauvés</p>
                        <h3 className="text-2xl font-bold text-white font-mono">0</h3>
                        <p className="text-xs text-zinc-600 font-bold">0 FCFA</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-zinc-800 pb-1 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('broadcast')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === 'broadcast' ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <Megaphone size={18} />
                        <span>Diffusion</span>
                    </div>
                    {activeTab === 'broadcast' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('coupons')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === 'coupons' ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <Tag size={18} />
                        <span>Codes Promo</span>
                    </div>
                    {activeTab === 'coupons' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-orange-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('abandoned')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === 'abandoned' ? 'text-orange-500' : 'text-zinc-500 hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <TimerReset size={18} />
                        <span>Paniers Abandonnés</span>
                    </div>
                    {activeTab === 'abandoned' && (
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
                    ) : activeTab === 'coupons' ? (
                        <CouponForm />
                    ) : (
                        <AbandonedCartsView />
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
                            L'IA analysera vos données de vente pour vous proposer des conseils personnalisés une fois que vous aurez plus d'activité.
                        </p>
                        <button className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-lg text-sm font-bold uppercase tracking-wide cursor-not-allowed border border-zinc-800">
                            En Attente de Données
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
                        <option>Tous les clients (0)</option>
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

function AbandonedCartsView() {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <div className="w-1 h-6 bg-rose-500 rounded-full"></div>
                    RELANCE AUTOMATIQUE
                </h2>
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-bold border border-emerald-500/20 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                    ACTIF
                </span>
            </div>

            <div className="bg-black/50 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-zinc-800 rounded-lg text-zinc-400">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Règle de relance</h3>
                        <p className="text-zinc-500 text-xs mt-1">
                            Si un client ajoute des articles au panier mais ne valide pas après <strong className="text-white">30 minutes</strong>, le bot envoie un message de rappel amical.
                        </p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Délai (min)</label>
                        <input type="number" value="30" disabled className="bg-zinc-900 text-zinc-400 px-3 py-2 rounded-lg text-sm w-full border border-zinc-800" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Message</label>
                        <input type="text" value="👋 Vous avez oublié quelque chose ?" disabled className="bg-zinc-900 text-zinc-400 px-3 py-2 rounded-lg text-sm w-full border border-zinc-800" />
                    </div>
                </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mt-6 mb-3">Dernières Relances</h3>
            <div className="space-y-3">
                <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                    <p className="text-zinc-500 text-sm">Aucune relance effectuée pour le moment.</p>
                </div>
            </div>
        </div>
    );
}



