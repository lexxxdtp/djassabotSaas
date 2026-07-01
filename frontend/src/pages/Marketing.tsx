import { useEffect, useState } from 'react';
import {
    Users,
    Send,
    Sparkles,
    ShoppingCart,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    Crown,
    Clock,
    X,
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';

export type Audience = 'all' | 'vip' | 'recent';
export interface AudienceCounts { all: number; vip: number; recent: number }
export interface CampaignStats { campaigns: number; sent: number; lastCampaignAt: string | null }
export interface MarketingFeedback { type: 'success' | 'error'; text: string }

export default function MarketingTools() {
    const [counts, setCounts] = useState<AudienceCounts | null>(null);
    const [stats, setStats] = useState<CampaignStats | null>(null);
    const [message, setMessage] = useState('');
    const [audience, setAudience] = useState<Audience>('all');
    const [sending, setSending] = useState(false);
    const [feedback, setFeedback] = useState<MarketingFeedback | null>(null);

    useEffect(() => {
        apiClient('/marketing/audience')
            .then(r => (r.ok ? r.json() : null))
            .then(data => data && setCounts(data))
            .catch(() => { /* compteurs facultatifs */ });
        apiClient('/marketing/stats')
            .then(r => (r.ok ? r.json() : null))
            .then(data => data && setStats(data))
            .catch(() => { /* compteurs facultatifs */ });
    }, []);

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
                apiClient('/marketing/stats')
                    .then(r => (r.ok ? r.json() : null))
                    .then(d => d && setStats(d))
                    .catch(() => { /* rafraîchissement facultatif */ });
            } else {
                setFeedback({ type: 'error', text: data.error || 'Erreur lors de l\'envoi.' });
            }
        } catch {
            setFeedback({ type: 'error', text: 'Erreur réseau. Vérifiez votre connexion.' });
        } finally {
            setSending(false);
        }
    };

    return (
        <MarketingView
            counts={counts}
            stats={stats}
            message={message}
            onMessageChange={setMessage}
            audience={audience}
            onAudienceChange={setAudience}
            sending={sending}
            feedback={feedback}
            onSend={handleSend}
        />
    );
}

// ---------- PRESENTATIONAL VIEW (réutilisée par la preview) ----------

export interface MarketingViewProps {
    counts: AudienceCounts | null;
    stats: CampaignStats | null;
    message: string;
    onMessageChange: (value: string) => void;
    audience: Audience;
    onAudienceChange: (value: Audience) => void;
    sending: boolean;
    feedback: MarketingFeedback | null;
    onSend: () => Promise<void> | void;
}

const AUDIENCE_OPTIONS: { key: Audience; label: string; desc: string; icon: React.ElementType }[] = [
    { key: 'all', label: 'Tous mes clients', desc: 'Tous ceux qui ont déjà écrit au bot', icon: Users },
    { key: 'vip', label: 'Clients VIP', desc: 'Plus de 100 000 F d\'achats', icon: Crown },
    { key: 'recent', label: 'Clients récents', desc: 'Actifs ces 30 derniers jours', icon: Clock },
];

export const MarketingView: React.FC<MarketingViewProps> = ({
    counts, stats, message, onMessageChange, audience, onAudienceChange,
    sending, feedback, onSend,
}) => {
    const [confirmOpen, setConfirmOpen] = useState(false);

    const audienceCount = counts ? counts[audience] : null;
    const audienceLabel = AUDIENCE_OPTIONS.find(o => o.key === audience)?.label || '';
    const canSend = !sending && message.trim().length > 0 && audienceCount !== 0;

    const handleConfirm = async () => {
        await onSend();
        setConfirmOpen(false);
    };

    const anim = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both';
    const delay = (i: number): React.CSSProperties => ({ animationDuration: '450ms', animationDelay: `${i * 60}ms` });

    return (
        <div className="space-y-5 pb-4">
            {/* HEADER */}
            <div className={anim} style={delay(0)}>
                <h1 className="text-2xl font-bold text-white tracking-tight">Marketing</h1>
                <p className="text-[#888] text-sm mt-0.5">Relancez vos clients, boostez vos ventes.</p>
            </div>

            {/* HERO — AUDIENCE (audience forward, façon Wave) */}
            <div className={`bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 ${anim}`} style={delay(1)}>
                <p className="text-[#888] text-sm">Votre audience</p>
                {counts ? (
                    <p className="text-[38px] leading-none font-bold text-white tracking-tight tabular-nums mt-2">
                        {counts.all.toLocaleString('fr-FR')}
                        <span className="text-lg text-[#888] font-semibold ml-1.5">client{counts.all > 1 ? 's' : ''}</span>
                    </p>
                ) : (
                    <div className="h-[38px] w-28 bg-[#1a1a1a] rounded-lg animate-pulse mt-2" aria-hidden="true" />
                )}
                <p className="text-sm text-[#888] mt-3">
                    {stats && stats.campaigns > 0 ? (
                        <>
                            <span className="text-white font-semibold">{stats.campaigns}</span> campagne{stats.campaigns > 1 ? 's' : ''}
                            <span className="text-[#555]"> · </span>
                            <span className="text-white font-semibold">{stats.sent}</span> message{stats.sent > 1 ? 's' : ''} envoyé{stats.sent > 1 ? 's' : ''}
                            {stats.lastCampaignAt && <span className="text-[#555]"> · dernière il y a {timeAgo(new Date(stats.lastCampaignAt))}</span>}
                        </>
                    ) : (
                        'Ce sont les clients qui ont parlé à votre bot. Envoyez-leur votre première promo.'
                    )}
                </p>
            </div>

            {/* COMPOSER — ENVOYER UNE PROMO */}
            <section className={anim} style={delay(2)}>
                <h2 className="text-[15px] font-semibold text-white mb-3">Envoyer une promo</h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-4">
                    <div>
                        <label htmlFor="mk-message" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Votre message</label>
                        <textarea
                            id="mk-message"
                            rows={4}
                            value={message}
                            onChange={e => onMessageChange(e.target.value)}
                            maxLength={4000}
                            placeholder="Salut 👋 ! Nouvel arrivage disponible. Profitez de -10% ce weekend !"
                            className="w-full bg-black border border-[#1a1a1a] rounded-xl p-4 text-white text-sm focus:border-[#00D97E] focus:ring-2 focus:ring-[#00D97E]/10 outline-none resize-none placeholder:text-[#555] transition-colors"
                        />
                        <div className="flex justify-end mt-1">
                            <span className="text-[11px] text-[#555] tabular-nums">{message.length}/4000</span>
                        </div>
                    </div>

                    <div role="radiogroup" aria-label="Choisir les destinataires">
                        <p className="text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Qui va le recevoir ?</p>
                        <div className="space-y-2">
                            {AUDIENCE_OPTIONS.map(opt => {
                                const selected = audience === opt.key;
                                const count = counts ? counts[opt.key] : null;
                                return (
                                    <button
                                        key={opt.key}
                                        type="button"
                                        role="radio"
                                        aria-checked={selected}
                                        onClick={() => onAudienceChange(opt.key)}
                                        className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-[transform,border-color,background-color] active:scale-[0.99] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none ${selected ? 'bg-[#00D97E]/5 border-[#00D97E]/40' : 'bg-black border-[#1a1a1a]'}`}
                                    >
                                        <div className={`p-2 rounded-lg shrink-0 ${selected ? 'bg-[#00D97E]/10 text-[#00D97E]' : 'bg-[#111] text-[#888]'}`}>
                                            <opt.icon className="w-4 h-4" aria-hidden="true" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-semibold ${selected ? 'text-white' : 'text-[#ccc]'}`}>{opt.label}</p>
                                            <p className="text-xs text-[#888] truncate">{opt.desc}</p>
                                        </div>
                                        <span className={`shrink-0 text-xs font-bold tabular-nums px-2.5 py-1 rounded-full border ${selected ? 'bg-[#00D97E]/10 text-[#00D97E] border-[#00D97E]/20' : 'bg-[#111] text-[#888] border-[#1a1a1a]'}`}>
                                            {count ?? '—'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {feedback && (
                        <div className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm font-medium ${feedback.type === 'success'
                            ? 'bg-[#00D97E]/10 border-[#00D97E]/30 text-[#00D97E]'
                            : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                            {feedback.type === 'success'
                                ? <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
                                : <AlertTriangle size={18} className="shrink-0" aria-hidden="true" />}
                            <span>{feedback.text}</span>
                        </div>
                    )}

                    <button
                        onClick={() => setConfirmOpen(true)}
                        disabled={!canSend}
                        className="w-full flex items-center justify-center gap-2 bg-[#00D97E] text-black disabled:bg-[#1a1a1a] disabled:text-[#666] disabled:cursor-not-allowed px-6 py-3.5 rounded-xl font-bold text-sm transition-[transform,background-color] active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none"
                    >
                        <Send size={16} aria-hidden="true" />
                        <span>Envoyer la promo</span>
                    </button>
                    <p className="text-xs text-[#555] text-center leading-relaxed">
                        Les messages partent un par un, en douceur, pour protéger votre numéro WhatsApp.
                    </p>
                </div>
            </section>

            {/* RELANCE AUTOMATIQUE DES PANIERS */}
            <section className={anim} style={delay(3)}>
                <h2 className="text-[15px] font-semibold text-white mb-3">Le bot relance tout seul</h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-[#00D97E]/10 text-[#00D97E] shrink-0">
                            <ShoppingCart className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-white text-sm font-bold">Paniers oubliés</p>
                                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00D97E]/10 border border-[#00D97E]/20 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#00D97E] animate-pulse" />
                                    <span className="text-[10px] font-bold text-[#00D97E]">ACTIF</span>
                                </span>
                            </div>
                            <p className="text-xs text-[#888] leading-relaxed mt-1">
                                Un client remplit son panier mais ne finit pas sa commande ? Le bot lui envoie un rappel amical après <strong className="text-white">30 minutes</strong>. Vous n'avez rien à faire.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CONSEILS */}
            <section className={anim} style={delay(4)}>
                <h2 className="text-[15px] font-semibold text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" aria-hidden="true" />
                    Conseils qui marchent
                </h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <ul className="text-[#888] text-sm leading-relaxed space-y-3">
                        <li><span className="text-white font-medium">Une seule offre par message.</span> « Bazin à -10% ce weekend » marche mieux qu'une liste.</li>
                        <li><span className="text-white font-medium">Le bon créneau.</span> Envoyez entre 18h et 21h, quand vos clients regardent leur téléphone.</li>
                        <li><span className="text-white font-medium">Citez un produit précis.</span> Le bot enverra sa photo si le client demande à voir.</li>
                        <li><span className="text-white font-medium">Pas plus d'une fois par semaine.</span> Pour ne pas lasser vos clients.</li>
                    </ul>
                </div>
            </section>

            {/* TIROIR DE CONFIRMATION */}
            {confirmOpen && (
                <div
                    className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                    onClick={() => { if (!sending) setConfirmOpen(false); }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Confirmer l'envoi de la campagne"
                        onClick={e => e.stopPropagation()}
                        className="bg-[#111] border-t md:border border-[#1a1a1a] rounded-t-3xl md:rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-[#1a1a1a] shrink-0">
                            <h3 className="text-white font-bold">Confirmer l'envoi</h3>
                            <button
                                onClick={() => { if (!sending) setConfirmOpen(false); }}
                                aria-label="Fermer le tiroir"
                                className="text-[#888] hover:text-white transition-colors bg-[#1a1a1a] p-1.5 rounded-full cursor-pointer"
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </div>

                        <div className="p-4 space-y-4 overflow-y-auto">
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-black border border-[#1a1a1a]">
                                <div className="p-2 rounded-lg bg-[#00D97E]/10 text-[#00D97E] shrink-0">
                                    <Users className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <p className="text-sm text-[#888]">
                                    <span className="text-white font-bold tabular-nums">{audienceCount ?? '?'}</span> client{(audienceCount ?? 0) > 1 ? 's' : ''}
                                    <span className="text-[#555]"> · </span>{audienceLabel}
                                </p>
                            </div>

                            <div>
                                <p className="text-[10px] uppercase tracking-widest text-[#555] font-bold mb-2">Votre message</p>
                                <div className="bg-black border border-[#1a1a1a] rounded-xl p-3.5 text-sm text-white whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                                    {message.trim()}
                                </div>
                            </div>

                            <p className="text-xs text-[#555] leading-relaxed">
                                Les messages partent un par un (2 à 5 s d'écart) pour protéger votre numéro WhatsApp. Vous pouvez continuer à utiliser l'appli pendant l'envoi.
                            </p>
                        </div>

                        <div className="p-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 shrink-0">
                            <button
                                onClick={handleConfirm}
                                disabled={sending}
                                className="w-full flex items-center justify-center gap-2 bg-[#00D97E] text-black disabled:opacity-60 disabled:cursor-not-allowed px-6 py-3.5 rounded-xl font-bold text-sm transition-[transform,background-color] active:scale-[0.98] cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none"
                            >
                                {sending
                                    ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                    : <Send size={16} aria-hidden="true" />}
                                <span>{sending ? 'Envoi en cours…' : 'Oui, envoyer'}</span>
                            </button>
                            <button
                                onClick={() => { if (!sending) setConfirmOpen(false); }}
                                disabled={sending}
                                className="w-full px-6 py-3 rounded-xl font-semibold text-sm text-[#888] hover:text-white transition-colors disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 outline-none"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------- HELPERS ----------

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}j`;
}
