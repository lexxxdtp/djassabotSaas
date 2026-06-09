import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    Package,
    MessageSquare,
    TrendingUp,
    ArrowRight,
    Activity,
    Clock,
    DollarSign,
    CheckCircle2,
    WifiOff,
    CreditCard,
    Download,
    Share
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

interface Log {
    id: string;
    type: string;
    message: string;
    created_at: string;
}

const Today: React.FC = () => {
    const { token, user, tenant } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [botStatus, setBotStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [loading, setLoading] = useState(true);

    // PWA Installation states
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstallable, setIsInstallable] = useState(false);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    useEffect(() => {
        // Check if already running in standalone mode (installed)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        const dismissed = sessionStorage.getItem('pwa-install-dismissed');

        if (!isStandalone && !dismissed) {
            setShowInstallBanner(true);
        }

        const handleBeforeInstallPrompt = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
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

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    const hour = new Date().getHours();
    const isEvening = hour >= 18 || hour < 5;
    const displayName = user?.full_name?.split(' ')[0] || tenant?.name || user?.email?.split('@')[0] || 'Vendeur';
    const greeting = isEvening ? 'Bonsoir' : 'Bonjour';

    useEffect(() => {
        if (!token) return;

        const fetchAll = async () => {
            try {
                const [resOrders, resLogs, resWa] = await Promise.all([
                    apiClient('/orders'),
                    apiClient('/dashboard/pulse'),
                    apiClient('/whatsapp/status'),
                ]);
                if (resOrders.ok) setOrders(await resOrders.json());
                if (resLogs.ok) setLogs(await resLogs.json());
                if (resWa.ok) {
                    const data = await resWa.json();
                    setBotStatus(data.status || 'disconnected');
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
    // Bucket orders into today/yesterday in a single pass — deps tracked correctly
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

    // Simplified workflow: NEW (= PENDING + CONFIRMED) → PAID (= PAID + SHIPPING) → DELIVERED
    const newOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED');
    const paidOrders = orders.filter(o => o.status === 'PAID' || o.status === 'SHIPPING');

    const lastSaleLog = logs.find(l => l.type === 'sale');
    const lastSaleAgo = lastSaleLog
        ? timeAgo(new Date(lastSaleLog.created_at))
        : null;

    const hasUrgentTasks = newOrders.length > 0 || paidOrders.length > 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* HEADER */}
            <div className="flex items-end justify-between border-b border-[#1a1a1a] pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
                        {greeting}, {displayName}
                    </h1>
                    <p className="text-[#888] text-xs md:text-sm mt-1">
                        {today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <BotStatusBadge status={botStatus} />
            </div>

            {/* PWA INSTALL BANNER */}
            {showInstallBanner && (
                <div className="relative overflow-hidden bg-gradient-to-r from-[#00D97E]/10 to-transparent border border-[#00D97E]/20 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
                    <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-[#00D97E]/10 text-[#00D97E] border border-[#00D97E]/20 mt-1 md:mt-0 shrink-0">
                            <Download className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-white font-bold text-base flex items-center gap-2">
                                Installer l'application DjassaBot
                                <span className="text-[10px] bg-[#00D97E]/10 text-[#00D97E] border border-[#00D97E]/20 px-2 py-0.5 rounded font-mono uppercase font-bold tracking-wider">PWA</span>
                            </h3>
                            <p className="text-[#888] text-sm leading-relaxed max-w-xl">
                                Accédez instantanément à votre inventaire, vos ventes et vos conversations en un clic directement depuis votre écran d'accueil.
                            </p>
                            {isIOS && (
                                <p className="text-xs text-[#00D97E] flex items-center gap-1.5 mt-2 bg-[#00D97E]/5 border border-[#00D97E]/10 rounded-lg p-2 w-fit">
                                    <Share className="w-3.5 h-3.5 text-[#00D97E]" />
                                    <span>Sur iPhone : cliquez sur <strong>Partager</strong> en bas de Safari puis <strong>Sur l'écran d'accueil</strong>.</span>
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto mt-2 md:mt-0">
                        {isInstallable && !isIOS && (
                            <button
                                onClick={handleInstallClick}
                                className="flex-1 md:flex-none bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold text-sm px-5 py-2.5 rounded-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                <span>Installer</span>
                            </button>
                        )}
                        <button
                            onClick={handleDismissInstall}
                            className="flex-1 md:flex-none bg-[#111] hover:bg-[#1a1a1a] border border-[#1a1a1a] text-[#888] hover:text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all active:scale-[0.97]"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}

            {/* BOT DISCONNECTED ALERT */}
            {botStatus === 'disconnected' && !loading && (
                <Link
                    to="/dashboard/whatsapp"
                    className="flex items-center justify-between gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-colors group"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                            <WifiOff className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-white text-sm font-bold">Le bot est déconnecté</p>
                            <p className="text-red-300/80 text-xs">Reconnectez WhatsApp pour qu'il reprenne les ventes.</p>
                        </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-red-400 group-hover:translate-x-1 transition-transform" />
                </Link>
            )}

            {/* SECTION 1 — À FAIRE MAINTENANT */}
            <section>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#888] mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-[#00D97E] rounded-full" />
                    À faire maintenant
                </h2>

                {!hasUrgentTasks ? (
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-8 text-center">
                        <CheckCircle2 className="w-10 h-10 text-[#00D97E] mx-auto mb-3" />
                        <p className="text-white font-medium">Rien à faire de votre côté.</p>
                        <p className="text-[#888] text-xs mt-1">Le bot gère tout. Profitez 🌴</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {newOrders.length > 0 && (
                            <TaskCard
                                to="/dashboard/orders?filter=new"
                                icon={Package}
                                count={newOrders.length}
                                label={newOrders.length > 1 ? "commandes à confirmer" : "commande à confirmer"}
                                tone="warning"
                            />
                        )}
                        {paidOrders.length > 0 && (
                            <TaskCard
                                to="/dashboard/orders?filter=paid"
                                icon={CreditCard}
                                count={paidOrders.length}
                                label={paidOrders.length > 1 ? "prêtes à livrer" : "prête à livrer"}
                                tone="primary"
                            />
                        )}
                    </div>
                )}
            </section>

            {/* SECTION 2 — LE BOT TRAVAILLE */}
            <section>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#888] mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-[#0EA5E9] rounded-full" />
                    Le bot travaille
                </h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-[#888] text-[10px] uppercase tracking-wider mb-2">
                                <Activity className="w-3 h-3" /> Activité récente
                            </div>
                            <p className="text-2xl font-bold text-white">
                                {logs.length}
                                <span className="text-sm text-[#888] font-normal ml-2">événements</span>
                            </p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-[#888] text-[10px] uppercase tracking-wider mb-2">
                                <Clock className="w-3 h-3" /> Dernière vente
                            </div>
                            <p className="text-2xl font-bold text-white">
                                {lastSaleAgo || <span className="text-[#555]">—</span>}
                            </p>
                        </div>
                    </div>

                    {logs.length > 0 && (
                        <div className="mt-6 pt-4 border-t border-[#1a1a1a] space-y-2">
                            {logs.slice(0, 3).map(log => (
                                <div key={log.id} className="flex items-start gap-3 text-xs">
                                    <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${log.type === 'sale' ? 'bg-emerald-500' :
                                        log.type === 'warning' ? 'bg-amber-500' :
                                            log.type === 'action' ? 'bg-[#00D97E]' : 'bg-[#0EA5E9]'
                                        }`} />
                                    <p className="text-[#888] leading-relaxed">{log.message}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <Link
                        to="/dashboard/inbox"
                        className="mt-4 inline-flex items-center gap-1 text-xs text-[#00D97E] hover:underline"
                    >
                        Voir les conversations
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
            </section>

            {/* SECTION 3 — AUJOURD'HUI EN CHIFFRES */}
            <section>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-[#888] mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-white/40 rounded-full" />
                    Aujourd'hui en chiffres
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <StatBox
                        icon={DollarSign}
                        label="Chiffre d'affaires"
                        value={`${todayRevenue.toLocaleString('fr-FR')} F`}
                        delta={revenueDelta}
                        subtitle="vs. hier"
                    />
                    <StatBox
                        icon={Package}
                        label="Commandes"
                        value={String(todayOrders.length)}
                        delta={null}
                        subtitle={`${yesterdayOrders.length} hier`}
                    />
                    <div className="col-span-2 md:col-span-1">
                        <StatBox
                            icon={MessageSquare}
                            label="Conversations"
                            value={String(logs.length)}
                            delta={null}
                            subtitle="événements bot"
                        />
                    </div>
                </div>

                <Link
                    to="/dashboard/analytics"
                    className="mt-4 inline-flex items-center gap-1 text-xs text-[#888] hover:text-white transition-colors"
                >
                    Voir l'analyse détaillée
                    <ArrowRight className="w-3 h-3" />
                </Link>
            </section>
        </div>
    );
};

// ---------- SUB COMPONENTS ----------

const BotStatusBadge = ({ status }: { status: 'disconnected' | 'connecting' | 'connected' }) => {
    if (status === 'connected') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00D97E]/10 border border-[#00D97E]/20">
                <span className="w-2 h-2 rounded-full bg-[#00D97E] animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-[#00D97E] tracking-wider">Bot actif</span>
            </div>
        );
    }
    if (status === 'connecting') {
        return (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Connexion…</span>
            </div>
        );
    }
    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">Bot off</span>
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
        primary: 'bg-[#00D97E]/10 border-[#00D97E]/20 text-[#00D97E] hover:border-[#00D97E]/40',
        warning: 'bg-amber-500/10 border-amber-500/20 text-amber-500 hover:border-amber-500/40',
        info: 'bg-[#0EA5E9]/10 border-[#0EA5E9]/20 text-[#0EA5E9] hover:border-[#0EA5E9]/40',
    } as const;
    return (
        <Link
            to={to}
            className={`flex items-center justify-between gap-3 p-4 rounded-xl border transition-all group ${tones[tone]}`}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-black/30 shrink-0">
                    <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-2xl font-bold leading-none">{count}</p>
                    <p className="text-xs text-white/80 mt-1 truncate">{label}</p>
                </div>
            </div>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
        </Link>
    );
};

interface StatBoxProps {
    icon: React.ElementType;
    label: string;
    value: string;
    delta: number | null;
    subtitle: string;
}

const StatBox = ({ icon: Icon, label, value, delta, subtitle }: StatBoxProps) => (
    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 md:p-5 hover:border-[#00D97E]/20 transition-colors">
        <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#888]">{label}</p>
            <Icon className="w-4 h-4 text-[#555]" />
        </div>
        <p className="text-xl md:text-2xl font-bold text-white tracking-tight">{value}</p>
        <div className="flex items-center gap-2 mt-2">
            {delta !== null && (
                <span className={`text-[10px] font-bold flex items-center gap-1 ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                    <TrendingUp className={`w-3 h-3 ${delta < 0 ? 'rotate-180' : ''}`} />
                    {delta >= 0 ? '+' : ''}{delta}%
                </span>
            )}
            <span className="text-[10px] text-[#555] uppercase tracking-wider">{subtitle}</span>
        </div>
    </div>
);

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
