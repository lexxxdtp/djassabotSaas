import PageHeading from '../components/ui/PageHeading';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ShoppingBag, Clock, MapPin, X, AlertCircle, Send,
    CheckCircle2, Search, CreditCard
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { toUIStatus, type UIStatus } from '../utils/overviewMetrics';
import { buildDeliverySlip } from '../utils/deliverySlip';
import { useAuth } from '../context/AuthContext';
import { useModalA11y } from '../hooks/useModalA11y';
import { toast } from 'react-hot-toast';

// Backend keeps the full enum for compatibility, but the UI only exposes 4 states.
// Le mapping vit dans utils/overviewMetrics pour rester identique partout.
type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

interface Order {
    id: string;
    userId: string;
    total: number;
    status: OrderStatus;
    address: string;
    paymentMethod?: string;
    items: {
        // productId distingue la ligne de livraison (_delivery) des articles.
        productId: string;
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
    CANCELLED: { label: 'Annulée', color: 'text-[var(--color-muted)] bg-white/5 border-[var(--color-border)]', icon: X },
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

const shareOrder = async (order: Order, merchantPhone?: string) => {
    // Une commande encore « Nouvelle » n'est pas encaissée : le livreur collecte.
    const message = buildDeliverySlip(order, {
        merchantPhone,
        alreadyPaid: toUIStatus(order.status) === 'PAID',
    });
    if (navigator.share) {
        try { await navigator.share({ text: message }); return; } catch { /* fall through */ }
    }
    try {
        await navigator.clipboard.writeText(message);
        toast.success('📋 Fiche copiée ! Collez-la dans votre groupe livreurs.');
    } catch {
        toast.error('Impossible de copier');
    }
};

// --- SKELETONS ---
function OrderSkeleton() {
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[13px] p-4 animate-pulse space-y-4">
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
    merchantPhone?: string;
}

const OrderModal = ({ order, onClose, onUpdateStatus, merchantPhone }: OrderModalProps) => {
    const dialogRef = useModalA11y(onClose);
    const ui = toUIStatus(order.status);
    const meta = UI_META[ui];

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={`Commande ${order.id.split('-').pop()?.slice(0, 6) || order.id.slice(0, 6)}`}
                tabIndex={-1}
                className="bg-[var(--color-surface)] border-t md:border border-[var(--color-border)] rounded-t-3xl md:rounded-[13px] w-full max-w-lg shadow-none relative overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Drag Indicator on Mobile */}
                <div className="w-12 h-1 bg-[#222] rounded-full mx-auto my-3 md:hidden shrink-0"></div>

                {/* Header */}
                <div className="px-6 pb-4 flex justify-between items-start border-b border-[var(--color-border)] pt-2 md:pt-6 shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            <h2 className="text-xl font-bold text-white font-mono">#{order.id.split('-').pop()?.slice(0, 6) || order.id.slice(0, 6)}</h2>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <p className="text-[var(--color-muted)] text-xs uppercase tracking-wider font-bold">
                            WhatsApp : {order.userId}
                        </p>
                    </div>
                    <button onClick={onClose} aria-label="Fermer le tiroir" className="text-[var(--color-muted)] hover:text-white transition-colors bg-[#1a1a1a] p-1.5 rounded-full cursor-pointer">
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
                                    onClick={() => shareOrder(order, merchantPhone)}
                                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white border border-[var(--color-border)] rounded-xl text-xs font-bold uppercase transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
                                >
                                    <Send size={14} aria-hidden="true" /> Fiche livreur
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                                    className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl text-xs font-bold uppercase transition-transform active:scale-[0.99]"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'PAID')}
                                    className="flex-1 py-3 bg-[#00D97E] hover:bg-[#00D97E]/95 text-black rounded-xl text-xs font-bold uppercase transition-transform active:scale-[0.99] shadow-none shadow-[#00D97E]/20"
                                >
                                    Marquer payée
                                </button>
                            </>
                        )}
                        {ui === 'PAID' && (
                            <>
                                <button
                                    onClick={() => shareOrder(order, merchantPhone)}
                                    className="flex-1 py-3 bg-[#00D97E]/10 hover:bg-[#00D97E]/20 text-[#00D97E] border border-[#00D97E]/20 rounded-xl text-xs font-bold uppercase transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
                                >
                                    <Send size={14} aria-hidden="true" /> Fiche livreur
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'DELIVERED')}
                                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black rounded-xl text-xs font-bold uppercase transition-transform active:scale-[0.99] shadow-none shadow-emerald-500/20"
                                >
                                    Marquer livrée
                                </button>
                            </>
                        )}
                        {(ui === 'DELIVERED' || ui === 'CANCELLED') && (
                            <div className="w-full text-center py-2.5 bg-white/5 rounded-xl border border-[var(--color-border)] text-xs text-[var(--color-muted)] font-bold uppercase tracking-wider">
                                Commande clôturée
                            </div>
                        )}
                    </div>

                    {/* Delivery Address */}
                    <div className="p-4 bg-black border border-[var(--color-border)] rounded-[13px] space-y-2">
                        <h4 className="text-xs uppercase tracking-widest text-[var(--color-muted)] font-bold">Adresse de livraison</h4>
                        <div className="flex items-start gap-2 text-white text-sm">
                            <MapPin className="w-4 h-4 mt-0.5 text-[#00D97E] shrink-0" />
                            <span>{order.address || 'Non renseignée'}</span>
                        </div>
                        {order.paymentMethod && (
                            <div className="text-[var(--color-muted)] text-xs uppercase tracking-wider font-semibold">Paiement : {order.paymentMethod}</div>
                        )}
                    </div>

                    {/* Items */}
                    <div className="space-y-3">
                        <h4 className="text-xs uppercase tracking-widest text-[var(--color-muted)] font-bold">Détail des articles</h4>
                        <div className="border border-[var(--color-border)] rounded-[13px] overflow-hidden bg-black divide-y divide-[var(--color-border)]">
                            {order.items.map((item, idx) => (
                                <div key={idx} className="p-4 flex justify-between items-center text-sm">
                                    <div>
                                        <p className="font-bold text-white">{item.productName}</p>
                                        <p className="text-xs text-[var(--color-muted)] mt-0.5">
                                            {item.quantity} × {item.price.toLocaleString()} F
                                            {item.selectedVariations?.length ? ` (${item.selectedVariations.map(v => v.value).join(', ')})` : ''}
                                        </p>
                                    </div>
                                    <p className="font-bold text-[#00D97E] font-mono">{(item.price * item.quantity).toLocaleString()} F</p>
                                </div>
                            ))}
                            <div className="p-4 flex justify-between items-center bg-[var(--color-surface)]/50 text-sm font-bold">
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
            className={`w-full text-left bg-[var(--color-surface)] border rounded-[13px] p-4 sm:p-5 hover:border-[#00D97E]/20 transition-all active:scale-[0.99] transition-transform duration-100 cursor-pointer flex flex-col gap-3 ${
                isNew ? 'border-amber-500/25' : 'border-[var(--color-border)]'
            }`}
        >
            <div className="flex justify-between items-start w-full gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl border ${meta.color} shrink-0`}>
                        <meta.icon size={18} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white text-sm font-mono">
                                #{order.id.split('-').pop()?.slice(0, 6) || order.id.slice(0, 6)}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <p className="text-[var(--color-muted)] text-xs mt-1 uppercase tracking-wider font-semibold truncate">{order.userId.split('@')[0]}</p>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <div className="font-mono text-white text-sm font-bold">{order.total.toLocaleString()} F</div>
                    <div className="text-xs text-[var(--color-muted)] mt-0.5 flex items-center gap-1 justify-end">
                        <Clock size={10} aria-hidden="true" />
                        <span>{new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>
            </div>

            {order.address && (
                <div className="text-xs text-[var(--color-muted)] flex items-center gap-1.5 pt-2 border-t border-[var(--color-border)]/50">
                    <MapPin size={12} className="text-[var(--color-muted)] shrink-0" aria-hidden="true" />
                    <span className="truncate">{order.address}</span>
                </div>
            )}
        </button>
    );
};

// --- MAIN ---

export default function Orders() {
    const { token, user } = useAuth();
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
            .then(res => {
                if (res.ok) return res.json();
                toast.error('Impossible de charger les commandes.');
                return [];
            })
            .then(data => {
                setOrders(Array.isArray(data) ? data : []);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                toast.error('Erreur réseau. Impossible de charger les commandes.');
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
            const res = await apiClient(`/orders/${orderId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Erreur lors de la mise à jour.');
            }
            fetchOrders();
            if (selectedOrder?.id === orderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
        } catch (e: unknown) {
            console.error('Update failed', e);
            toast.error(e instanceof Error ? e.message : 'Impossible de mettre à jour le statut de la commande.');
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
                    merchantPhone={user?.phone}
                />
            )}

            <PageHeading eyebrow="Du panier à la livraison" title="Vos commandes" description="Retrouvez les articles, les paiements et les livraisons à préparer." action={<span className="bot-badge">{counts.all} commande{counts.all > 1 ? 's' : ''}</span>} />

            {/* FILTERS Segmented Control iOS-like */}
            <div className="flex bg-[var(--color-surface)] p-1 rounded-xl border border-[var(--color-border)] w-full overflow-x-auto scrollbar-hide">
                {filters.map(f => {
                    const isActive = activeFilter === f.key;
                    const count = counts[f.key];
                    return (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex-1 min-w-[76px] py-2 text-center text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-[0.99] duration-100 ${
                                isActive ? 'bg-[#1a1a1a] text-white shadow-sm border border-white/5' : 'text-[var(--color-muted)] hover:text-white'
                            }`}
                        >
                            <span>{f.label}</span>
                            <span className={`text-xs px-1.5 py-0.2 rounded font-mono ${
                                isActive ? 'bg-[#00D97E] text-black font-bold' : 'bg-black/40 text-[var(--color-muted)]'
                            }`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* SEARCH */}
            <div className="relative">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] pointer-events-none" aria-hidden="true" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par ID, client ou adresse…"
                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl h-11 pl-11 pr-4 text-sm text-white placeholder:text-[var(--color-muted)] outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow]"
                />
            </div>

            {/* LIST */}
            {loading ? (
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => <OrderSkeleton key={i} />)}
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[var(--color-border)] rounded-[13px] bg-[#0d0d0d]">
                    {orders.length === 0 ? (
                        <>
                            <ShoppingBag className="mx-auto h-10 w-10 text-[#333] mb-3" aria-hidden="true" />
                            <h3 className="text-sm font-medium text-white">Aucune commande</h3>
                            <p className="text-[var(--color-muted)] text-xs mt-1">Vos premières ventes apparaîtront ici.</p>
                        </>
                    ) : (
                        <>
                            <AlertCircle className="mx-auto h-10 w-10 text-[#333] mb-3" aria-hidden="true" />
                            <h3 className="text-sm font-medium text-white">Aucun résultat</h3>
                            <p className="text-[var(--color-muted)] text-xs mt-1">
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
