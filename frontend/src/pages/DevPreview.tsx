// TEMP — page de prévisualisation pour l'itération design. À SUPPRIMER.
import { useState, useMemo } from 'react';
import { Plus, Search, PackageOpen, Home, MessageSquare, ShoppingBag, Package, Settings as SettingsIcon } from 'lucide-react';
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

export default function DevPreview() {
    const [view, setView] = useState<'today' | 'inventory' | 'bot'>('today');
    const navItems = [
        { k: 'today' as const, icon: Home, label: 'Accueil' },
        { k: null, icon: MessageSquare, label: 'Conv' },
        { k: null, icon: ShoppingBag, label: 'Commandes' },
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
