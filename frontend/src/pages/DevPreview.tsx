/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
// TEMP — page de prévisualisation pour l'itération design. À SUPPRIMER.
import { useState, useMemo, useEffect } from 'react';
import { 
    Plus, Search, PackageOpen, Home, MessageSquare, ShoppingBag, Package, 
    Settings as SettingsIcon, MapPin, X, Send, CheckCircle2, 
    CreditCard, AlertCircle, Zap, ArrowLeft, Bot
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

const MOCK_CHATS = [
    {
        id: '1',
        name: 'Amina Diallo',
        phone: '+225 07 45 89 12 03',
        lastMessage: 'Je viens de t’envoyer le reçu Wave de 30 000 F',
        time: '12 min',
        unread: 1,
        autopilot: true,
        state: 'WAITING_ADDRESS_VALIDATION',
        stateLabel: 'Attente Adresse',
        messages: [
            { id: 'm1', role: 'user' as const, text: 'Bonjour, je veux commander 2 bazins riches bleus s\'il vous plaît.' },
            { id: 'm2', role: 'model' as const, text: 'Salut Amina ! 😊 C\'est noté. Les 2 bazins riches bleus font 30 000 FCFA au total.\n\nQuelle est ton adresse de livraison pour que je prépare l\'expédition ?' },
            { id: 'm3', role: 'user' as const, text: 'J’habite à Cocody Angré, près de la pharmacie des Oscars.' },
            { id: 'm4', role: 'model' as const, text: 'Parfait ! La livraison pour Cocody fait 1 500 FCFA. Le total général fait donc 31 500 FCFA.\n\nTu peux faire le dépôt de 31 500 FCFA sur ce numéro Wave : 0700000000. Envoie-moi la capture du reçu une fois fait !' },
            { id: 'm5', role: 'user' as const, text: 'Je viens de t’envoyer le reçu Wave de 30 000 F' }
        ]
    },
    {
        id: '2',
        name: 'Koffi Kouamé',
        phone: '+225 05 12 34 56 78',
        lastMessage: 'Est-ce que tu peux faire 40 000 F pour les mèches ?',
        time: '35 min',
        unread: 0,
        autopilot: true,
        state: 'NEGOTIATION',
        stateLabel: 'Négociation',
        messages: [
            { id: 'm1', role: 'user' as const, text: 'Bonjour, c\'est combien les mèches brésiliennes 22" ?' },
            { id: 'm2', role: 'model' as const, text: 'Bonjour Koffi ! Nos mèches brésiliennes 22" sont à 45 000 FCFA. C\'est de la qualité premium.' },
            { id: 'm3', role: 'user' as const, text: 'Est-ce que tu peux faire 40 000 F pour les mèches ?' }
        ]
    },
    {
        id: '3',
        name: 'Mariam Koné',
        phone: '+225 01 78 89 90 22',
        lastMessage: 'Merci beaucoup, à demain pour la livraison !',
        time: '2 h',
        unread: 0,
        autopilot: false,
        state: 'IDLE',
        stateLabel: 'Finalisé',
        messages: [
            { id: 'm1', role: 'user' as const, text: 'Le paiement est fait par Orange Money' },
            { id: 'm2', role: 'model' as const, text: 'Reçu bien validé ! Votre commande est en cours de préparation. La livraison aura lieu demain matin.' },
            { id: 'm3', role: 'user' as const, text: 'Merci beaucoup, à demain pour la livraison !' }
        ]
    }
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

function InboxPreview() {
    const [chats, setChats] = useState(MOCK_CHATS);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'auto' | 'manual' | 'unread'>('all');
    const [typingText, setTypingText] = useState('');

    const activeChat = useMemo(() => chats.find(c => c.id === selectedId), [chats, selectedId]);

    const filteredChats = useMemo(() => {
        return chats.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
            const matchesFilter = 
                filter === 'all' ||
                (filter === 'auto' && c.autopilot) ||
                (filter === 'manual' && !c.autopilot) ||
                (filter === 'unread' && c.unread > 0);
            return matchesSearch && matchesFilter;
        });
    }, [chats, search, filter]);

    const handleToggleAutopilot = (id: string) => {
        setChats(prev => prev.map(c => c.id === id ? { ...c, autopilot: !c.autopilot } : c));
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!typingText.trim() || !selectedId) return;

        const userMsg = { id: `m_user_${Date.now()}`, role: 'user' as const, text: typingText };
        
        setChats(prev => prev.map(c => {
            if (c.id === selectedId) {
                return { 
                    ...c, 
                    messages: [...c.messages, userMsg],
                    lastMessage: typingText,
                    time: 'À l’instant'
                };
            }
            return c;
        }));

        setTypingText('');

        // Simulate Bot Auto Reply if autopilot is active
        if (activeChat?.autopilot) {
            setTimeout(() => {
                const botMsg = { 
                    id: `m_bot_${Date.now()}`, 
                    role: 'model' as const, 
                    text: 'D’accord, j’enregistre cela pour vous ! Je suis le bot de démo DjassaBot 🤖.' 
                };
                setChats(prev => prev.map(ch => {
                    if (ch.id === selectedId) {
                        return {
                            ...ch,
                            messages: [...ch.messages, botMsg],
                            lastMessage: botMsg.text,
                            time: 'À l’instant'
                        };
                    }
                    return ch;
                }));
            }, 1000);
        }
    };

    if (activeChat) {
        return (
            <div className="flex flex-col h-[calc(100vh-10rem)] bg-black animate-in fade-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#1a1a1a] pb-3 pt-1">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSelectedId(null)} className="p-1.5 rounded-full bg-[#111] border border-[#1a1a1a] text-[#888] hover:text-white active:scale-90 transition-transform">
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <h2 className="font-bold text-white text-base leading-none">{activeChat.name}</h2>
                            <p className="text-[10px] text-[#555] font-bold mt-1 tracking-wider uppercase">{activeChat.phone}</p>
                        </div>
                    </div>

                    {/* Autopilot pill toggle */}
                    <button 
                        onClick={() => handleToggleAutopilot(activeChat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all active:scale-95 ${
                            activeChat.autopilot 
                            ? 'bg-[#00D97E]/10 text-[#00D97E] border-[#00D97E]/20 font-bold' 
                            : 'bg-[#111] text-[#888] border-[#1a1a1a]'
                        }`}
                    >
                        <Zap size={13} fill={activeChat.autopilot ? 'currentColor' : 'none'} className={activeChat.autopilot ? 'animate-pulse' : ''} />
                        <span className="text-[10px] tracking-wider uppercase font-bold">
                            {activeChat.autopilot ? 'IA Active' : 'Manuel'}
                        </span>
                    </button>
                </div>

                {/* State warning banner */}
                <div className="my-2 py-1.5 px-3 bg-[#111] border border-[#1a1a1a] rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00D97E] animate-ping"></div>
                        <span className="text-[10px] text-[#888] font-medium">État du client :</span>
                        <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-[#222] px-2 py-0.5 rounded border border-[#333]">
                            {activeChat.stateLabel}
                        </span>
                    </div>
                </div>

                {/* Messages Feed */}
                <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1 scrollbar-hide">
                    {activeChat.messages.map((m) => {
                        const isBot = m.role === 'model';
                        return (
                            <div key={m.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'} items-end gap-1.5`}>
                                {isBot && (
                                    <div className="w-6 h-6 rounded-lg bg-[#00D97E]/10 border border-[#00D97E]/20 text-[#00D97E] flex items-center justify-center shrink-0">
                                        <Bot size={12} />
                                    </div>
                                )}
                                <div className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                                    isBot 
                                    ? 'bg-[#111] text-white border border-[#1a1a1a] rounded-tl-sm' 
                                    : 'bg-[#00D97E] text-black font-medium rounded-tr-sm'
                                }`}>
                                    <p className="whitespace-pre-wrap">{m.text}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Input Area */}
                <form onSubmit={handleSendMessage} className="border-t border-[#1a1a1a] pt-3 pb-1 flex gap-2">
                    <input 
                        type="text" 
                        value={typingText}
                        onChange={(e) => typingText !== undefined && setTypingText(e.target.value)}
                        placeholder={activeChat.autopilot ? "Prenez la main en écrivant ici..." : "Écrivez votre message..."}
                        className="flex-1 bg-[#111] border border-[#1a1a1a] rounded-2xl px-4 py-3 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#00D97E]/40 transition-colors"
                    />
                    <button 
                        type="submit" 
                        disabled={!typingText.trim()}
                        className="w-11 h-11 bg-[#00D97E] text-black rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-50 disabled:active:scale-100 active:scale-90 transition-all shadow-md shadow-[#00D97E]/20"
                    >
                        <Send size={16} />
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Discussions</h1>
                <p className="text-[#888] text-xs mt-0.5">Discutez en direct et contrôlez l’IA de vos clients</p>
            </div>

            {/* Filter buttons */}
            <div className="flex bg-[#111] p-1 rounded-xl border border-[#1a1a1a] w-full">
                {[
                    { key: 'all' as const, label: 'Tout' },
                    { key: 'auto' as const, label: 'IA Active' },
                    { key: 'manual' as const, label: 'Manuel' },
                    { key: 'unread' as const, label: 'Non lus' },
                ].map(b => (
                    <button
                        key={b.key}
                        onClick={() => setFilter(b.key)}
                        className={`flex-1 py-2 text-center text-xs font-semibold rounded-lg transition-all active:scale-95 duration-100 ${
                            filter === b.key ? 'bg-[#1a1a1a] text-white border border-white/5 shadow-sm' : 'text-[#888] hover:text-white'
                        }`}
                    >
                        {b.label}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom ou numéro…"
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl h-10 pl-10 pr-4 text-xs text-white placeholder:text-[#555] outline-none focus:border-[#00D97E]/40 transition-colors"
                />
            </div>

            {/* Chat list */}
            <div className="space-y-2">
                {filteredChats.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-[#1a1a1a] rounded-2xl bg-[#0d0d0d]">
                        <MessageSquare className="w-10 h-10 text-[#555] mx-auto mb-3" />
                        <h3 className="text-sm font-semibold text-white">Aucune discussion</h3>
                    </div>
                ) : (
                    filteredChats.map((c, i) => {
                        const initials = c.name.split(' ').map(n => n[0]).join('').slice(0, 2);
                        return (
                            <div key={c.id} className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDuration: '400ms', animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                                <button
                                    onClick={() => {
                                        setSelectedId(c.id);
                                        // mark read in preview
                                        setChats(prev => prev.map(ch => ch.id === c.id ? { ...ch, unread: 0 } : ch));
                                    }}
                                    className="w-full text-left bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 flex gap-3 hover:border-[#00D97E]/20 transition-all active:scale-[0.99] duration-100 cursor-pointer"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[#00D97E]/10 border border-[#00D97E]/20 text-[#00D97E] font-bold flex items-center justify-center shrink-0 text-sm">
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h3 className="font-bold text-white text-sm truncate">{c.name}</h3>
                                            <span className="text-[10px] text-[#555] font-semibold">{c.time}</span>
                                        </div>
                                        <p className="text-xs text-[#888] truncate pr-2 leading-relaxed">{c.lastMessage}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            {c.autopilot ? (
                                                <span className="flex items-center gap-1 text-[9px] bg-emerald-500/10 text-emerald-500 font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">
                                                    <Zap size={9} fill="currentColor" /> IA active
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-[9px] bg-zinc-500/10 text-[#888] font-bold px-2 py-0.5 rounded border border-zinc-500/20 uppercase tracking-wider">
                                                    Manuel
                                                </span>
                                            )}
                                            <span className="text-[9px] bg-[#222] text-white font-bold px-2 py-0.5 rounded border border-[#333] uppercase tracking-wider">
                                                {c.stateLabel}
                                            </span>
                                            {c.unread > 0 && (
                                                <span className="w-2.5 h-2.5 rounded-full bg-[#00D97E] ml-auto shrink-0 animate-pulse"></span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        );
                    })
                )}
            </div>
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
        { k: 'inbox' as const, icon: MessageSquare, label: 'Conv' },
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
                ) : view === 'inbox' ? (
                    <InboxPreview />
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
