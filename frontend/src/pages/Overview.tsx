import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Activity, Globe, Package } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';
import { useAuth } from '../context/AuthContext';

// --- COMPONENTS ---

interface StatCardProps {
    title: string;
    value: string;
    change: string;
    icon: React.ElementType;
    subtitle: string;
}

const StatCard = ({ title, value, change, icon: Icon, subtitle }: StatCardProps) => (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-orange-500/30 transition-all group shadow-sm hover:shadow-orange-500/10">
        <div className="flex justify-between items-start mb-4">
            <div>
                <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
                <h3 className="text-2xl font-bold text-white tracking-tight">{value}</h3>
            </div>
            <div className="p-3 rounded-xl bg-orange-500/10 text-orange-500 group-hover:bg-orange-500 group-hover:text-black transition-all duration-300">
                <Icon className="w-6 h-6" />
            </div>
        </div>
        <div className="flex items-center text-sm">
            <span className="text-emerald-400 flex items-center gap-1 font-bold bg-emerald-500/10 px-2 py-0.5 rounded text-xs border border-emerald-500/20">
                <TrendingUp className="w-3 h-3" /> {change}
            </span>
            <span className="text-zinc-600 ml-2 text-xs font-medium uppercase">{subtitle}</span>
        </div>
    </div>
);

const ActivityFeed = ({ logs }: { logs: Log[] }) => {
    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="text-orange-500 w-5 h-5 animate-pulse" />
                    Le Pulse
                </h3>
                <span className="text-[10px] text-zinc-500 uppercase font-semibold bg-zinc-800 px-2 py-1 rounded">En Direct</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar max-h-[400px]">
                {logs.length === 0 ? (
                    <div className="text-zinc-500 text-xs text-center py-10">Aucune activité récente</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex gap-3 items-start group">
                            <div className={`mt-1 min-w-[8px] h-2 rounded-full ${log.type === 'sale' ? 'bg-emerald-500' :
                                log.type === 'warning' ? 'bg-amber-500' :
                                    log.type === 'action' ? 'bg-orange-500' : 'bg-blue-500'
                                }`} />
                            <div>
                                <p className="text-xs text-zinc-300 leading-relaxed group-hover:text-white transition-colors">
                                    {log.message}
                                </p>
                                <p className="text-[10px] text-zinc-600 mt-1 font-mono">
                                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const RecentOrders = ({ orders }: { orders: DashboardOrder[] }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
            case 'CONFIRMED': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
            case 'SHIPPING': return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
            case 'DELIVERED': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
            case 'CANCELLED': return 'text-red-500 bg-red-500/10 border-red-500/20';
            default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
        }
    };

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mt-6">
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <Package className="text-orange-500 w-5 h-5" />
                Commandes Récentes
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                            <th className="pb-3 font-medium">Client</th>
                            <th className="pb-3 font-medium">Produits</th>
                            <th className="pb-3 font-medium">Total</th>
                            <th className="pb-3 font-medium">Statut</th>
                            <th className="pb-3 font-medium text-right">Heure</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50">
                        {orders.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center py-8 text-zinc-500 text-sm">Aucune commande récente</td>
                            </tr>
                        ) : (
                            orders.map((order) => (
                                <tr key={order.id} className="group hover:bg-zinc-800/30 transition-colors">
                                    <td className="py-3 text-sm text-white font-medium">
                                        {/* Mask phone number for privacy */}
                                        {order.userId.replace(/@s.whatsapp.net/, '').replace(/^(\d{4}).*(\d{2})$/, '$1...$2')}
                                    </td>
                                    <td className="py-3 text-sm text-zinc-400">
                                        {order.items.length} article(s)
                                    </td>
                                    <td className="py-3 text-sm text-white font-mono font-bold">
                                        {order.total.toLocaleString()} FCFA
                                    </td>
                                    <td className="py-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${getStatusColor(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-xs text-zinc-500 text-right font-mono">
                                        {new Date(order.createdAt || order.created_at || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

interface DashboardOrder {
    id: string;
    total: number;
    createdAt?: string;
    created_at?: string;
    status: string;
    userId: string;
    items: unknown[];
}

interface Log {
    id: string;
    type: string;
    message: string;
    created_at: string;
}

interface Stats {
    revenue: string;
    orders: number;
    conversion: number;
}

interface ChartData {
    name: string;
    sales: number;
}

export default function Overview() {

    const { token, user, tenant } = useAuth();
    const [lang, setLang] = useState<'fr' | 'en'>('fr');
    // greeting calculated on render
    const [chartData, setChartData] = useState<ChartData[]>([]);
    const [stats, setStats] = useState<Stats>({ revenue: "0 FCFA", orders: 0, conversion: 3.2 });

    // New States
    const [logs, setLogs] = useState<Log[]>([]);
    const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);

    const hour = new Date().getHours();
    const isEvening = hour >= 18 || hour < 5;
    const displayName = user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || tenant?.name || 'Vendeur';
    const greeting = lang === 'fr'
        ? `${isEvening ? 'Bonsoir' : 'Bonjour'} ${displayName}`
        : `${isEvening ? 'Good evening' : 'Good morning'} ${displayName}`;

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const API_URL = getApiUrl();

                // 1. Fetch Orders for Stats & Chart
                const resOrders = await fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } });

                // 2. Fetch Logs
                const resLogs = await fetch(`${API_URL}/dashboard/pulse`, { headers: { 'Authorization': `Bearer ${token}` } });

                // 3. Fetch Recent Orders
                const resRecent = await fetch(`${API_URL}/dashboard/recent-orders`, { headers: { 'Authorization': `Bearer ${token}` } });

                if (resOrders.ok) {
                    const orders: DashboardOrder[] = await resOrders.json();

                    // Chart Logic
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d;
                    });
                    const daysMap = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                    const newChartData = last7Days.map(date => {
                        const dayName = daysMap[date.getDay()];
                        const dayOrders = orders.filter(o => {
                            const d = new Date(o.createdAt || o.created_at || ''); // Try both camelCase and snake_case if unsure, usually API returns consistent format
                            return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                        });
                        const dayTotal = dayOrders.reduce((sum, o) => sum + o.total, 0);
                        return { name: dayName, sales: dayTotal };
                    });
                    setChartData(newChartData);

                    // Stats Logic
                    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
                    setStats({
                        revenue: new Intl.NumberFormat('fr-FR').format(totalRevenue) + ' FCFA',
                        orders: orders.length,
                        conversion: 3.5 // Mock for now
                    });
                }

                if (resLogs.ok) setLogs(await resLogs.json());
                if (resRecent.ok) setRecentOrders(await resRecent.json());

            } catch (e) { console.error(e); }
        };

        fetchData();
        const interval = setInterval(fetchData, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, [token]);

    const content = {
        fr: {
            welcome: "Voici votre cockpit de pilotage.",
            revenue: "Revenu Total",
            orders: "Commandes Actives",
            conversion: "Taux de Conversion",
            vs: "sur la période",
            analytics: "Analyse des Ventes",
            live: "EN DIRECT",
        },
        en: {
            welcome: "Here is your cockpit.",
            revenue: "Total Revenue",
            orders: "Active Orders",
            conversion: "Conversion Rate",
            vs: "over the period",
            analytics: "Sales Analytics",
            live: "LIVE",
        }
    }[lang];

    return (
        <div className="space-y-6 animate-in fade-in zoom-in duration-500 pb-10">
            {/* Header */}
            <div className="flex justify-between items-end pb-4 border-b border-zinc-800/50">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{greeting}</h1>
                    <p className="text-zinc-500">{content.welcome}</p>
                </div>

                {/* Lang Switch */}
                <button
                    onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white text-xs hover:border-orange-500/50 transition-all font-medium uppercase tracking-wide"
                >
                    <Globe className="w-3 h-3" />
                    <span>{lang === 'fr' ? 'Français' : 'English'}</span>
                </button>
            </div>

            {/* Row 1: KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    title={content.revenue}
                    value={stats.revenue}
                    change="+12.5%"
                    icon={DollarSign}
                    subtitle={content.vs}
                />
                <StatCard
                    title={content.orders}
                    value={String(stats.orders)}
                    change="+8.2%"
                    icon={ShoppingCart}
                    subtitle={content.vs}
                />
                <StatCard
                    title={content.conversion}
                    value={`${stats.conversion}%`}
                    change="+2.4%"
                    icon={Activity}
                    subtitle={content.vs}
                />
            </div>

            {/* Row 2: Main Content Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[500px]">

                {/* Left Column (2/3): Analytics + Recent Orders */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Analytics Chart */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex-1 min-h-[300px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-white tracking-tight">{content.analytics}</h3>
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1.5 text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-1 rounded-full animate-pulse border border-orange-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                    {content.live}
                                </span>
                            </div>
                        </div>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#71717a', fontSize: 12 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#71717a', fontSize: 12 }}
                                        dx={-10}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                        cursor={{ stroke: '#f97316', strokeWidth: 1 }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="sales"
                                        stroke="#f97316"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#colorSales)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column (1/3): The Pulse */}
                <div className="lg:col-span-1 h-full">
                    <ActivityFeed logs={logs} />
                </div>
            </div>

            {/* Row 3: Recent Orders Table (Full Width) */}
            <RecentOrders orders={recentOrders} />

        </div>
    );
}
