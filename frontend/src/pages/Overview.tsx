
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, ShoppingCart, Activity, Globe } from 'lucide-react';

const StatCard = ({ title, value, change, icon: Icon, subtitle }: any) => (
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

export default function Overview() {
    const navigate = useNavigate();
    const [lang, setLang] = useState<'fr' | 'en'>('fr');
    const [greeting, setGreeting] = useState('');
    const [chartData, setChartData] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ revenue: "0 FCFA", orders: 0, conversion: 3.2 });

    useEffect(() => {
        const hour = new Date().getHours();
        const isEvening = hour >= 18 || hour < 5;
        const name = "Alex";

        if (lang === 'fr') {
            setGreeting(`${isEvening ? 'Bonsoir' : 'Bonjour'} ${name}`);
        } else {
            setGreeting(`${isEvening ? 'Good evening' : 'Good morning'} ${name}`);
        }
    }, [lang]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/orders');
                if (res.ok) {
                    const orders = await res.json();

                    // Process Data
                    const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date();
                        d.setDate(d.getDate() - (6 - i));
                        return d;
                    });

                    const daysMap = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

                    const newChartData = last7Days.map(date => {
                        const dayName = daysMap[date.getDay()];
                        const dayOrders = orders.filter((o: any) => {
                            const d = new Date(o.createdAt);
                            return d.getDate() === date.getDate() && d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
                        });

                        const dayTotal = dayOrders.reduce((sum: number, o: any) => sum + o.total, 0);
                        return { name: dayName, sales: dayTotal };
                    });

                    setChartData(newChartData);

                    const totalRevenue = orders.reduce((sum: number, o: any) => sum + o.total, 0);
                    setStats({
                        revenue: new Intl.NumberFormat('fr-FR').format(totalRevenue) + ' FCFA',
                        orders: orders.length,
                        conversion: 3.5
                    });
                }
            } catch (e) { console.error(e); }
        };
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
    }, []);

    const t = {
        fr: {
            welcome: "Voici ce qui se passe aujourd'hui.",
            revenue: "Revenu Total",
            orders: "Commandes Actives",
            conversion: "Taux de Conversion",
            vs: "sur la période",
            analytics: "Analyse des Ventes",
            live: "EN DIRECT",
            updating: "Mise à jour toutes les 5s",
            options: ["7 derniers jours", "30 derniers jours", "Cette année"]
        },
        en: {
            welcome: "Here is what's happening today.",
            revenue: "Total Revenue",
            orders: "Active Orders",
            conversion: "Conversion Rate",
            vs: "over the period",
            analytics: "Sales Analytics",
            live: "LIVE",
            updating: "Updating every 5s",
            options: ["Last 7 Days", "Next 30 Days", "This Year"]
        }
    };

    const content = t[lang];

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex justify-between items-end border-b border-zinc-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">{greeting}</h1>
                    <p className="text-zinc-500">{content.welcome}</p>
                </div>
                {/* Language Switcher */}
                <div className="relative group">
                    <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-300 hover:text-orange-500 hover:border-orange-500/50 transition-all font-medium text-xs uppercase tracking-wide">
                        <Globe className="w-4 h-4" />
                        <span>{lang === 'fr' ? 'Français' : 'English'}</span>
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl overflow-hidden hidden group-hover:block z-50">
                        <button onClick={() => setLang('fr')} className="w-full text-left px-4 py-3 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs transition-colors flex items-center justify-between">
                            Français {lang === 'fr' && <span className="text-orange-500">✓</span>}
                        </button>
                        <button onClick={() => setLang('en')} className="w-full text-left px-4 py-3 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs transition-colors flex items-center justify-between">
                            English {lang === 'en' && <span className="text-orange-500">✓</span>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div onClick={() => navigate('/dashboard/orders')} className="cursor-pointer">
                    <StatCard
                        title={content.revenue}
                        value={stats.revenue || "0 FCFA"}
                        change="+12.5%"
                        icon={DollarSign}
                        subtitle={content.vs}
                    />
                </div>
                <div onClick={() => navigate('/dashboard/orders')} className="cursor-pointer">
                    <StatCard
                        title={content.orders}
                        value={stats.orders}
                        change="+8.2%"
                        icon={ShoppingCart}
                        subtitle={content.vs}
                    />
                </div>
                <div onClick={() => navigate('/dashboard/marketing')} className="cursor-pointer">
                    <StatCard
                        title={content.conversion}
                        value={stats.conversion + "%"}
                        change="+2.4%"
                        icon={Activity}
                        subtitle={content.vs}
                    />
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>

                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1 tracking-tight">{content.analytics}</h2>
                        <div className="flex gap-2 text-sm items-center">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                            </span>
                            <span className="text-orange-500 font-mono text-xs font-bold">{content.live}</span>
                            <span className="text-zinc-600 text-xs uppercase">{content.updating}</span>
                        </div>
                    </div>
                    <select className="bg-black border border-zinc-800 text-zinc-300 text-xs font-medium uppercase rounded-lg px-3 py-2 outline-none focus:border-orange-500 transition-colors cursor-pointer">
                        {content.options.map(opt => <option key={opt}>{opt}</option>)}
                    </select>
                </div>

                <div className="h-[350px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData.length > 0 ? chartData : [{ name: 'Loading', sales: 0 }]}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#52525b"
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                                tick={{ fontSize: 12, fill: '#71717a' }}
                            />
                            <YAxis
                                stroke="#52525b"
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${value}`}
                                tick={{ fontSize: 12, fill: '#71717a' }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', color: '#fff' }}
                                itemStyle={{ color: '#f97316' }}
                                cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
                                formatter={(value: any) => [`${value} FCFA`, 'Ventes']}
                            />
                            <Area
                                type="monotone"
                                dataKey="sales"
                                stroke="#f97316"
                                strokeWidth={2}
                                activeDot={{ r: 6, strokeWidth: 0, fill: '#fff' }}
                                fillOpacity={1}
                                fill="url(#colorSales)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
