import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Package, ArrowRight, ArrowUpRight, Activity, CheckCircle2, CreditCard, Download, MessageSquare, X } from 'lucide-react';
import PageHeading from '../components/ui/PageHeading';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import { deriveDailyMetrics, toUIStatus } from '../utils/overviewMetrics';

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
    const [ordersAvailable, setOrdersAvailable] = useState(false);
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
                const promises = [
                    apiClient('/orders').catch(() => null),
                    apiClient('/dashboard/pulse').catch(() => null),
                    apiClient('/whatsapp/status').catch(() => null),
                    apiClient('/settings').catch(() => null),
                    apiClient('/products?limit=1').catch(() => null),
                ];
                const [resOrders, resLogs, resWa, resSettings, resProducts] = await Promise.all(promises);
                let ordersOk = false;
                if (resOrders && resOrders.ok) {
                    const data = await resOrders.json();
                    if (Array.isArray(data)) { setOrders(data); ordersOk = true; }
                }
                setOrdersAvailable(ordersOk);
                if (resLogs && resLogs.ok) setLogs(await resLogs.json());
                if (resWa && resWa.ok) {
                    const data = await resWa.json();
                    setBotStatus(data.status || 'disconnected');
                }
                if (resSettings && resSettings.ok) {
                    const s = await resSettings.json();
                    setBotActive(s.botActive ?? false);
                }
                if (resProducts && resProducts.ok) {
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
    const { todayOrders, yesterdayOrders, todayRevenue, yesterdayRevenue } = useMemo(() => deriveDailyMetrics(orders), [orders]);
    const revenueDelta = yesterdayRevenue > 0
        ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        : null;

    const newOrders = orders.filter(o => toUIStatus(o.status) === 'NEW');
    const paidOrders = orders.filter(o => toUIStatus(o.status) === 'PAID');

    const lastSaleLog = logs.find(l => l.type === 'sale');
    const lastSaleAgo = lastSaleLog ? timeAgo(new Date(lastSaleLog.created_at)) : null;

    return (
        <TodayView
            ordersAvailable={ordersAvailable}
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
    ordersAvailable?: boolean;
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
    ordersAvailable = true, greeting, displayName, dateStr, botStatus, botActive,
    togglingBot, loading, newOrdersCount, paidOrdersCount, productCount,
    logs, todayRevenue, todayOrdersCount, yesterdayOrdersCount, revenueDelta,
    showInstallBanner, isInstallable, isIOS, onToggleBot, onInstall, onDismissInstall,
}) => {
    const ready = botStatus === 'connected' && botActive === true && (productCount ?? 0) > 0;
    const hasTasks = newOrdersCount > 0 || paidOrdersCount > 0;
    const steps = [
        { done: botStatus === 'connected', label: 'Connecter WhatsApp', to: '/dashboard/whatsapp' },
        { done: (productCount ?? 0) > 0, label: 'Ajouter vos produits et leurs prix', to: '/dashboard/products' },
        { done: botActive === true, label: 'Configurer et activer le bot', to: '/dashboard/settings' },
    ];
    const status = loading || botActive === null ? 'Vérification…' : botStatus === 'connected'
        ? botActive ? 'Bot actif' : 'Bot en pause' : botStatus === 'connecting' ? 'Connexion en cours' : 'WhatsApp déconnecté';
    return <div className="home-page">
        <PageHeading eyebrow="Votre commerce, au quotidien" title={`${greeting}, ${displayName}.`} description={<span className="capitalize">{dateStr}</span>}
            action={<span className="bot-badge" data-tone={ready ? 'positive' : 'warning'}><span aria-hidden="true" />{status}</span>} />
        <div className="home-grid">
            <div className="home-main">
                <section className="home-revenue" aria-label="Montant des commandes du jour">
                    <p className="home-revenue-label">Les commandes d’aujourd’hui</p>
                    <p className="home-revenue-amount">{loading || !ordersAvailable ? '—' : todayRevenue.toLocaleString('fr-FR')}<small>FCFA</small></p>
                    <div className="home-revenue-context">
                        {ordersAvailable && !loading ? <span>{todayOrdersCount} commande{todayOrdersCount > 1 ? 's' : ''} · {yesterdayOrdersCount} hier</span> : <span role="status">{loading ? 'Chargement des commandes…' : 'Commandes indisponibles. Nouvelle tentative automatique.'}</span>}
                        {ordersAvailable && !loading && revenueDelta !== null && <span className={revenueDelta >= 0 ? 'text-[#00D97E]' : 'text-red-300'}>{revenueDelta >= 0 ? '+' : ''}{revenueDelta} % par rapport à hier</span>}
                    </div>
                    <p className="home-revenue-note">Livraison incluse, hors annulations. Ce montant ne confirme pas les encaissements.</p>
                </section>
                <section>
                    <div className="home-section-heading"><h2>{!ready && !hasTasks ? 'Votre boutique prend vie' : 'À vous de jouer'}</h2><span>{!ready && !hasTasks ? 'MISE EN ROUTE' : 'À TRAITER'}</span></div>
                    {loading ? <div className="home-empty" role="status">Nous préparons votre récapitulatif…</div> : !ordersAvailable ? <div className="home-empty" role="status"><h3>Les commandes ne sont pas accessibles.</h3><p>Nous réessayons automatiquement. Vos données ne sont pas effacées.</p></div> : hasTasks ? <div className="grid gap-3">
                        {newOrdersCount > 0 && <TaskCard to="/dashboard/orders?filter=new" icon={Package} count={newOrdersCount} label="commandes à confirmer" tone="warning" />}
                        {paidOrdersCount > 0 && <TaskCard to="/dashboard/orders?filter=paid" icon={CreditCard} count={paidOrdersCount} label="commandes payées à livrer" tone="primary" />}
                    </div> : !ready ? <div className="home-checklist">{steps.map((step,i) => <Link to={step.to} key={step.label} className={step.done ? 'is-done' : ''}><span>{step.done ? <CheckCircle2 size={18} aria-hidden="true" /> : `0${i+1}`}</span><span>{step.label}</span>{!step.done && <ArrowRight size={16} aria-hidden="true" />}</Link>)}</div> : <div className="home-empty"><CheckCircle2 size={27} aria-hidden="true" /><h3>Aucune commande en attente.</h3><p>Les prochaines commandes à traiter apparaîtront ici.</p><Link to="/dashboard/orders" className="app-text-link">Voir les commandes<ArrowUpRight size={16} aria-hidden="true" /></Link></div>}
                </section>
                <Link to="/dashboard/analytics" className="app-text-link">Voir mes chiffres en détail<ArrowUpRight size={16} aria-hidden="true" /></Link>
            </div>
            <div className="home-side">
                <section className="app-panel home-bot">
                    <div className="home-bot-heading"><MessageSquare size={20} aria-hidden="true" /><h2>Votre assistant WhatsApp</h2></div>
                    <p>{loading || botActive === null ? 'Nous vérifions la disponibilité de votre assistant.' : botStatus !== 'connected' ? 'Connectez votre numéro pour retrouver les conversations de vos clients.' : botActive ? 'Les réponses automatiques sont activées. Vous pouvez reprendre la main à tout moment.' : 'Vous avez la main. Activez les réponses automatiques lorsque votre boutique est prête.'}</p>
                    {botStatus !== 'connected' ? <Link to="/dashboard/whatsapp" className="app-primary">Connecter WhatsApp<ArrowRight size={17} aria-hidden="true" /></Link> : <button onClick={onToggleBot} disabled={togglingBot || botActive === null} className={botActive ? 'app-secondary' : 'app-primary'}>{togglingBot ? 'Mise à jour…' : botActive ? 'Mettre le bot en pause' : 'Activer les réponses'}</button>}
                    <Link to="/dashboard/settings" className="app-text-link">Ajuster sa façon de répondre<ArrowUpRight size={15} aria-hidden="true" /></Link>
                </section>
                <section className="app-panel">
                    <div className="home-section-heading"><h2>Ce qui se passe</h2><Activity size={17} aria-hidden="true" /></div>
                    <div className="home-activity">{loading ? <p role="status" className="text-[var(--color-muted)]">Chargement de l’activité…</p> : logs.length ? logs.slice(0,4).map(log => <article key={log.id}><p>{log.message}</p><time dateTime={log.created_at}>{timeAgo(new Date(log.created_at))}</time></article>) : <p className="text-[var(--color-muted)] text-sm">Les dernières actions de votre boutique apparaîtront ici.</p>}</div>
                    <Link to="/dashboard/inbox" className="app-text-link mt-4">Ouvrir les conversations<ArrowUpRight size={15} aria-hidden="true" /></Link>
                </section>
            </div>
        </div>
        {showInstallBanner && <section className="home-install"><Download size={21} aria-hidden="true" /><div><h2>Votre boutique, à portée de main.</h2><p>{isIOS ? 'Dans Safari : Partager, puis Sur l’écran d’accueil.' : 'Ajoutez DjassaBot à l’écran d’accueil depuis le menu de votre navigateur.'}</p></div>{isInstallable && !isIOS && <button onClick={onInstall} className="app-secondary">Installer</button>}<button onClick={onDismissInstall} aria-label="Fermer la bannière d’installation" className="text-[var(--color-muted)]"><X size={18} aria-hidden="true" /></button></section>}
    </div>;
};

interface TaskCardProps {
    to: string; icon: React.ElementType; count: number; label: string; tone: 'primary' | 'warning' | 'info';
}
const TaskCard = ({ to, icon: Icon, count, label, tone }: TaskCardProps) => <Link to={to} className="app-panel flex items-center gap-4"><Icon size={22} className={tone === 'warning' ? 'text-amber-300' : 'text-[#00D97E]'} aria-hidden="true" /><span className="text-2xl font-semibold tabular-nums">{count}</span><span className="text-sm flex-1">{label}</span><ArrowRight size={18} aria-hidden="true" /></Link>;

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
