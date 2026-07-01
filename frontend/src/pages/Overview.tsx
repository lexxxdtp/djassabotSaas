import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingBag, Receipt, Activity, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import { deriveMetrics, orderDate, type DashboardOrder, type ChartPoint } from '../utils/overviewMetrics';

// ---------- TYPES ----------

export interface Log {
    id: string;
    type: string;
    message: string;
    created_at: string;
}

// UI statuses aligned with the Orders page (backend keeps the full enum).
type UIStatus = 'NEW' | 'PAID' | 'DELIVERED' | 'CANCELLED';
const toUIStatus = (s: string): UIStatus => {
    if (s === 'PENDING' || s === 'CONFIRMED') return 'NEW';
    if (s === 'PAID' || s === 'SHIPPING') return 'PAID';
    if (s === 'DELIVERED') return 'DELIVERED';
    return 'CANCELLED';
};
const STATUS_META: Record<UIStatus, { label: string; color: string }> = {
    NEW: { label: 'Nouvelle', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
    PAID: { label: 'Payée', color: 'text-[#00D97E] bg-[#00D97E]/10 border-[#00D97E]/20' },
    DELIVERED: { label: 'Livrée', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
    CANCELLED: { label: 'Annulée', color: 'text-[#666] bg-white/5 border-[#1a1a1a]' },
};

// ---------- CONTAINER (data) ----------

export default function Overview() {
    const { token, user, tenant } = useAuth();
    const [orders, setOrders] = useState<DashboardOrder[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const hour = new Date().getHours();
    const isEvening = hour >= 18 || hour < 5;
    const displayName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || tenant?.name || 'Vendeur';
    const greeting = `${isEvening ? 'Bonsoir' : 'Bonjour'}, ${displayName}`;

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const [resOrders, resLogs, resRecent] = await Promise.all([
                    apiClient('/orders'),
                    apiClient('/dashboard/pulse'),
                    apiClient('/dashboard/recent-orders'),
                ]);
                if (resOrders.ok) setOrders(await resOrders.json());
                if (resLogs.ok) setLogs(await resLogs.json());
                if (resRecent.ok) setRecentOrders(await resRecent.json());
            } catch (e) {
                console.error('Overview fetch error', e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 15000);
        return () => clearInterval(interval);
    }, [token]);

    const derived = useMemo(() => deriveMetrics(orders), [orders]);

    return (
        <OverviewView
            greeting={greeting}
            loading={loading}
            revenue7={derived.revenue7}
            revenueDelta={derived.revenueDelta}
            orders7={derived.orders7}
            ordersDelta={derived.ordersDelta}
            avgBasket={derived.avgBasket}
            chartData={derived.chartData}
            hasSales7={derived.hasSales7}
            logs={logs}
            recentOrders={recentOrders}
        />
    );
}

// ---------- PRESENTATIONAL VIEW (réutilisée par la preview) ----------

export interface OverviewViewProps {
    greeting: string;
    loading: boolean;
    revenue7: number;
    revenueDelta: number | null;
    orders7: number;
    ordersDelta: number | null;
    avgBasket: number;
    chartData: ChartPoint[];
    hasSales7: boolean;
    logs: Log[];
    recentOrders: DashboardOrder[];
}

export const OverviewView: React.FC<OverviewViewProps> = ({
    greeting, loading, revenue7, revenueDelta, orders7, ordersDelta,
    avgBasket, chartData, hasSales7, logs, recentOrders,
}) => {
    const anim = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both';
    const delay = (i: number): React.CSSProperties => ({ animationDuration: '450ms', animationDelay: `${i * 60}ms` });

    if (loading) return <OverviewSkeleton />;

    return (
        <div className="space-y-5 pb-4">
            {/* HEADER */}
            <div className={anim} style={delay(0)}>
                <h1 className="text-2xl font-bold text-white tracking-tight">{greeting}</h1>
                <p className="text-[#888] text-sm mt-0.5">Vos chiffres des 7 derniers jours.</p>
            </div>

            {/* HERO — CHIFFRE D'AFFAIRES 7 JOURS */}
            <div className={`bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 ${anim}`} style={delay(1)}>
                <p className="text-[#888] text-sm">Chiffre d'affaires · 7 jours</p>
                <p className="text-[38px] leading-none font-bold text-white tracking-tight tabular-nums mt-2">
                    {revenue7.toLocaleString('fr-FR')}
                    <span className="text-lg text-[#888] font-semibold ml-1.5">FCFA</span>
                </p>
                {revenueDelta !== null && (
                    <div className="mt-3">
                        <DeltaChip value={revenueDelta} suffix="vs semaine dernière" />
                    </div>
                )}
            </div>

            {/* KPI DUO — COMMANDES · PANIER MOYEN */}
            <div className={`grid grid-cols-2 gap-3 ${anim}`} style={delay(2)}>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 text-[#888] text-xs mb-2">
                        <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" /> Commandes
                    </div>
                    <p className="text-2xl font-bold text-white tabular-nums">{orders7}</p>
                    {ordersDelta !== null && (
                        <div className="mt-2"><DeltaChip value={ordersDelta} compact /></div>
                    )}
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    <div className="flex items-center gap-1.5 text-[#888] text-xs mb-2">
                        <Receipt className="w-3.5 h-3.5" aria-hidden="true" /> Panier moyen
                    </div>
                    <p className="text-2xl font-bold text-white tabular-nums">
                        {avgBasket.toLocaleString('fr-FR')}
                        <span className="text-sm text-[#888] font-semibold ml-1">F</span>
                    </p>
                    <p className="mt-2 text-[11px] text-[#555]">par commande</p>
                </div>
            </div>

            {/* GRAPHE DES VENTES */}
            <section className={anim} style={delay(3)}>
                <h2 className="text-[15px] font-semibold text-white mb-3">Évolution des ventes</h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4">
                    {hasSales7 ? (
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#00D97E" stopOpacity={0.18} />
                                            <stop offset="100%" stopColor="#00D97E" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1a1a1a" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#555', fontSize: 11 }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#555', fontSize: 11 }} width={44} tickFormatter={compact} />
                                    <Tooltip cursor={{ stroke: '#00D97E', strokeWidth: 1, strokeOpacity: 0.4 }} content={<SalesTooltip />} />
                                    <Area type="monotone" dataKey="sales" stroke="#00D97E" strokeWidth={2.5} fill="url(#salesFill)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[200px] flex flex-col items-center justify-center text-center px-6">
                            <div className="p-3 rounded-2xl bg-[#00D97E]/10 text-[#00D97E] mb-3">
                                <TrendingUp className="w-6 h-6" aria-hidden="true" />
                            </div>
                            <p className="text-white text-sm font-medium">Pas encore de ventes cette semaine.</p>
                            <p className="text-[#888] text-xs mt-1">Vos ventes s'afficheront ici dès la première commande.</p>
                        </div>
                    )}
                </div>
            </section>

            {/* ACTIVITÉ DU BOT */}
            <section className={anim} style={delay(4)}>
                <h2 className="text-[15px] font-semibold text-white mb-3">Activité en direct</h2>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
                    {logs.length === 0 ? (
                        <div className="flex items-center gap-3 text-[#888] text-sm py-2">
                            <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />
                            Aucune activité récente pour le moment.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {logs.slice(0, 8).map(log => (
                                <div key={log.id} className="flex items-start gap-3 text-xs">
                                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${log.type === 'sale' ? 'bg-emerald-500' : log.type === 'warning' ? 'bg-amber-500' : log.type === 'action' ? 'bg-[#00D97E]' : 'bg-[#0EA5E9]'}`} />
                                    <p className="text-[#888] leading-relaxed flex-1">{log.message}</p>
                                    <span className="text-[#555] tabular-nums shrink-0">
                                        {new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* COMMANDES RÉCENTES */}
            <section className={anim} style={delay(5)}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-[15px] font-semibold text-white">Commandes récentes</h2>
                    <Link to="/dashboard/orders" className="inline-flex items-center gap-1 text-xs text-[#00D97E]">
                        Tout voir <ArrowRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
                </div>
                <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a]">
                    {recentOrders.length === 0 ? (
                        <div className="text-[#888] text-sm text-center py-8">Aucune commande récente.</div>
                    ) : (
                        recentOrders.slice(0, 6).map(order => {
                            const meta = STATUS_META[toUIStatus(order.status)];
                            return (
                                <div key={order.id} className="flex items-center justify-between gap-3 p-4">
                                    <div className="min-w-0">
                                        <p className="text-sm text-white font-medium truncate">{maskPhone(order.userId)}</p>
                                        <p className="text-[11px] text-[#555] mt-0.5">
                                            {order.items.length} article{order.items.length > 1 ? 's' : ''}
                                            <span className="text-[#444]"> · </span>
                                            {new Date(orderDate(order)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span className="text-sm text-white font-bold tabular-nums">{order.total.toLocaleString('fr-FR')} F</span>
                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${meta.color}`}>{meta.label}</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
};

// ---------- SUB COMPONENTS ----------

const DeltaChip = ({ value, suffix, compact: isCompact }: { value: number; suffix?: string; compact?: boolean }) => {
    const positive = value >= 0;
    return (
        <span className={`inline-flex items-center gap-1 text-sm font-semibold ${positive ? 'text-[#00D97E]' : 'text-red-400'}`}>
            <TrendingUp className={`w-4 h-4 ${positive ? '' : 'rotate-180'}`} aria-hidden="true" />
            {positive ? '+' : ''}{value}%
            {suffix && <span className="text-[#888] font-normal">{suffix}</span>}
            {isCompact && <span className="text-[#555] font-normal text-xs">7j</span>}
        </span>
    );
};

interface TooltipEntry { value: number }
const SalesTooltip = ({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-xl px-3 py-2 shadow-xl">
            <p className="text-[10px] text-[#888] uppercase tracking-wider">{label}</p>
            <p className="text-sm font-bold text-white tabular-nums mt-0.5">{payload[0].value.toLocaleString('fr-FR')} FCFA</p>
        </div>
    );
};

const OverviewSkeleton = () => (
    <div className="space-y-5 pb-4">
        <div className="space-y-2">
            <div className="h-7 w-40 bg-[#111] rounded-lg animate-pulse" />
            <div className="h-4 w-52 bg-[#111] rounded animate-pulse" />
        </div>
        <div className="h-[116px] bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
            <div className="h-[96px] bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
            <div className="h-[96px] bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
        </div>
        <div className="h-[240px] bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
        <div className="h-[180px] bg-[#111] border border-[#1a1a1a] rounded-2xl animate-pulse" />
    </div>
);

// ---------- HELPERS ----------

function compact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`;
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(n);
}

function maskPhone(jid: string): string {
    const num = jid.replace(/@s\.whatsapp\.net$/, '');
    if (num.length <= 6) return num;
    return `${num.slice(0, 4)}…${num.slice(-2)}`;
}
