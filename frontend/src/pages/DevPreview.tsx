// TEMP — page de prévisualisation pour l'itération design. À SUPPRIMER.
import { useState, useMemo, useEffect } from 'react';
import { 
    Plus, Search, PackageOpen, Home, MessageSquare, ShoppingBag, Package, 
    Settings as SettingsIcon, MapPin, X, Send, CheckCircle2, 
    CreditCard, AlertCircle
} from 'lucide-react';
import type { Product } from '../types';
import ProductCard from '../components/products/ProductCard';
import ProductFormModal from '../components/products/ProductFormModal';
import { TodayView, type Log } from './Today';
import SettingsPersonality from '../components/settings/SettingsPersonality';
import type { SettingsConfig } from '../types';

const img = (bg: string, label: string) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='${bg}'/><text x='50%' y='50%' font-family='sans-serif' font-size='24' fill='rgba(255,255,255,0.85)' text-anchor='middle' dominant-baseline='middle'>${label}</text></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const MOCK = [
    { id: '1', name: 'Bazin Riche Bleu', price: 15000, stock: 12, manageStock: true, images: [img('rgb(30,58,90)', 'Bazin')], variations: [] },
    { id: '2', name: 'Mèches Brésiliennes 22"', price: 45000, stock: 3, manageStock: true, images: [img('rgb(60,40,30)', 'Mèches')], variations: [] },
    { id: '3', name: 'Perruque Lisse Noire', price: 25000, stock: 0, manageStock: true, images: [img('rgb(35,35,40)', 'Perruque')], variations: [] },
    { id: '4', name: 'Sneakers Air Blanc', price: 35000, stock: 0, manageStock: false, images: [img('rgb(70,70,78)', 'Sneakers')], variations: [] },
    { id: '5', name: 'Robe Wax Fleurie', price: 18000, stock: 20, manageStock: true, images: [img('rgb(20,80,60)', 'Robe Wax')], variations: [{ name: 'Taille', options: [{ value: 'S', stock: 5 }, { value: 'M', stock: 8 }, { value: 'L', stock: 7 }] }] },
    { id: '6', name: 'Sac à main cuir', price: 22000, stock: 8, manageStock: true, images: [], variations: [] },
] as unknown as Product[];

const MOCK_LOGS: Log[] = [
    { id: '1', type: 'sale', message: 'Vente conclue : Bazin Riche × 2 (30 000 F)', created_at: new Date().toISOString() },
    { id: '2', type: 'action', message: 'A négocié une remise de 5 % avec un client', created_at: new Date().toISOString() },
    { id: '3', type: 'warning', message: 'Client en attente d\'adresse depuis 12 min', created_at: new Date().toISOString() },
];

const MOCK_ORDERS = [
    {
        id: 'ord_1',
        userId: '+225 07 08 09 10 11',
        total: 30000,
        status: 'PENDING',
        address: 'Cocody, Angré Oscar (Face pharmacie des Oscars)',
        paymentMethod: 'Wave',
        items: [
            { productName: 'Bazin Riche Bleu', quantity: 2, price: 15000 }
        ],
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() // 15 mins ago
    },
    {
        id: 'ord_2',
        userId: '+225 05 06 07 08 09',
        total: 45000,
        status: 'PAID',
        address: 'Marcory, Zone 4 (Rue du canal, Résidence Awa)',
        paymentMethod: 'Orange Money',
        items: [
            { productName: 'Mèches Brésiliennes 22"', quantity: 1, price: 45000 }
        ],
        createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString() // 2 hours ago
    },
    {
        id: 'ord_3',
        userId: '+225 01 02 03 04 05',
        total: 25000,
        status: 'DELIVERED',
        address: 'Yopougon, Bel Air (Près du feu tricolore)',
        paymentMethod: 'Wave',
        items: [
            { productName: 'Perruque Lisse Noire', quantity: 1, price: 25000 }
        ],
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
    }
];

function InventoryPreview() {
    const [query, setQuery] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [products, setProducts] = useState<Product[]>(MOCK);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
    }, [products, query]);
    const onUpdate = (p: Product) => setProducts(prev => prev.map(x => x.id === p.id ? p : x));

    return (
        <div>
            <div className="mb-5">
                <h1 className="text-2xl font-bold text-white tracking-tight">Inventaire</h1>
                <p className="text-[#888] text-sm mt-0.5">{products.length} produits en vente</p>
            </div>
            <div className="relative mb-5">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit…" className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl h-12 pl-11 pr-4 text-white placeholder:text-[#555] outline-none focus:border-[#00D97E]/40 transition-colors" />
            </div>
            {filtered.length === 0 ? (
                <div className="py-16 px-6 text-center border border-dashed border-[#1a1a1a] rounded-2xl bg-[#0d0d0d]">
                    <div className="mx-auto w-14 h-14 grid place-items-center rounded-2xl bg-[#00D97E]/10 text-[#00D97E] mb-4"><PackageOpen size={26} /></div>
                    <h3 className="text-lg font-semibold text-white">Aucun résultat</h3>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {filtered.map((product, i) => (
                        <div key={product.id} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDuration: '400ms', animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                            <ProductCard product={product} onEdit={() => {}} onDelete={() => {}} onUpdate={onUpdate} />
                        </div>
                    ))}
                </div>
            )}
            <button onClick={() => setShowForm(true)} className="fixed bottom-6 right-4 z-40 w-14 h-14 bg-[#00D97E] rounded-full shadow-lg shadow-[#00D97E]/30 flex items-center justify-center text-black active:scale-90 transition-transform">
                <Plus size={26} />
            </button>
            <ProductFormModal isOpen={showForm} onClose={() => setShowForm(false)} onSuccess={() => setShowForm(false)} templates={[]} />
        </div>
    );
}

function BotPreview() {
    const [config, setConfig] = useState<SettingsConfig>({
        botName: 'Awa', persona: 'friendly', politeness: 'informal', emojiLevel: 'medium',
        slangLevel: 'low', humorLevel: 'medium', responseLength: 'medium',
        greeting: 'Bonjour ! Je suis Awa.', systemInstructions: '',
    } as unknown as SettingsConfig);
    return (
        <div>
            <h1 className="text-2xl font-bold text-white tracking-tight mb-4">Réglages du bot</h1>
            <SettingsPersonality config={config} setConfig={setConfig} />
        </div>
    );
}

// Skeletons for iOS-like loading
function OrderSkeleton() {
    return (
        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 animate-pulse space-y-4">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#222] shrink-0"></div>
                    <div className="space-y-2">
                        <div className="h-4 w-20 bg-[#222] rounded"></div>
                        <div className="h-3 w-32 bg-[#222] rounded"></div>
                    </div>
                </div>
                <div className="space-y-2 text-right">
                    <div className="h-4 w-16 bg-[#222] rounded ml-auto"></div>
                    <div className="h-3 w-8 bg-[#222] rounded ml-auto"></div>
                </div>
            </div>
        </div>
    );
}

const UI_STATUS_META = {
    PENDING: { label: 'Nouvelle', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertCircle },
    CONFIRMED: { label: 'Nouvelle', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertCircle },
    PAID: { label: 'Payée', color: 'text-[#00D97E] bg-[#00D97E]/10 border-[#00D97E]/20', icon: CreditCard },
    DELIVERED: { label: 'Livrée', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    CANCELLED: { label: 'Annulée', color: 'text-[#666] bg-white/5 border-[#1a1a1a]', icon: X },
};

function OrdersPreview() {
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'new' | 'paid' | 'done'>('all');
    const [search, setSearch] = useState('');
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [orders, setOrders] = useState(MOCK_ORDERS);

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 550);
        return () => clearTimeout(timer);
    }, [filter]);

    const filtered = useMemo(() => {
        return orders.filter(o => {
            // Filter
            const matchesFilter = 
                filter === 'all' ||
                (filter === 'new' && (o.status === 'PENDING' || o.status === 'CONFIRMED')) ||
                (filter === 'paid' && o.status === 'PAID') ||
                (filter === 'done' && o.status === 'DELIVERED');
            
            if (!matchesFilter) return false;

            // Search
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return o.id.toLowerCase().includes(q) ||
                   o.userId.toLowerCase().includes(q) ||
                   o.address.toLowerCase().includes(q);
        });
    }, [orders, filter, search]);

    const counts = useMemo(() => ({
        all: orders.length,
        new: orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').length,
        paid: orders.filter(o => o.status === 'PAID').length,
        done: orders.filter(o => o.status === 'DELIVERED').length,
    }), [orders]);

    const handleUpdateStatus = (id: string, nextStatus: string) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: nextStatus } : o));
        if (selectedOrder?.id === id) {
            setSelectedOrder((prev: any) => prev ? { ...prev, status: nextStatus } : null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Commandes</h1>
                <p className="text-[#888] text-sm mt-0.5">
                    {counts.new > 0 ? (
                        <><span className="text-amber-500 font-bold">{counts.new}</span> nouvelles · <span className="text-[#00D97E] font-bold">{counts.paid}</span> payées</>
                    ) : (
                        'Tout est à jour 🌴'
                    )}
                </p>
            </div>

            {/* Segmented Control iOS-like */}
            <div className="flex bg-[#111] p-1 rounded-xl border border-[#1a1a1a] w-full">
                {[
                    { key: 'all' as const, label: 'Tout', count: counts.all },
                    { key: 'new' as const, label: 'Nouvelles', count: counts.new },
                    { key: 'paid' as const, label: 'Payées', count: counts.paid },
                    { key: 'done' as const, label: 'Livrées', count: counts.done },
                ].map(tab => {
                    const active = filter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-100 ${
                                active ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/5' : 'text-[#888] hover:text-white'
                            }`}
                        >
                            <span>{tab.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                active ? 'bg-[#00D97E] text-black font-bold' : 'bg-black/40 text-[#555]'
                            }`}>{tab.count}</span>
                        </button>
                    );
                })}
            </div>

            {/* Search Input */}
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par ID, client ou adresse…"
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl h-11 pl-11 pr-4 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#00D97E]/40 transition-colors"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <OrderSkeleton key={i} />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-16 px-6 text-center border border-dashed border-[#1a1a1a] rounded-2xl bg-[#0d0d0d]">
                    <div className="mx-auto w-14 h-14 grid place-items-center rounded-2xl bg-[#00D97E]/10 text-[#00D97E] mb-4"><ShoppingBag size={26} /></div>
                    <h3 className="text-lg font-semibold text-white">Aucune commande</h3>
                    <p className="text-[#888] text-sm mt-1">Vos commandes apparaîtront ici.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((order, i) => {
                        const meta = UI_STATUS_META[order.status as keyof typeof UI_STATUS_META] || UI_STATUS_META.PENDING;
                        const isNew = order.status === 'PENDING' || order.status === 'CONFIRMED';
                        return (
                            <div
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className={`w-full bg-[#111] border rounded-2xl p-4 sm:p-5 hover:border-[#00D97E]/20 transition-all active:scale-[0.99] transition-transform duration-100 cursor-pointer text-left flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-both ${
                                    isNew ? 'border-amber-500/25' : 'border-[#1a1a1a]'
                                }`}
                                style={{ animationDuration: '300ms', animationDelay: `${i * 45}ms` }}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-xl border ${meta.color}`}>
                                            <meta.icon size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-sm font-mono">#{order.id}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${meta.color}`}>
                                                    {meta.label}
                                                </span>
                                            </div>
                                            <p className="text-[#555] text-[10px] mt-1 uppercase tracking-wider font-semibold">{order.userId}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white font-mono">{order.total.toLocaleString()} F</p>
                                        <p className="text-[10px] text-[#555] mt-0.5">Il y a 15 min</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* iOS Bottom Sheet Modal */}
            {selectedOrder && (() => {
                const meta = UI_STATUS_META[selectedOrder.status as keyof typeof UI_STATUS_META] || UI_STATUS_META.PENDING;
                return (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                        <div className="bg-[#111] border-t md:border border-[#1a1a1a] rounded-t-3xl md:rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                            {/* Drag Indicator on Mobile */}
                            <div className="w-12 h-1 bg-[#222] rounded-full mx-auto my-3 md:hidden shrink-0"></div>

                            {/* Header */}
                            <div className="px-6 pb-4 flex justify-between items-start border-b border-[#1a1a1a] shrink-0 pt-2 md:pt-6">
                                <div>
                                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                                        <h2 className="text-xl font-bold text-white font-mono">#{selectedOrder.id}</h2>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}>
                                            {meta.label}
                                        </span>
                                    </div>
                                    <p className="text-[#555] text-[10px] uppercase tracking-wider font-bold">WhatsApp : {selectedOrder.userId}</p>
                                </div>
                                <button onClick={() => setSelectedOrder(null)} className="text-[#888] hover:text-white transition-colors bg-[#1a1a1a] p-1.5 rounded-full">
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="p-6 space-y-6 overflow-y-auto">
                                {/* Actions */}
                                <div className="flex gap-2">
                                    {selectedOrder.status === 'PENDING' && (
                                        <>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedOrder.id, 'CANCELLED')}
                                                className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-transform active:scale-95"
                                            >
                                                Annuler
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedOrder.id, 'PAID')}
                                                className="flex-1 py-3 bg-[#00D97E] hover:bg-[#00D97E]/95 text-black rounded-xl text-xs font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-[#00D97E]/20"
                                            >
                                                Marquer payée
                                            </button>
                                        </>
                                    )}
                                    {selectedOrder.status === 'PAID' && (
                                        <>
                                            <button
                                                onClick={() => alert("Résumé copié pour le livreur")}
                                                className="flex-1 py-3 bg-[#00D97E]/10 hover:bg-[#00D97E]/20 text-[#00D97E] border border-[#00D97E]/20 rounded-xl text-xs font-bold uppercase transition-transform active:scale-95 flex items-center justify-center gap-2"
                                            >
                                                <Send size={14} /> Envoyer au livreur
                                            </button>
                                            <button
                                                onClick={() => handleUpdateStatus(selectedOrder.id, 'DELIVERED')}
                                                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-xs font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
                                            >
                                                Marquer livrée
                                            </button>
                                        </>
                                    )}
                                    {(selectedOrder.status === 'DELIVERED' || selectedOrder.status === 'CANCELLED') && (
                                        <div className="w-full text-center py-2 bg-white/5 rounded-xl border border-[#1a1a1a] text-xs text-[#555] font-bold uppercase tracking-wider">
                                            Commande clôturée
                                        </div>
                                    )}
                                </div>

                                {/* Delivery Address */}
                                <div className="p-4 bg-black border border-[#1a1a1a] rounded-2xl space-y-2">
                                    <h4 className="text-[10px] uppercase tracking-widest text-[#555] font-bold">Adresse de livraison</h4>
                                    <div className="flex items-start gap-2 text-white text-sm">
                                        <MapPin className="w-4 h-4 mt-0.5 text-[#00D97E] shrink-0" />
                                        <span>{selectedOrder.address}</span>
                                    </div>
                                </div>

                                {/* Items list */}
                                <div className="space-y-3">
                                    <h4 className="text-[10px] uppercase tracking-widest text-[#555] font-bold">Détail des articles</h4>
                                    <div className="border border-[#1a1a1a] rounded-2xl overflow-hidden bg-black divide-y divide-[#1a1a1a]">
                                        {selectedOrder.items.map((item: any, idx: number) => (
                                            <div key={idx} className="p-4 flex justify-between items-center text-sm">
                                                <div>
                                                    <p className="font-bold text-white">{item.productName}</p>
                                                    <p className="text-xs text-[#555] mt-0.5">{item.quantity} × {item.price.toLocaleString()} F</p>
                                                </div>
                                                <p className="font-bold text-[#00D97E] font-mono">{(item.quantity * item.price).toLocaleString()} F</p>
                                            </div>
                                        ))}
                                        <div className="p-4 flex justify-between items-center bg-[#111]/50 text-sm font-bold">
                                            <p className="text-white">Total</p>
                                            <p className="text-lg text-white font-mono">{selectedOrder.total.toLocaleString()} F</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}

export default function DevPreview() {
    const [view, setView] = useState<'today' | 'inbox' | 'orders' | 'inventory' | 'bot'>('today');
    const navItems = [
        { k: 'today' as const, icon: Home, label: 'Accueil' },
        { k: null, icon: MessageSquare, label: 'Conv' },
        { k: 'orders' as const, icon: ShoppingBag, label: 'Commandes' },
        { k: 'inventory' as const, icon: Package, label: 'Produits' },
        { k: 'bot' as const, icon: SettingsIcon, label: 'Réglages' },
    ];

    return (
        <div className="min-h-screen bg-black text-white">
            <div className="px-4 py-4 pb-28 max-w-2xl mx-auto">
                {view === 'today' ? (
                    <TodayView
                        greeting="Bonjour" displayName="Alex" dateStr="mardi 1 juillet"
                        botStatus="connected" botActive={true} togglingBot={false} loading={false}
                        newOrdersCount={2} paidOrdersCount={1} productCount={6}
                        logs={MOCK_LOGS} lastSaleAgo="12min"
                        todayRevenue={84000} todayOrdersCount={5} yesterdayOrdersCount={3} revenueDelta={32}
                        showInstallBanner={true} isInstallable={false} isIOS={true}
                        onToggleBot={() => {}} onInstall={() => {}} onDismissInstall={() => {}}
                    />
                ) : view === 'bot' ? (
                    <BotPreview />
                ) : view === 'orders' ? (
                    <OrdersPreview />
                ) : (
                    <InventoryPreview />
                )}
            </div>

            {/* Barre de navigation basse — comme la vraie app (DashboardLayout) */}
            <nav className="fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-[#1a1a1a]">
                <div className="flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] max-w-2xl mx-auto">
                    {navItems.map((it, idx) => {
                        const active = it.k === view;
                        return (
                            <button key={idx} onClick={() => it.k && setView(it.k)} className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px] active:scale-90 transition-transform">
                                <div className={`p-1.5 rounded-xl ${active ? 'bg-[#00D97E]/15' : ''}`}>
                                    <it.icon size={22} className={active ? 'text-[#00D97E]' : 'text-[#888]'} strokeWidth={active ? 2.5 : 1.5} />
                                </div>
                                <span className={`text-[10px] font-medium ${active ? 'text-[#00D97E]' : 'text-[#555]'}`}>{it.label}</span>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
}
