import { useEffect, useState } from 'react';
import { ShoppingBag, Clock, MapPin, X, AlertCircle, Package } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

interface Order {
    id: string;
    userId: string;
    total: number;
    status: 'PENDING' | 'CONFIRMED' | 'SHIPPING' | 'DELIVERED' | 'CANCELLED';
    address: string;
    items: {
        productName: string;
        quantity: number;
        price: number;
        selectedVariations?: { name: string; value: string }[];
    }[];
    createdAt: string;
}



// --- HELPERS ---
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

interface OrderModalProps {
    order: Order;
    onClose: () => void;
    onUpdateStatus: (orderId: string, status: string) => void;
}

const OrderModal = ({ order, onClose, onUpdateStatus }: OrderModalProps) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="bg-zinc-900 p-6 flex justify-between items-start border-b border-zinc-800 shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold text-white tracking-tight">COMMANDE #{order.id}</h2>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                            {order.status === 'PENDING' ? 'NOUVELLE' : order.status === 'CONFIRMED' ? 'CONFIRMÉE' : order.status}
                        </span>
                    </div>
                    <p className="text-zinc-500 text-xs flex items-center gap-2 uppercase tracking-wide">
                        <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleString('fr-FR')}
                    </p>
                </div>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors bg-zinc-800/50 hover:bg-zinc-800 p-2 rounded-lg">
                    <X size={20} />
                </button>
            </div>

            {/* Body */}
            <div className="p-8 space-y-8 bg-zinc-900/50 overflow-y-auto">
                <div className="flex flex-wrap gap-3 justify-end">
                    {/* Simplified Actions: Confirm or Cancel */}
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
                                Confirmer la commande
                            </button>
                        </>
                    )}
                    {order.status === 'CONFIRMED' && (
                        <button
                            onClick={() => onUpdateStatus(order.id, 'DELIVERED')}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black rounded-lg text-xs font-bold uppercase transition-all shadow-lg shadow-emerald-500/20"
                        >
                            Marquer comme Terminée
                        </button>
                    )}
                    {order.status !== 'PENDING' && order.status !== 'CONFIRMED' && (
                        <span className="text-zinc-500 text-sm italic">Commande cloturée</span>
                    )}
                </div>

                {/* Customer Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4 bg-black/40 rounded-xl border border-zinc-800">
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Client</h3>
                        <div className="text-white font-medium font-mono text-sm">{order.userId}</div>
                        <div className="text-zinc-600 text-xs mt-1">Via WhatsApp</div>
                    </div>
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-2">Livraison</h3>
                        <div className="flex items-start gap-2 text-zinc-300 text-sm">
                            <MapPin className="w-4 h-4 mt-0.5 text-orange-500" />
                            <span>{order.address}</span>
                        </div>
                    </div>
                </div>

                {/* Order Items Table */}
                <div>
                    <h3 className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-4">Détails Panier</h3>
                    <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-black overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[500px]">
                            <thead className="bg-zinc-900/80 text-zinc-500 border-b border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">Produit</th>
                                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">Prix</th>
                                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">Qté</th>
                                    <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {order.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-zinc-900/30 transition-colors">
                                        <td className="px-4 py-3 text-white">
                                            {item.productName}
                                            {(item.selectedVariations || [])?.length > 0 && (
                                                <div className="text-[10px] text-zinc-500">{item.selectedVariations?.map(v => `${v.name}: ${v.value}`).join(', ')}</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-zinc-400 text-right font-mono">{item.price.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-zinc-400 text-right font-mono">{item.quantity}</td>
                                        <td className="px-4 py-3 text-white font-medium text-right font-mono text-orange-500/80">{(item.price * item.quantity).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-zinc-900 border-t border-zinc-800">
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-right font-bold text-white text-sm uppercase tracking-wider">Total à Payer</td>
                                    <td className="px-4 py-4 text-right font-bold text-orange-500 text-xl font-mono">{order.total.toLocaleString()} <span className="text-xs text-orange-500/50">FCFA</span></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900 p-6 flex justify-end gap-3 border-t border-zinc-800">
                <button onClick={onClose} className="px-4 py-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium">
                    Fermer
                </button>
            </div>
        </div>
    </div>
);

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const fetchOrders = () => {
        const API_URL = getApiUrl();
        const token = localStorage.getItem('token');
        fetch(`${API_URL}/orders`, { headers: { 'Authorization': `Bearer ${token}` } })
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
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const updateStatus = async (orderId: string, newStatus: string) => {
        try {
            const tempOrders = orders.map(o => o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o);
            setOrders(tempOrders); // Optimistic UI

            const API_URL = getApiUrl();
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            fetchOrders(); // Refresh to ensure sync
        } catch (e) {
            console.error('Update failed', e);
            fetchOrders(); // Revert on fail
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 h-[calc(100vh-100px)]">
            {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onUpdateStatus={updateStatus} />}

            <div className="flex items-end justify-between border-b border-zinc-800 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Commandes</h1>
                    <p className="text-zinc-500 mt-1">Liste des commandes</p>
                </div>
                <div className="text-xs text-zinc-500 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
                    {orders.length} commandes
                </div>
            </div>

            {loading ? (
                <div className="text-zinc-500 text-center py-20 uppercase tracking-widest text-xs animate-pulse">Chargement des commandes...</div>
            ) : (
                /* LIST VIEW ONLY */
                <div className="grid gap-4">
                    {orders.length === 0 ? (
                        <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                            <ShoppingBag className="mx-auto h-12 w-12 text-zinc-700 mb-4" />
                            <h3 className="text-lg font-medium text-white">Aucune commande</h3>
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id} onClick={() => setSelectedOrder(order)} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-blue-500/30 cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center group transition-all gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-full ${order.status === 'PENDING' ? 'bg-orange-500/10 text-orange-500' : 'bg-zinc-800 text-zinc-400'}`}>
                                        {order.status === 'PENDING' ? <AlertCircle size={20} /> : <Package size={20} />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-white text-lg">#{order.id.split('-')[1]}</h3>
                                        <p className="text-zinc-500 text-sm flex items-center gap-2">
                                            <Clock size={12} /> {new Date(order.createdAt).toLocaleDateString()}
                                            <span className="text-zinc-700">•</span>
                                            <span className="text-zinc-400">{order.items.length} articles</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                    <div className="text-left sm:text-right">
                                        <div className="font-mono text-white text-lg font-bold">{order.total.toLocaleString()} <span className="text-sm text-zinc-500">FCFA</span></div>
                                        <div className="text-zinc-600 text-xs truncate max-w-[150px]">{order.address}</div>
                                    </div>
                                    <span className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider border ${getStatusColor(order.status)}`}>
                                        {order.status === 'PENDING' ? 'NOUVELLE' : order.status === 'CONFIRMED' ? 'CONFIRMÉE' : order.status}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
