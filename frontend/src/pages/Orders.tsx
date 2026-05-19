import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ShoppingBag, Clock, MapPin, X, AlertCircle, Package, Send,
    CheckCircle2, Truck, Search, Filter, CreditCard
} from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';

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

type FilterKey = 'all' | 'todo' | 'paid' | 'shipping' | 'done' | 'cancelled';

// --- HELPERS ---

const STATUS_META: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
    PENDING: { label: 'Nouvelle', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20', icon: AlertCircle },
    CONFIRMED: { label: 'Confirmée', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20', icon: CheckCircle2 },
    PAID: { label: 'Payée', color: 'text-[#00D97E] bg-[#00D97E]/10 border-[#00D97E]/20', icon: CreditCard },
    SHIPPING: { label: 'En livraison', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20', icon: Truck },
    DELIVERED: { label: 'Livrée', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20', icon: CheckCircle2 },
    CANCELLED: { label: 'Annulée', color: 'text-red-500 bg-red-500/10 border-red-500/20', icon: X },
};

const matchesFilter = (order: Order, filter: FilterKey): boolean => {
    switch (filter) {
        case 'all': return true;
        case 'todo': return order.status === 'PENDING' || order.status === 'CONFIRMED';
        case 'paid': return order.status === 'PAID';
        case 'shipping': return order.status === 'SHIPPING';
        case 'done': return order.status === 'DELIVERED';
        case 'cancelled': return order.status === 'CANCELLED';
        default: return true;
    }
};

const generateDeliveryMessage = (order: Order): string => {
    const items = order.items.map(i =>
        `  • ${i.quantity}x ${i.productName}${i.selectedVariations?.length ? ` (${i.selectedVariations.map(v => v.value).join(', ')})` : ''}`
    ).join('\n');
    return `📦 COMMANDE #${order.id}\n\n👤 Client : ${order.userId}\n\n🛒 Articles :\n${items}\n\n💰 Total : ${order.total.toLocaleString()} FCFA\n📍 Adresse : ${order.address || 'Non renseignée'}\n🕐 Date : ${new Date(order.createdAt).toLocaleString('fr-FR')}`;
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

// --- MODAL ---

interface OrderModalProps {
    order: Order;
    onClose: () => void;
    onUpdateStatus: (orderId: string, status: OrderStatus) => void;
}

const OrderModal = ({ order, onClose, onUpdateStatus }: OrderModalProps) => {
    const meta = STATUS_META[order.status];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="p-6 flex justify-between items-start border-b border-[#1a1a1a] shrink-0">
                    <div>
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h2 className="text-xl font-bold text-white tracking-tight">#{order.id}</h2>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <p className="text-[#888] text-xs flex items-center gap-2 uppercase tracking-wide">
                            <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleString('fr-FR')}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-[#888] hover:text-white transition-colors bg-white/5 hover:bg-[#1a1a1a] p-2 rounded-lg">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 justify-end">
                        {order.status === 'PENDING' && (
                            <>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'CANCELLED')}
                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg text-xs font-bold uppercase transition-all"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'CONFIRMED')}
                                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-lg shadow-blue-500/20"
                                >
                                    Confirmer
                                </button>
                            </>
                        )}
                        {order.status === 'CONFIRMED' && (
                            <button
                                onClick={() => onUpdateStatus(order.id, 'PAID')}
                                className="px-4 py-2 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black rounded-lg text-xs font-bold uppercase transition-all shadow-lg shadow-[#00D97E]/20"
                            >
                                Marquer Payée
                            </button>
                        )}
                        {order.status === 'PAID' && (
                            <>
                                <button
                                    onClick={() => shareOrder(order)}
                                    className="px-4 py-2 bg-[#00D97E]/10 hover:bg-[#00D97E]/20 text-[#00D97E] border border-[#00D97E]/20 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2"
                                >
                                    <Send size={14} /> Envoyer au livreur
                                </button>
                                <button
                                    onClick={() => onUpdateStatus(order.id, 'SHIPPING')}
                                    className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-bold uppercase transition-all shadow-lg shadow-purple-500/20"
                                >
                                    Démarrer livraison
                                </button>
                            </>
                        )}
                        {order.status === 'SHIPPING' && (
                            <button
                                onClick={() => onUpdateStatus(order.id, 'DELIVERED')}
                                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs font-bold uppercase transition-all shadow-lg shadow-emerald-500/20"
                            >
                                Marquer Livrée
                            </button>
                        )}
                        {(order.status === 'DELIVERED' || order.status === 'CANCELLED') && (
                            <span className="text-[#888] text-sm italic">Commande clôturée</span>
                        )}
                    </div>

                    {/* Customer */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-black border border-[#1a1a1a] rounded-xl">
                        <div>
                            <h3 className="text-[10px] uppercase tracking-widest text-[#888] font-bold mb-2">Client</h3>
                            <div className="text-white font-medium font-mono text-sm break-all">{order.userId}</div>
                            <div className="text-[#555] text-xs mt-1">Via WhatsApp</div>
                        </div>
                        <div>
                            <h3 className="text-[10px] uppercase tracking-widest text-[#888] font-bold mb-2">Livraison</h3>
                            <div className="flex items-start gap-2 text-zinc-300 text-sm">
                                <MapPin className="w-4 h-4 mt-0.5 text-[#00D97E] shrink-0" />
                                <span>{order.address || 'Non renseignée'}</span>
                            </div>
                            {order.paymentMethod && (
                                <div className="text-[#555] text-xs mt-1 uppercase">Paiement : {order.paymentMethod}</div>
                            )}
                        </div>
                    </div>

                    {/* Items */}
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-[#888] font-bold mb-3">Panier</h3>
                        <div className="overflow-hidden rounded-xl border border-[#1a1a1a] bg-black overflow-x-auto">
                            <table className="w-full text-sm text-left min-w-[400px]">
                                <thead className="bg-[#111] text-[#888] border-b border-[#1a1a1a]">
                                    <tr>
                                        <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wider">Produit</th>
                                        <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wider text-right">Prix</th>
                                        <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wider text-right">Qté</th>
                                        <th className="px-4 py-2.5 font-medium text-[10px] uppercase tracking-wider text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#1a1a1a]">
                                    {order.items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-[#111] transition-colors">
                                            <td className="px-4 py-3 text-white">
                                                {item.productName}
                                                {(item.selectedVariations || [])?.length > 0 && (
                                                    <div className="text-[10px] text-[#888]">{item.selectedVariations?.map(v => `${v.name}: ${v.value}`).join(', ')}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-[#888] text-right font-mono text-xs">{item.price.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-[#888] text-right font-mono text-xs">{item.quantity}</td>
                                            <td className="px-4 py-3 text-[#00D97E] font-medium text-right font-mono text-xs">{(item.price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-[#111] border-t border-[#1a1a1a]">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-white text-xs uppercase tracking-wider">Total</td>
                                        <td className="px-4 py-3 text-right font-bold text-white text-lg font-mono">{order.total.toLocaleString()} <span className="text-[10px] text-[#888]">F</span></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="bg-[#111] p-4 flex justify-end border-t border-[#1a1a1a]">
                    <button onClick={onClose} className="px-4 py-2 text-[#888] hover:text-white hover:bg-[#1a1a1a] rounded-lg transition-colors text-sm font-medium">
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- ORDER ROW ---

const OrderRow = ({ order, onClick }: { order: Order; onClick: () => void }) => {
    const meta = STATUS_META[order.status];
    const needsAction = order.status === 'PENDING';

    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-[#111] border rounded-xl p-4 sm:p-5 hover:border-[#00D97E]/30 transition-all group ${needsAction ? 'border-amber-500/30' : 'border-[#1a1a1a]'
                }`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`p-2.5 rounded-xl shrink-0 ${meta.color}`}>
                        <meta.icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white text-sm sm:text-base font-mono">
                                #{order.id.split('-').pop()?.slice(0, 6) || order.id.slice(0, 6)}
                            </h3>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${meta.color}`}>
                                {meta.label}
                            </span>
                        </div>
                        <p className="text-[#888] text-xs mt-1 flex items-center gap-2 flex-wrap">
                            <Clock size={10} />
                            <span>{new Date(order.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-[#444]">•</span>
                            <span>{order.items.length} art.</span>
                            {order.address && (
                                <>
                                    <span className="text-[#444]">•</span>
                                    <span className="truncate max-w-[140px]">{order.address}</span>
                                </>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {(order.status === 'PAID' || order.status === 'CONFIRMED') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); shareOrder(order); }}
                            className="p-2 rounded-lg bg-[#00D97E]/10 text-[#00D97E] border border-[#00D97E]/20 hover:bg-[#00D97E]/20 active:scale-90 transition-all"
                            title="Envoyer au livreur"
                        >
                            <Send size={14} />
                        </button>
                    )}
                    <div className="text-right">
                        <div className="font-mono text-white text-sm sm:text-base font-bold">{order.total.toLocaleString()}</div>
                        <div className="text-[10px] text-[#555] uppercase">FCFA</div>
                    </div>
                </div>
            </div>
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
            // Update modal if open
            if (selectedOrder?.id === orderId) {
                setSelectedOrder({ ...selectedOrder, status: newStatus });
            }
        } catch (e) {
            console.error('Update failed', e);
            fetchOrders();
        }
    };

    // Counts per filter
    const counts = useMemo(() => ({
        all: orders.length,
        todo: orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').length,
        paid: orders.filter(o => o.status === 'PAID').length,
        shipping: orders.filter(o => o.status === 'SHIPPING').length,
        done: orders.filter(o => o.status === 'DELIVERED').length,
        cancelled: orders.filter(o => o.status === 'CANCELLED').length,
    }), [orders]);

    const filters: { key: FilterKey; label: string; tone?: string }[] = [
        { key: 'all', label: 'Tout' },
        { key: 'todo', label: 'À traiter', tone: 'amber' },
        { key: 'paid', label: 'Payées', tone: 'green' },
        { key: 'shipping', label: 'Livraison', tone: 'purple' },
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
                        {counts.todo > 0
                            ? <><span className="text-amber-500 font-bold">{counts.todo}</span> à traiter</>
                            : 'Aucune commande à traiter'}
                    </p>
                </div>
                <div className="text-[10px] text-[#888] font-mono bg-[#111] border border-[#1a1a1a] px-3 py-1.5 rounded-lg uppercase tracking-wider">
                    {counts.all} au total
                </div>
            </div>

            {/* FILTERS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {filters.map(f => {
                    const isActive = activeFilter === f.key;
                    const count = counts[f.key];
                    return (
                        <button
                            key={f.key}
                            onClick={() => setActiveFilter(f.key)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${isActive
                                ? 'bg-[#00D97E] text-black'
                                : 'bg-[#111] border border-[#1a1a1a] text-[#888] hover:text-white hover:border-[#333]'
                                }`}
                        >
                            <span>{f.label}</span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-black/20' : 'bg-black/40 text-[#555]'
                                }`}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* SEARCH */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#555] w-4 h-4" />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par ID, client, adresse…"
                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/40 transition-colors"
                />
            </div>

            {/* LIST */}
            {loading ? (
                <div className="text-[#888] text-center py-20 uppercase tracking-widest text-xs animate-pulse">
                    Chargement…
                </div>
            ) : filteredOrders.length === 0 ? (
                <div className="py-16 text-center border-2 border-dashed border-[#1a1a1a] rounded-2xl">
                    {orders.length === 0 ? (
                        <>
                            <ShoppingBag className="mx-auto h-10 w-10 text-[#333] mb-3" />
                            <h3 className="text-sm font-medium text-white">Aucune commande</h3>
                            <p className="text-[#555] text-xs mt-1">Vos premières ventes apparaîtront ici.</p>
                        </>
                    ) : (
                        <>
                            <Filter className="mx-auto h-10 w-10 text-[#333] mb-3" />
                            <h3 className="text-sm font-medium text-white">Aucun résultat</h3>
                            <p className="text-[#555] text-xs mt-1">
                                {searchTerm ? 'Essayez un autre terme.' : 'Aucune commande dans ce filtre.'}
                            </p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredOrders.map(order => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            onClick={() => setSelectedOrder(order)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
