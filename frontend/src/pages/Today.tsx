import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Package,
    ArrowRight,
    Activity,
    Clock,
    CheckCircle2,
    WifiOff,
    CreditCard,
    Download,
    Share,
    TrendingUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';

interface Order {
    id: string;
    total: number;
    status: string;
    userId: string;
    items: unknown[];
    createdAt?: string;
    created_at?: string;
}

export interface Log {
    id: string;
    type: string;
    message: string;
    created_at: string;
}

// Événement PWA non encore standardisé dans les types DOM (Chrome/Android)
interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Today: React.FC = () => {
    const { token, user, tenant } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [botStatus, setBotStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [productCount, setProductCount] = useState<number | null>(null);
    const [botActive, setBotActive] = useState<boolean | null>(null);
    const [togglingBot, setTogglingBot] = useState(false);
    const [loading, setLoading] = useState(true);

    // PWA Installation states
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    useEffect(() => {
        // Check if already running in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone;
        const dismissed = sessionStorage.getItem('pwa-install-dismissed');

        if (!isStandalone && !dismissed) {
            setShowInstallBanner(true);
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setIsInstallable(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShowInstallBanner(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismissInstall = () => {
        sessionStorage.setItem('pwa-install-dismissed', 'true');
        setShowInstallBanner(false);
    };

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

    const hour = new Date().getHours();
    const isEvening = hour >= 18 || hour < 5;
    const displayName = user?.full_name?.split(' ')[0] || tenant?.name || user?.email?.split('@')[0] || 'Vendeur';
    const greeting = isEvening ? 'Bonsoir' : 'Bonjour';

    useEffect(() => {
        if (!token) return;

        const fetchAll = async () => {
            try {
                const [resOrders, resLogs, resWa, resSettings, resProducts] = await Promise.all([
                    apiClient('/orders'),
                    apiClient('/dashboard/pulse'),
                    apiClient('/whatsapp/status'),
                    apiClient('/settings'),
                    apiClient('/products?limit=1'),
                ]);
                if (resOrders.ok) setOrders(await resOrders.json());
                if (resLogs.ok) setLogs(await resLogs.json());
                if (resWa.ok) {
                    const data = await resWa.json();
                    setBotStatus(data.status || 'disconnected');
                }
                if (resSettings.ok) {
                    const s = await resSettings.json();
                    setBotActive(s.botActive ?? false);
                }
                if (resProducts.ok) {
                    const p = await resProducts.json();
                    setProductCount(typeof p.total === 'number' ? p.total : (Array.isArray(p) ? p.length : 0));
                }
            } catch (e) {
                console.error('Today fetch error', e);
            } finally {
                setLoading(false);
            }
        };

        fetchAll();
        const interval = setInterval(fetchAll, 15000);
        return () => clearInterval(interval);
    }, [token]);

    // --- DERIVED DATA ---
    const today = new Date();
    const { todayOrders, yesterdayOrders } = useMemo(() => {
        const now = new Date();
        const isSameDate = (a: Date, b: Date) =>
            a.getDate() === b.getDate() &&
            a.getMonth() === b.getMonth() &&
            a.getFullYear() === b.getFullYear();

        const yesterdayDate = new Date();
        yesterdayDate.setDate(now.getDate() - 1);

        const todayList = orders.filter(o => isSameDate(new Date(o.createdAt || o.created_at || 0), now));
        const yesterdayList = orders.filter(o => isSameDate(new Date(o.createdAt || o.created_at || 0), yesterdayDate));

        return { todayOrders: todayList, yesterdayOrders: yesterdayList };
    }, [orders]);

    const todayRevenue = todayOrders.reduce((s, o) => s + o.total, 0);
    const yesterdayRevenue = yesterdayOrders.reduce((s, o) => s + o.total, 0);
    const revenueDelta = yesterdayRevenue > 0
        ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        : null;

    const newOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const paidOrders = orders.filter(o => o.status === 'PAID' || o.status === 'SHIPPING');

    const lastSaleLog = logs.find(l => l.type === 'sale');
    const lastSaleAgo = lastSaleLog ? timeAgo(new Date(lastSaleLog.created_at)) : null;

    return (
        <TodayView
            greeting={greeting}
            displayName={displayName}
            dateStr={today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            botStatus={botStatus}
            botActive={botActive}
            togglingBot={togglingBot}
            loading={loading}
            newOrdersCount={newOrders.length}
            paidOrdersCount={paidOrders.length}
            productCount={productCount}
            logs={logs}
            lastSaleAgo={lastSaleAgo}
            todayRevenue={todayRevenue}
            todayOrdersCount={todayOrders.length}
            yesterdayOrdersCount={yesterdayOrders.length}
            revenueDelta={revenueDelta}
            showInstallBanner={showInstallBanner}
            isInstallable={isInstallable}
            isIOS={isIOS}
            onToggleBot={async () => {
                if (togglingBot || botActive === null) return;
                setTogglingBot(true);
                const next = !botActive;
                try {
                    const res = await apiClient('/settings', {
                        method: 'POST',
                        body: JSON.stringify({ botActive: next }),
                    });
                    if (res.ok) setBotActive(next);
                } catch (e) {
                    console.error('Toggle bot error', e);
                } finally {
                    setTogglingBot(false);
                }
            }}
            onInstall={handleInstallClick}
            onDismissInstall={handleDismissInstall}
        />
    );
};

// ---------- PRESENTATIONAL VIEW (réutilisée par la preview) ----------

export interface TodayViewProps {
    greeting: string;
    displayName: string;
    dateStr: string;
    botStatus: 'disconnected' | 'connecting' | 'connected';
    botActive: boolean | null;
    togglingBot: boolean;
    loading: boolean;
    newOrdersCount: number;
    paidOrdersCount: number;
    productCount: number | null;
    logs: Log[];
    lastSaleAgo: string | null;
    todayRevenue: number;
    todayOrdersCount: number;
    yesterdayOrdersCount: number;
    revenueDelta: number | null;
    showInstallBanner: boolean;
    isInstallable: boolean;
    isIOS: boolean;
    onToggleBot: () => void;
    onInstall: () => void;
    onDismissInstall: () => void;
}

export const TodayView: React.FC<TodayViewProps> = ({
    greeting, displayName, dateStr, botStatus, botActive, togglingBot, loading,
    newOrdersCount, paidOrdersCount, productCount, logs, lastSaleAgo,
    todayRevenue, todayOrdersCount, yesterdayOrdersCount, revenueDelta,
    showInstallBanner, isInstallable, isIOS, onToggleBot, onInstall, onDismissInstall,
}) => {
    const hasUrgentTasks = newOrdersCount > 0 || paidOrdersCount > 0;
    const notOperational = botStatus !== 'connected' || productCount === 0 || botActive === false;

    const anim = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both';
    const delay = (i: number): React.CSSProperties => ({ animationDuration: '450ms', animationDelay: `${i * 60}ms` });

    return (
        <div className="space-y-5 pb-4">
            {/* HEADER */}
            <div className={`flex items-start justify-between gap-3 ${anim}`} style={delay(0)}>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">{greeting}, {displayName}</h1>
                    <p className="text-[#888] text-sm mt-0.5 capitalize">{dateStr}</p>
                </div>
                <BotStatusBadge status={botStatus} paused={botActive === false} />
            </div>

            {/* HERO — VENTES DU JOUR (money forward, façon Wave) */}
            <div className={`relative overflow-hidden bg-[#111] border border-[#1a1a1a] rounded-3xl p-5 ${anim}`} style={delay(1)}>
                <p className="text-[#888] text-sm">Ventes aujourd'hui</p>
                <p className="text-[38px] leading-none font-bold text-white tracking-tight tabular-nums mt-2">
                    {todayRevenue.toLocaleString('fr-FR')}
                    <span className="text-lg text-[#888] font-semibold ml-1.5">FCFA</span>
                </p>
                <div className="flex items-center gap-3 mt-3 text-sm flex-wrap">
                    {revenueDelta !== null && (
                        <span className={`inline-flex items-center gap-1 font-semibold ${revenueDelta >= 0 ? 'text-[#00D97E]' : 'text-red-400'}`}>
                            <TrendingUp className={`w-4 h-4 ${revenueDelta < 0 ? 'rotate-180' : ''}`} />
                            {revenueDelta >= 0 ? '+' : ''}{revenueDelta}% <span className="text-[#888] font-normal">vs hier</span>
                        </span>
                    )}
                    <span className="text-[#888]">
                        {todayOrdersCount} commande{todayOrdersCount > 1 ? 's' : ''}
                        <span className="text-[#555]"> · {yesterdayOrdersCount} hier</span>
                    </span>
                </div>
            </div>

            {/* ALERTE BOT DÉCONNECTÉ */}
            {botStatus === 'disconnected' && !loading && (
                <Link
                    to="/dashboard/whatsapp"
                    className={`flex items-center justify-between gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 active:scale-[0.99] transition-transform ${anim}`}
                    style={delay(2)}
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400"><WifiOff className="w-5 h-5" /></div>
                        <div>
                            <p className="text-white text-sm font-bold">Le bot est déconnecté</p>
                            <p className="text-red-300/80 text-xs">Reconnectez WhatsApp pour reprendre les ventes.</p>
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-red-400 shrink-0" />
                </Link>
            )}

            {/* INTERRUPTEUR DU BOT */}
            {botActive !== null && botStatus !== 'disconnected' && (
                <div className={`flex items-center justify-between gap-4 p-4 rounded-2xl border ${botActive ? 'bg-[#00D97E]/5 border-[#00D97E]/20' : 'bg-amber-500/10 border-amber-500/20'} ${anim}`} style={delay(2)}>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 ${botActive ? 'bg-[#00D97E]/10 text-[#00D97E]' : 'bg-amber-500/20 text-amber-500'}`}>
                            <Activity className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-white text-sm font-bold">{botActive ? 'Le bot répond à vos clients' : 'Le bot est en pause'}</p>
                            <p className="text-xs text-[#888] leading-snug">
                                {botActive ? 'Il vend, négocie et prend les commandes tout seul.' : 'Il lit les messages mais ne répond pas tant que vous ne l\'activez pas.'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onToggleBot}
                        disabled={togglingBot}
                        className={`shrink-0 px-4 py-2.5 rounded-xl text-sm font-bold transition-transform active:scale-95 disabled:opacity-50 ${botActive ? 'bg-[#1a1a1a] text-[#888] hover:text-white' : 'bg-[#00D97E] text-black'}`}
                    >
                        {togglingBot ? '…' : botActive ? 'Pause' : 'Activer'}
                    </button>
                </div>
            )}

            {/* À FAIRE MAINTENANT */}
            <section className={anim} style={delay(3)}>
                <h2 className="text-[15px] font-semibold text-white mb-3">À faire maintenant</h2>

                {!hasUrgentTasks && !loading && notOperational ? (
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 space-y-1">
                        <p className="text-white font-medium text-sm mb-2">3 étapes pour que la boutique vende toute seule :</p>
                        {[
                            { done: botStatus === 'connected', label: 'Connecter votre WhatsApp', to: '/dashboard/whatsapp' },
                            { done: (productCount ?? 0) > 0, label: 'Ajouter un produit (une photo suffit)', to: '/dashboard/products' },
                            { done: botActive === true, label: 'Activer le bot', to: '/dashboard' },
                        ].map((item) => (
                            <Link key={item.label} to={item.to} className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${item.done ? 'opacity-60' : 'active:bg-[#1a1a1a]'}`}>
                                <span className={`flex items-center justify-center w-6 h-6 rounded-full border shrink-0 ${item.done ? 'bg-[#00D97E] border-[#00D97E] text-black' : 'border-[#333] text-transparent'}`}>
                                    <CheckCircle2 className="w-4 h-4" />
                                </span>
                                <span className={`text-sm ${item.done ? 'text-[#888] line-through' : 'text-white font-medium'}`}>{item.label}</span>
                                {!item.done && <ArrowRight className="w-4 h-4 text-[#00D97E] ml-auto shrink-0" />}
                            </Link>
                        ))}
                    </div>
                ) : !hasUrgentTasks ? (
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-[#00D97E] mx-auto mb-3" />
                        <p className="text-white font-medium">Rien à faire de votre côté.</p>
                        <p className="text-[#888] text-xs mt-1">Le bot gère tout. Profitez 🌴</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3">
                        {newOrdersCount > 0 && (
                            <TaskCard to="/dashboard/orders?filter=new" icon={Package} count={newOrdersCount} label={newOrdersCount > 1 ? 'commandes à confirmer' : 'commande à confirmer'} tone="warning" />
                        )}
                        {paidOrdersCount > 0 && (
                            <TaskCard to="/dashboard/orders?filter=paid" icon={CreditCard} count={paidOrdersCount} label={paidOrdersCount > 1 ? 'prêtes à livrer' : 'prête à livrer'} tone="primary" />
                        )}
                    </div>
                )}
            </section>

            {/* LE BOT TRAVAILLE */}
            <section className={anim} style={delay(4)}>
                <h2 className="text-[15px] font-semibold text-white mb-3">Le bot travaille</h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-1.5 text-[#888] text-xs mb-1.5"><Activity className="w-3.5 h-3.5" /> Activité</div>
                            <p className="text-2xl font-bold text-white">{logs.length}<span className="text-sm text-[#888] font-normal ml-2">actions</span></p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 text-[#888] text-xs mb-1.5"><Clock className="w-3.5 h-3.5" /> Dernière vente</div>
                            <p className="text-2xl font-bold text-white">{lastSaleAgo || <span className="text-[#555]">—</span>}</p>
                        </div>
                    </div>

                    {logs.length > 0 && (
                        <div className="mt-5 pt-4 border-t border-[#1a1a1a] space-y-2.5">
                            {logs.slice(0, 3).map(log => (
                                <div key={log.id} className="flex items-start gap-3 text-xs">
                                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${log.type === 'sale' ? 'bg-emerald-500' : log.type === 'warning' ? 'bg-amber-500' : log.type === 'action' ? 'bg-[#00D97E]' : 'bg-[#0EA5E9]'}`} />
                                    <p className="text-[#888] leading-relaxed">{log.message}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <Link to="/dashboard/inbox" className="mt-4 inline-flex items-center gap-1 text-xs text-[#00D97E]">
                        Voir les conversations <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <Link to="/dashboard/analytics" className="mt-3 inline-flex items-center gap-1 text-xs text-[#888] hover:text-white transition-colors">
                    Voir mes chiffres en détail <ArrowRight className="w-3 h-3" />
                </Link>
            </section>

            {/* INSTALLER L'APPLI */}
            {showInstallBanner && (
                <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-[#111] border border-[#1a1a1a]">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-xl bg-[#00D97E]/10 text-[#00D97E] shrink-0"><Download className="w-4 h-4" /></div>
                        <div className="min-w-0">
                            <p className="text-white text-sm font-bold">Installer l'appli sur l'écran d'accueil</p>
                            {isIOS ? (
                                <p className="text-xs text-[#888] flex items-center gap-1 flex-wrap">
                                    <Share className="w-3 h-3 shrink-0" />
                                    <span>Bouton <strong className="text-white">Partager</strong> → <strong className="text-white">Sur l'écran d'accueil</strong></span>
                                </p>
                            ) : (
                                <p className="text-xs text-[#888]">Plus rapide qu'un site, comme une vraie app.</p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        {isInstallable && !isIOS && (
                            <button onClick={onInstall} className="bg-[#00D97E] text-black font-bold text-xs px-4 py-2 rounded-lg transition-transform active:scale-95">Installer</button>
                        )}
                        <button onClick={onDismissInstall} aria-label="Fermer" className="text-[#888] hover:text-white text-sm px-2 py-2">✕</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------- SUB COMPONENTS ----------

const BotStatusBadge = ({ status, paused }: { status: 'disconnected' | 'connecting' | 'connected'; paused?: boolean }) => {
    const map = {
        pausedState: { show: status === 'connected' && paused, dot: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', label: 'En pause', pulse: false },
        connected: { show: status === 'connected' && !paused, dot: 'bg-[#00D97E]', text: 'text-[#00D97E]', bg: 'bg-[#00D97E]/10 border-[#00D97E]/20', label: 'Bot actif', pulse: true },
        connecting: { show: status === 'connecting', dot: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Connexion…', pulse: true },
        off: { show: status === 'disconnected', dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Bot off', pulse: false },
    };
    const s = Object.values(map).find(x => x.show) || map.off;
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border shrink-0 ${s.bg}`}>
            <span className={`w-2 h-2 rounded-full ${s.dot} ${s.pulse ? 'animate-pulse' : ''}`} />
            <span className={`text-[11px] font-bold ${s.text}`}>{s.label}</span>
        </div>
    );
};

interface TaskCardProps {
    to: string;
    icon: React.ElementType;
    count: number;
    label: string;
    tone: 'primary' | 'warning' | 'info';
}

const TaskCard = ({ to, icon: Icon, count, label, tone }: TaskCardProps) => {
    const tones = {
        primary: 'bg-[#00D97E]/10 border-[#00D97E]/20 text-[#00D97E]',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
        info: 'bg-[#0EA5E9]/10 border-[#0EA5E9]/20 text-[#0EA5E9]',
    } as const;
    return (
        <Link to={to} className={`flex items-center justify-between gap-3 p-4 rounded-2xl border transition-transform active:scale-[0.99] ${tones[tone]}`}>
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2.5 rounded-xl bg-black/30 shrink-0"><Icon className="w-5 h-5" /></div>
                <div className="min-w-0">
                    <p className="text-2xl font-bold leading-none">{count}</p>
                    <p className="text-xs text-white/80 mt-1 truncate">{label}</p>
                </div>
            </div>
            <ArrowRight className="w-4 h-4 shrink-0" />
        </Link>
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

export default Today;
