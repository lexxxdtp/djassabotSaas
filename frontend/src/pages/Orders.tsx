
import { useEffect, useState } from 'react';
import { ShoppingBag, CheckCircle, Clock, MapPin, X } from 'lucide-react';

interface Order {
    id: string;
    userId: string;
    total: number;
    status: 'PENDING' | 'PAID' | 'DELIVERED';
    address: string;
    items: { productName: string; quantity: number; price: number }[];
    createdAt: string;
}

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        fetch('/api/orders', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch');
                return res.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    setOrders(data);
                } else {
                    setOrders([]);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setOrders([]);
                setLoading(false);
            });
    }, []);

    const OrderModal = ({ order, onClose }: { order: Order, onClose: () => void }) => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="bg-zinc-900 p-6 flex justify-between items-start border-b border-zinc-800">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <h2 className="text-xl font-bold text-white tracking-tight">COMMANDE #{order.id}</h2>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                order.status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                    'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                }`}>
                                {order.status}
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
                <div className="p-8 space-y-8 bg-zinc-900/50">
                    {/* Customer Info */}
                    <div className="grid grid-cols-2 gap-8 p-4 bg-black/40 rounded-xl border border-zinc-800">
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
                        <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-black">
                            <table className="w-full text-sm text-left">
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
                                            <td className="px-4 py-3 text-white">{item.productName}</td>
                                            <td className="px-4 py-3 text-zinc-400 text-right font-mono">{item.price.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-zinc-400 text-right font-mono">{item.quantity}</td>
                                            <td className="px-4 py-3 text-white font-medium text-right font-mono text-orange-500/80">{(item.price * item.quantity).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-zinc-900 border-t border-zinc-800">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-3 text-right text-zinc-500 text-xs uppercase tracking-wide font-medium">Sous-total</td>
                                        <td className="px-4 py-3 text-right text-zinc-300 font-mono">{order.total.toLocaleString()}</td>
                                    </tr>
                                    <tr>
                                        <td colSpan={3} className="px-4 py-4 text-right font-bold text-white text-sm uppercase tracking-wider">Total à Payer</td>
                                        <td className="px-4 py-4 text-right font-bold text-orange-500 text-xl font-mono">{order.total.toLocaleString()} <span className="text-xs text-orange-500/50">FCFA</span></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="bg-zinc-900 p-6 flex justify-end gap-3 border-t border-zinc-800">
                    <button onClick={onClose} className="px-4 py-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors text-sm font-medium">
                        Fermer
                    </button>
                    <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black rounded-lg shadow-lg shadow-orange-500/20 transition-all font-bold text-sm uppercase tracking-wide flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Confirmer la commande
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {selectedOrder && <OrderModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}

            <div className="flex items-center justify-between border-b border-zinc-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Commandes</h1>
                    <p className="text-zinc-500 mt-1">Suivi des ventes WhatsApp en temps réel</p>
                </div>

                <div className="flex gap-2 text-sm text-zinc-400">
                    <span className="bg-zinc-900 text-zinc-300 px-3 py-1 rounded border border-zinc-800 text-xs font-mono font-bold">
                        {orders.length} TOTAL
                    </span>
                </div>
            </div>

            {loading ? (
                <div className="text-zinc-500 text-center py-20 uppercase tracking-widest text-xs animate-pulse">Chargement des commandes...</div>
            ) : (
                <div className="grid gap-4">
                    {orders.map((order) => (
                        <div
                            key={order.id}
                            onClick={() => setSelectedOrder(order)}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-orange-500/50 hover:bg-zinc-900/80 transition-all group cursor-pointer active:scale-[0.99]"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-bold text-white text-lg tracking-tight">#{order.id}</h3>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${order.status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' :
                                            order.status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' :
                                                'bg-blue-500/10 border-blue-500/20 text-blue-500'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="text-zinc-500 text-sm flex items-center gap-2">
                                        <MapPin className="w-3 h-3 text-zinc-600" /> {order.address}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-white font-mono">{order.total.toLocaleString()} <span className="text-orange-500 text-sm">FCFA</span></div>
                                    <div className="text-zinc-600 text-xs flex items-center justify-end gap-1 mt-1 uppercase font-medium">
                                        <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-black/40 rounded-lg p-3 border border-zinc-800/50 group-hover:border-zinc-700 transition-colors">
                                <ul className="space-y-2">
                                    {order.items.slice(0, 2).map((item, idx) => (
                                        <li key={idx} className="flex justify-between text-sm text-zinc-300">
                                            <span><span className="text-zinc-600 font-mono text-xs mr-2">{item.quantity}x</span> {item.productName}</span>
                                            <span className="font-mono text-zinc-500">{(item.price * item.quantity).toLocaleString()}</span>
                                        </li>
                                    ))}
                                    {order.items.length > 2 && (
                                        <li className="text-xs text-orange-500/70 italic pt-1 text-right">
                                            + {order.items.length - 2} autres...
                                        </li>
                                    )}
                                </ul>
                            </div>

                            <div className="mt-4 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <span className="text-xs text-orange-500 flex items-center font-bold uppercase tracking-wide">
                                    Voir détails <ShoppingBag className="w-3 h-3 ml-1" />
                                </span>
                            </div>
                        </div>
                    ))}
                    {orders.length === 0 && (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                            <ShoppingBag className="mx-auto h-12 w-12 text-zinc-700 mb-4" />
                            <h3 className="text-lg font-medium text-white">Aucune commande</h3>
                            <p className="text-zinc-500 mt-1">Les ventes apparaîtront ici.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
