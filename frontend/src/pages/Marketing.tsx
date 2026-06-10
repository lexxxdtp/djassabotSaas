
import { useEffect, useState } from 'react';
import { Megaphone, Users, Send, Sparkles, Tag, MessageCircle, ShoppingCart, TimerReset, Clock, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { apiClient } from '../utils/apiClient';

export default function MarketingTools() {
    const [activeTab, setActiveTab] = useState<'broadcast' | 'coupons' | 'abandoned'>('broadcast');
    const [totalAudience, setTotalAudience] = useState<number | null>(null);

    useEffect(() => {
        apiClient('/marketing/audience')
            .then(r => (r.ok ? r.json() : null))
            .then(data => data && setTotalAudience(data.all))
            .catch(() => { /* compteur facultatif */ });
    }, []);

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Outils Marketing 🚀</h1>
                <p className="text-[#888]">Boostez vos ventes en relançant vos clients automatiquement.</p>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl flex items-center space-x-4 hover:border-[#00D97E]/20 transition-colors">
                    <div className="p-3 bg-[#00D97E]/10 rounded-xl text-[#00D97E] border border-[#00D97E]/20">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-[#888] text-xs font-bold uppercase tracking-wider">Audience Totale</p>
                        <h3 className="text-2xl font-bold text-white font-mono">{totalAudience ?? '—'}</h3>
                        <p className="text-xs text-[#888] font-bold">clients ayant écrit au bot</p>
                    </div>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl flex items-center space-x-4 hover:border-[#00D97E]/20 transition-colors">
                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 border border-blue-500/20">
                        <MessageCircle size={24} />
                    </div>
                    <div>
                        <p className="text-[#888] text-xs font-bold uppercase tracking-wider">Campagnes Envoyées</p>
                        <h3 className="text-2xl font-bold text-white font-mono">0</h3>
                        <p className="text-xs text-[#888]">Aucune campagne</p>
                    </div>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] p-6 rounded-2xl flex items-center space-x-4 hover:border-[#00D97E]/20 transition-colors">
                    <div className="p-3 bg-rose-500/10 rounded-xl text-rose-500 border border-rose-500/20">
                        <ShoppingCart size={24} />
                    </div>
                    <div>
                        <p className="text-[#888] text-xs font-bold uppercase tracking-wider">Paniers Sauvés</p>
                        <h3 className="text-2xl font-bold text-white font-mono">0</h3>
                        <p className="text-xs text-[#555] font-bold">0 FCFA</p>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex space-x-6 border-b border-[#1a1a1a] pb-1 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('broadcast')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === 'broadcast' ? 'text-[#00D97E]' : 'text-[#888] hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <Megaphone size={18} />
                        <span>Diffusion</span>
                    </div>
                    {activeTab === 'broadcast' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00D97E]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('coupons')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === 'coupons' ? 'text-[#00D97E]' : 'text-[#888] hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <Tag size={18} />
                        <span>Codes Promo</span>
                    </div>
                    {activeTab === 'coupons' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00D97E]" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('abandoned')}
                    className={`pb-3 px-2 text-sm font-bold uppercase tracking-wide transition-all relative whitespace-nowrap ${activeTab === 'abandoned' ? 'text-[#00D97E]' : 'text-[#888] hover:text-white'}`}
                >
                    <div className="flex items-center space-x-2">
                        <TimerReset size={18} />
                        <span>Paniers Abandonnés</span>
                    </div>
                    {activeTab === 'abandoned' && (
                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#00D97E]" />
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
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                            <Sparkles className="text-amber-400" size={18} />
                            <span>Conseil IA du Jour</span>
                        </h3>
                        <p className="text-[#888] text-sm leading-relaxed mb-6">
                            L'IA analysera vos données de vente pour vous proposer des conseils personnalisés une fois que vous aurez plus d'activité.
                        </p>
                        <button className="w-full py-3 bg-zinc-800 text-[#888] rounded-lg text-sm font-bold uppercase tracking-wide cursor-not-allowed border border-zinc-800">
                            En Attente de Données
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function BroadcastForm() {
    const [message, setMessage] = useState('');
    const [audience, setAudience] = useState<'all' | 'vip' | 'recent'>('all');
    const [counts, setCounts] = useState<{ all: number; vip: number; recent: number } | null>(null);
    const [sending, setSending] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        apiClient('/marketing/audience')
            .then(r => (r.ok ? r.json() : null))
            .then(data => data && setCounts(data))
            .catch(() => { /* silencieux : compteurs facultatifs */ });
    }, []);

    const audienceCount = counts ? counts[audience] : null;

    const handleSend = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        setFeedback(null);
        try {
            const res = await apiClient('/marketing/broadcast', {
                method: 'POST',
                body: JSON.stringify({ message: message.trim(), audience }),
            });
            const data = await res.json();
            if (res.ok) {
                setFeedback({ type: 'success', text: `Campagne lancée ! Envoi en cours à ${data.queued} client(s).` });
                setMessage('');
            } else {
                setFeedback({ type: 'error', text: data.error || "Erreur lors de l'envoi." });
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erreur réseau. Vérifiez votre connexion.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-[#00D97E] rounded-full"></div>
                CRÉER UNE CAMPAGNE
            </h2>

            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Message</label>
                <textarea
                    rows={4}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    maxLength={4000}
                    placeholder="Salut 👋 ! Nouvelle collection disponible. Profitez de -10% ce weekend !"
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl p-4 text-white focus:border-[#00D97E] outline-none resize-none placeholder:text-[#555] transition-colors"
                />
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Envoyer à</label>
                <select
                    value={audience}
                    onChange={e => setAudience(e.target.value as 'all' | 'vip' | 'recent')}
                    className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white focus:border-[#00D97E] outline-none"
                >
                    <option value="all">Tous les clients{counts ? ` (${counts.all})` : ''}</option>
                    <option value="vip">Clients VIP &gt; 100k FCFA{counts ? ` (${counts.vip})` : ''}</option>
                    <option value="recent">Clients actifs (30 jours){counts ? ` (${counts.recent})` : ''}</option>
                </select>
            </div>

            {feedback && (
                <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium ${feedback.type === 'success'
                    ? 'bg-[#00D97E]/10 border-[#00D97E]/30 text-[#00D97E]'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span>{feedback.text}</span>
                </div>
            )}

            <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-[#555]">
                    Les messages partent un par un (2-5s d'écart) pour protéger votre numéro WhatsApp.
                </p>
                <button
                    onClick={handleSend}
                    disabled={sending || !message.trim() || audienceCount === 0}
                    className="flex items-center space-x-2 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-[#666] disabled:cursor-not-allowed text-black px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-white/5 transition-all uppercase tracking-wide"
                >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    <span>{sending ? 'Envoi…' : 'Envoyer la campagne'}</span>
                </button>
            </div>
        </div>
    );
}

function CouponForm() {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 space-y-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <div className="w-1 h-6 bg-[#00D97E] rounded-full"></div>
                GÉNÉRER UN CODE PROMO
            </h2>

            <div className="grid grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Code (ex: PROMO10)</label>
                    <input
                        type="text"
                        placeholder="SUMMER2024"
                        className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-white focus:border-[#00D97E] outline-none uppercase font-mono placeholder:text-[#444]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Réduction</label>
                    <div className="flex">
                        <input
                            type="number"
                            placeholder="10"
                            className="w-full bg-black border border-[#1a1a1a] rounded-l-xl p-3 text-white focus:border-[#00D97E] outline-none placeholder:text-[#555]"
                        />
                        <select className="bg-[#111] border border-[#1a1a1a] rounded-r-xl px-3 text-white outline-none font-bold">
                            <option>%</option>
                            <option>FCFA</option>
                        </select>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Limite d'utilisation</label>
                <select className="w-full bg-black border border-[#1a1a1a] rounded-xl p-3 text-white focus:border-[#00D97E] outline-none">
                    <option>Illimité</option>
                    <option>1 fois par client</option>
                    <option>100 premiers clients</option>
                </select>
            </div>

            <div className="flex justify-end pt-2">
                <button className="flex items-center space-x-2 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-[#00D97E]/20 transition-all uppercase tracking-wide">
                    <Tag size={18} />
                    <span>Créer le coupon</span>
                </button>
            </div>
        </div>
    );
}

function AbandonedCartsView() {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 space-y-6">
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

            <div className="bg-black/50 border border-[#1a1a1a] rounded-xl p-4">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-white/5 rounded-lg text-[#888]">
                        <Clock size={24} />
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-sm">Règle de relance</h3>
                        <p className="text-[#888] text-xs mt-1">
                            Si un client ajoute des articles au panier mais ne valide pas après <strong className="text-white">30 minutes</strong>, le bot envoie un message de rappel amical.
                        </p>
                    </div>
                </div>
                <div className="mt-4 pt-4 border-t border-[#1a1a1a] grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Délai (min)</label>
                        <input type="number" value="30" disabled className="bg-[#111] text-[#888] px-3 py-2 rounded-lg text-sm w-full border border-[#1a1a1a]" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#888] mb-1">Message</label>
                        <input type="text" value="👋 Vous avez oublié quelque chose ?" disabled className="bg-[#111] text-[#888] px-3 py-2 rounded-lg text-sm w-full border border-[#1a1a1a]" />
                    </div>
                </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-[#888] mt-6 mb-3">Dernières Relances</h3>
            <div className="space-y-3">
                <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                    <p className="text-[#888] text-sm">Aucune relance effectuée pour le moment.</p>
                </div>
            </div>
        </div>
    );
}



