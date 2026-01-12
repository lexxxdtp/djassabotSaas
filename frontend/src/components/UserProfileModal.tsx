import { useState } from 'react';
import { X, User, Crown, Shield, Check, Mail, Building } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface PlanCardProps {
    id: string;
    title: string;
    price: string;
    features: string[];
    recommended?: boolean;
    currentPlan: string;
    loading: boolean;
    onUpgrade: (id: string) => void;
}

const PlanCard = ({ id, title, price, features, recommended, currentPlan, loading, onUpgrade }: PlanCardProps) => {
    const isCurrent = currentPlan === id;
    return (
        <div
            className={`relative border rounded-xl p-4 transition-all cursor-pointer hover:border-indigo-500/50 ${isCurrent
                ? 'bg-[#0a0c10] border-emerald-500 ring-1 ring-emerald-500'
                : recommended
                    ? 'bg-gradient-to-b from-indigo-950/20 to-black border-indigo-500/30'
                    : 'bg-black border-white/5'
                }`}
            onClick={() => !isCurrent && onUpgrade(id)}
        >
            {isCurrent && (
                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <Check size={10} /> ACTUEL
                </div>
            )}
            {recommended && !isCurrent && (
                <div className="absolute top-2 right-2 text-[10px] font-bold text-indigo-400 bg-indigo-950/30 px-2 py-0.5 rounded-full border border-indigo-500/20">
                    POPULAIRE
                </div>
            )}

            <h3 className={`font-bold text-sm ${isCurrent ? 'text-emerald-400' : 'text-white'}`}>{title}</h3>
            <div className="mt-1 mb-3">
                <span className="text-xl font-bold text-white">{price}</span>
                <span className="text-xs text-zinc-500">/mois</span>
            </div>

            <ul className="space-y-1.5">
                {features.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                        <span className={`mt-0.5 w-1 h-1 rounded-full ${isCurrent ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                        {f}
                    </li>
                ))}
            </ul>

            {!isCurrent && (
                <button disabled={loading} className="mt-4 w-full py-1.5 rounded bg-white text-black text-xs font-bold hover:bg-zinc-200 transition-colors">
                    {loading ? '...' : 'Choisir'}
                </button>
            )}
        </div>
    );
};

export default function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
    const { user, tenant } = useAuth();
    const [activeTab, setActiveTab] = useState<'profile' | 'subscription'>('subscription');
    const [currentPlan] = useState(tenant?.subscription_tier || 'starter');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Real Paystack Upgrade
    const handleUpgrade = async (planId: string) => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken') || sessionStorage.getItem('token');
            const userEmail = user?.email || localStorage.getItem('userEmail') || 'user@example.com';

            const res = await fetch(`${getApiUrl()}/paystack/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ plan: planId, email: userEmail })
            });

            const data = await res.json();

            if (data.success && data.paymentUrl) {
                // Redirect to Paystack payment page
                window.location.href = data.paymentUrl;
            } else {
                setError(data.error || 'Une erreur est survenue');
                setLoading(false);
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert('Erreur: ' + e.message);
            } else {
                alert('Erreur inconnue');
            }
            setError('Erreur de connexion au serveur');
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f111a]/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-4xl bg-[#0a0c10] border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

                {/* Sidebar Menu */}
                <div className="md:w-64 bg-black border-r border-zinc-900 p-6 flex flex-col gap-2">
                    <div className="mb-6 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-2xl font-bold text-zinc-400 mb-3">
                            {user?.full_name?.[0] || 'U'}
                        </div>
                        <h3 className="text-white font-bold text-sm truncate w-full">{user?.full_name}</h3>
                        <p className="text-zinc-500 text-xs truncate w-full">{user?.email}</p>
                        <div className="mt-3 px-3 py-1 bg-zinc-900 rounded-full border border-zinc-800 text-[10px] font-mono text-zinc-400 uppercase">
                            {currentPlan} PLAN
                        </div>
                    </div>

                    <button
                        onClick={() => setActiveTab('subscription')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'subscription' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <Crown size={16} /> Abonnement
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-indigo-500/10 text-indigo-400' : 'text-zinc-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <User size={16} /> Mon Profil
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-6 overflow-y-auto bg-zinc-950/50 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>

                    {activeTab === 'subscription' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    <Crown size={20} className="text-indigo-500" /> Gestion de l'abonnement
                                </h2>
                                <p className="text-zinc-500 text-sm mt-1">Changez de plan pour débloquer plus de puissance.</p>
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}

                            <div className="grid md:grid-cols-3 gap-4">
                                <PlanCard
                                    id="starter"
                                    title="Starter"
                                    price="5.000 FCFA"
                                    features={["Bot IA WhatsApp", "50 Produits max", "Support Email"]}
                                    currentPlan={currentPlan}
                                    loading={loading}
                                    onUpgrade={handleUpgrade}
                                />
                                <PlanCard
                                    id="pro"
                                    title="Pro"
                                    price="10.000 FCFA"
                                    recommended={true}
                                    features={["Produits Illimités", "IA Négociatrice", "Statistiques", "Support Prio"]}
                                    currentPlan={currentPlan}
                                    loading={loading}
                                    onUpgrade={handleUpgrade}
                                />
                                <PlanCard
                                    id="business"
                                    title="Business"
                                    price="15.000 FCFA"
                                    features={["Support VIP", "Formation perso", "Config sur mesure"]}
                                    currentPlan={currentPlan}
                                    loading={loading}
                                    onUpgrade={handleUpgrade}
                                />
                            </div>

                            <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800 flex items-center gap-4">
                                <Shield className="text-zinc-400" size={20} />
                                <div>
                                    <h4 className="text-white text-sm font-bold">Paiement Sécurisé</h4>
                                    <p className="text-zinc-500 text-xs">Vos transactions sont chiffrées et sécurisées via Wave/OM.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    <User size={20} className="text-indigo-500" /> Infos Personnelles
                                </h2>
                                <p className="text-zinc-500 text-sm mt-1">Mettez à jour vos informations de contact.</p>
                            </div>

                            <div className="space-y-4 max-w-md">
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Nom Complet</label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input type="text" defaultValue={user?.full_name} className="w-full bg-black border border-white/5 rounded p-2.5 pl-9 text-white text-sm focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Email</label>
                                    <div className="relative">
                                        <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input type="email" defaultValue={user?.email} disabled className="w-full bg-zinc-900 border border-zinc-800 rounded p-2.5 pl-9 text-zinc-400 text-sm cursor-not-allowed" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-zinc-400 mb-1 uppercase">Nom du Business</label>
                                    <div className="relative">
                                        <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                        <input type="text" defaultValue={tenant?.name} className="w-full bg-black border border-white/5 rounded p-2.5 pl-9 text-white text-sm focus:border-indigo-500 outline-none" />
                                    </div>
                                </div>

                                <button className="px-4 py-2 bg-white text-black font-bold rounded text-sm hover:bg-zinc-200 transition-colors">
                                    Sauvegarder
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
