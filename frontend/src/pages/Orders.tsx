import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ShoppingBag, Clock, MapPin, X, AlertCircle, Send,
    CheckCircle2, Search, CreditCard
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

// Backend keeps the full enum for compatibility, but the UI only exposes 4 states.
// Legacy CONFIRMED is shown as NOUVELLE (still awaiting payment), legacy SHIPPING as PAYÉE.
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
type UIStatus = 'NEW' | 'PAID' | 'DELIVERED' | 'CANCELLED';

const toUIStatus = (s: OrderStatus): UIStatus => {
    if (s === 'PENDING' || s === 'CONFIRMED') return 'NEW';
    if (s === 'PAID' || s === 'SHIPPING') return 'PAID';
    if (s === 'DELIVERED') return 'DELIVERED';
    return 'CANCELLED';
};

interface Order {
    id: string;
    userId: string;
    total: number;
    status: OrderStatus;
    address: string;
    paymentMethod?: string;
    items: {
        productName: string;
        quantity: number;
        price: number;
        selectedVariations?: { name: string; value: string }[];
    }[];
    createdAt: string;
}

type FilterKey = 'all' | 'new' | 'paid' | 'done' | 'cancelled';

// --- HELPERS ---

const UI_META: Record<UIStatus, { label: string; color: string; icon: React.ElementType }> = {
    NEW: { label: 'Nouvelle', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertCircle },
    PAID: { label: 'Payée', color: 'text-[#00D97E] bg-[#00D97E]/10 border-[#00D97E]/20', icon: CreditCard },
    DELIVERED: { label: 'Livrée', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    CANCELLED: { label: 'Annulée', color: 'text-[#666] bg-white/5 border-[#1a1a1a]', icon: X },
};

const matchesFilter = (order: Order, filter: FilterKey): boolean => {
    const ui = toUIStatus(order.status);
    switch (filter) {
        case 'all': return true;
        case 'new': return ui === 'NEW';
        case 'paid': return ui === 'PAID';
        case 'done': return ui === 'DELIVERED';
        case 'cancelled': return ui === 'CANCELLED';
        default: return true;
    }
};

const generateDeliveryMessage = (order: Order): string => {
    const items = order.items.map(i =>
        `  • ${i.quantity}x ${i.productName}${i.selectedVariations?.length ? ` (${i.selectedVariations.map(v => v.value).join(', ')})` : ''}`
    ).join('\n');
    return `📦 COMMANDE #${order.id}\n\n👤 Client : ${order.userId}\n\n🛒 Articles :\n${items}\n\n💰 Total : ${order.total.toLocaleString()} FCFA\n📍 Adresse : ${order.address || 'Non renseignée'}\n\nSaaS : DjassaBot`;
};

const shareOrder = async (order: Order) => {
    const message = generateDeliveryMessage(order);
    if (navigator.share) {
        try { await navigator.share({ text: message }); return; } catch { /* fall through */ }
    }
    try {
        await navigator.clipboard.writeText(message);
        toast.success('📋 Résumé copié ! Collez-le dans votre groupe livreurs.');
    } catch {
        toast.error('Impossible de copier');
    }
};

// --- SKELETONS ---
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

// --- MODAL ---

interface OrderModalProps {
    order: Order;
    onClose: () => void;
    onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

const OrderModal = ({ order, onClose, onUpdateStatus }: OrderModalProps) => {
    const ui = toUIStatus(order.status);
    const meta = UI_META[ui];

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#111] border-t md:border border-[#1a1a1a] rounded-t-3xl md:rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Drag Indicator on Mobile */}
                <div className="w-12 h-1 bg-[#222] rounded-full mx-auto my-3 md:hidden shrink-0"></div>

                {/* Header */}
                <div className="px-6 pb-4 flex justify-between items-start border-b border-[#1a1a1a] pt-2 md:pt-6 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h2 className="text-xl font-bold text-white font-mono">#{order.id.split('-').pop()?.slice(0, 6) || order.id.slice(0, 6)}</h2>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <p className="text-[#555] text-[10px] uppercase tracking-wider font-bold">
                            WhatsApp : {order.userId}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fermer le tiroir" className="text-[#888] hover:text-white transition-colors bg-[#1a1a1a] p-1.5 rounded-full cursor-pointer">
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Actions — only 2 transitions: NEW → PAID → DELIVERED */}
                    <div className="flex gap-2">
                        {ui === 'NEW' && (
                            <>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                                    className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-transform active:scale-95"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'PAID')}
                                    className="flex-1 py-3 bg-[#00D97E] hover:bg-[#00D97E]/95 text-black rounded-xl text-xs font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-[#00D97E]/20"
                                >
                                    Marquer payée
                                </button>
                            </>
                        )}
                        {ui === 'PAID' && (
                            <>
                                <button
                                    onClick={() => shareOrder(order)}
                                    className="flex-1 py-3 bg-[#00D97E]/10 hover:bg-[#00D97E]/20 text-[#00D97E] border border-[#00D97E]/20 rounded-xl text-xs font-bold uppercase transition-transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Send size={14} aria-hidden="true" /> Envoyer au livreur
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'DELIVERED')}
                                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-xs font-bold uppercase transition-transform active:scale-95 shadow-lg shadow-emerald-500/20"
                                >
                                    Marquer livrée
                                </button>
                            </>
                        )}
                        {(ui === 'DELIVERED' || ui === 'CANCELLED') && (
                            <div className="w-full text-center py-2.5 bg-white/5 rounded-xl border border-[#1a1a1a] text-xs text-[#555] font-bold uppercase tracking-wider">
                                Commande clôturée
                            </div>
                        )}
                    </div>

                    {/* Delivery Address */}
                    <div className="p-4 bg-black border border-[#1a1a1a] rounded-2xl space-y-2">
                        <h4 className="text-[10px] uppercase tracking-widest text-[#555] font-bold">Adresse de livraison</h4>
                        <div className="flex items-start gap-2 text-white text-sm">
                            <MapPin className="w-4 h-4 mt-0.5 text-[#00D97E] shrink-0" />
                            <span>{order.address || 'Non renseignée'}</span>
                        </div>
                        {order.paymentMethod && (
                            <div className="text-[#555] text-[10px] uppercase tracking-wider font-semibold">Paiement : {order.paymentMethod}</div>
                        )}
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] uppercase tracking-widest text-[#555] font-bold">Détail des articles</h4>
                        <div className="border border-[#1a1a1a] rounded-2xl overflow-hidden bg-black divide-y divide-[#1a1a1a]">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-bold text-white">{item.productName}</p>
                                        <p className="text-xs text-[#555] mt-0.5">
                                            {item.quantity} × {item.price.toLocaleString()} F
                                            {item.selectedVariations?.length ? ` (${item.selectedVariations.map(v => v.value).join(', ')})` : ''}
                                        </p>
                                    </div>
                                    <p className="font-bold text-[#00D97E] font-mono">{(item.price * item.quantity).toLocaleString()} F</p>
                                </div>
                            ))}
                            <div className="p-4 flex justify-between items-center bg-[#111]/50 text-sm font-bold">
                                <p className="text-white">Total</p>
                                <p className="text-lg text-white font-mono">{order.total.toLocaleString()} F</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- ORDER ROW ---

const OrderRow = ({ order, onClick }: { order: Order; onClick: () => void }) => {
    const ui = toUIStatus(order.status);
    const meta = UI_META[ui];
    const isNew = ui === 'NEW';

    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-[#111] border rounded-2xl p-4 sm:p-5 hover:border-[#00D97E]/20 transition-all active:scale-[0.99] transition-transform duration-100 cursor-pointer flex flex-col gap-3 ${
                isNew ? 'border-amber-500/25' : 'border-[#1a1a1a]'
            }`}
        >
            <div className="flex justify-between items-start w-full">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl border ${meta.color}`}>
                        <meta.icon size={18} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm font-mono">
                                #{order.id.split('-').pop()?.slice(0, 6) || order.id.slice(0, 6)}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <p className="text-[#555] text-[10px] mt-1 uppercase tracking-wider font-semibold">{order.userId}</p>
                    </div>
                </div>

                <div className="text-right">
                    <div className="font-mono text-white text-sm font-bold">{order.total.toLocaleString()} F</div>
                    <div className="text-[10px] text-[#555] mt-0.5 flex items-center gap-1 justify-end">
                        <Clock size={10} aria-hidden="true" />
                        <span>{new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>

            {order.address && (
                <div className="text-xs text-[#888] flex items-center gap-1.5 pt-2 border-t border-[#1a1a1a]/50">
                    <MapPin size={12} className="text-[#555] shrink-0" aria-hidden="true" />
                    <span className="truncate">{order.address}</span>
                </div>
            )}
        </button>
    );
};

// --- MAIN ---

export default function Orders() {
    const { token } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const activeFilter = (searchParams.get('filter') as FilterKey) || 'all';
    const setActiveFilter = (f: FilterKey) => {
        if (f === 'all') searchParams.delete('filter');
        else searchParams.set('filter', f);
        setSearchParams(searchParams);
    };

    const fetchOrders = useCallback(() => {
        apiClient('/orders')
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                setOrders(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setOrders([]);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        if (token) fetchOrders();
    }, [token, fetchOrders]);

    const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
        try {
            const tempOrders = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
            setOrders(tempOrders);
            await apiClient(`/orders/${orderId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            fetchOrders();
            if (selectedOrder?.id === orderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
        } catch (e) {
            console.error('Update failed', e);
            fetchOrders();
        }
    };

    const counts = useMemo(() => {
        const by = (target: UIStatus) => orders.filter(o => toUIStatus(o.status) === target).length;
        return {
            all: orders.length,
            new: by('NEW'),
            paid: by('PAID'),
            done: by('DELIVERED'),
            cancelled: by('CANCELLED'),
        };
    }, [orders]);

    const filters: { key: FilterKey; label: string }[] = [
        { key: 'all', label: 'Tout' },
        { key: 'new', label: 'Nouvelles' },
        { key: 'paid', label: 'Payées' },
        { key: 'done', label: 'Livrées' },
        { key: 'cancelled', label: 'Annulées' },
    ];

    const filteredOrders = useMemo(() => {
        return orders
            .filter(o => matchesFilter(o, activeFilter))
            .filter(o => {
                if (!searchTerm.trim()) return true;
                const q = searchTerm.toLowerCase();
                return o.id.toLowerCase().includes(q) ||
                    o.userId.toLowerCase().includes(q) ||
                    (o.address || '').toLowerCase().includes(q);
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }, [orders, activeFilter, searchTerm]);

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {selectedOrder && (
                <OrderModal
                    order={selectedOrder}
                    onClose={() => setSelectedOrder(null)}
                    onUpdateStatus={updateStatus}
                />
            )}

            {/* HEADER */}
            <div className="flex items-end justify-between border-b border-[#1a1a1a] pb-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Commandes</h1>
                    <p className="text-[#888] text-xs md:text-sm mt-1">
                        {counts.new > 0
                            ? <><span className="text-amber-500 font-bold">{counts.new}</span> nouvelles · <span className="text-[#00D97E] font-bold">{counts.paid}</span> payées</>
                            : counts.paid > 0
                                ? <><span className="text-[#00D97E] font-bold">{counts.paid}</span> payées</>
                                : 'Tout est à jour 🌴'}
                    </p>
                </div>
                <div className="text-[10px] text-[#888] font-mono bg-[#111] border border-[#1a1a1a] px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    {counts.all} au total
                </div>
            </div>

            {/* FILTERS Segmented Control iOS-like */}
            <div className="flex bg-[#111] p-1 rounded-xl border border-[#1a1a1a] w-full overflow-x-auto scrollbar-hide">
                {filters.map(f => {
                    const isActive = activeFilter === f.key;
                    const count = counts[f.key];
                    return (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex-1 min-w-[76px] py-2 text-center text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 duration-100 ${
                                isActive ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/5' : 'text-[#888] hover:text-white'
                            }`}
                        >
                            <span>{f.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                isActive ? 'bg-[#00D97E] text-black font-bold' : 'bg-black/40 text-[#555]'
                            }`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* SEARCH */}
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] pointer-events-none" aria-hidden="true" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par ID, client ou adresse…"
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl h-11 pl-11 pr-4 text-sm text-white placeholder:text-[#555] outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow]"
                />
            </div>

            {/* LIST */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <OrderSkeleton key={i} />)}
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[#1a1a1a] rounded-2xl bg-[#0d0d0d]">
                    {orders.length === 0 ? (
                        <>
                            <ShoppingBag className="mx-auto h-10 w-10 text-[#333] mb-3" aria-hidden="true" />
                            <h3 className="text-sm font-medium text-white">Aucune commande</h3>
                            <p className="text-[#555] text-xs mt-1">Vos premières ventes apparaîtront ici.</p>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="mx-auto h-10 w-10 text-[#333] mb-3" aria-hidden="true" />
                            <h3 className="text-sm font-medium text-white">Aucun résultat</h3>
                            <p className="text-[#555] text-xs mt-1">
                                {searchTerm ? 'Essayez un autre terme.' : 'Aucune commande dans ce filtre.'}
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map((order, i) => (
                        <div
                            key={order.id}
                            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both"
                            style={{ animationDuration: '300ms', animationDelay: `${Math.min(i, 8) * 45}ms` }}
                        >
                            <OrderRow
                                order={order}
                                onClick={() => setSelectedOrder(order)}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
