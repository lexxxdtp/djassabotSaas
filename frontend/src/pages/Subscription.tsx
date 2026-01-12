import { useState, useEffect } from 'react';
import { Check, Shield, Crown, Loader2 } from 'lucide-react';
import { getApiUrl } from '../utils/apiConfig';

interface Plan {
    id: string;
    name: string;
    price: number;
    currency: string;
    features: string[];
}

interface PlanCardProps {
    title: string;
    price: number;
    features: string[];
    planId: string;
    recommended?: boolean;
    currentPlan: string;
    onUpgrade: (plan: string) => void;
    loading: boolean;
    loadingPlan: string | null;
}

const PlanCard = ({ title, price, features, planId, recommended = false, currentPlan, onUpgrade, loading, loadingPlan }: PlanCardProps) => {
    const isCurrent = currentPlan === planId;
    const isLoading = loading && loadingPlan === planId;

    const formatPrice = (p: number) => {
        return p.toLocaleString('fr-FR');
    };

    return (
        <div className={`relative flex flex-col p-6 rounded-2xl border ${isCurrent
            ? 'bg-zinc-900 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
            : recommended
                ? 'bg-gradient-to-b from-orange-950/20 to-black border-orange-500/50'
                : 'bg-black border-zinc-800'
            } transition-all duration-300 hover:-translate-y-1`}>

            {isCurrent && (
                <div className="absolute top-0 right-0 bg-emerald-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                    ACTUEL
                </div>
            )}

            {recommended && !isCurrent && (
                <div className="absolute top-0 right-0 bg-orange-500 text-black text-[10px] font-bold px-3 py-1 rounded-bl-xl rounded-tr-xl">
                    POPULAIRE
                </div>
            )}

            <div className="mb-4">
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{formatPrice(price)}</span>
                    <span className="text-zinc-500 text-sm">FCFA/mois</span>
                </div>
            </div>

            <div className="flex-1 space-y-3 mb-8">
                {features.map((feat: string, i: number) => (
                    <div key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                        <Check size={16} className={`mt-0.5 ${isCurrent ? 'text-emerald-500' : 'text-orange-500'}`} />
                        <span>{feat}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => !isCurrent && !loading && onUpgrade(planId)}
                disabled={isCurrent || loading}
                className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${isCurrent
                    ? 'bg-zinc-800 text-zinc-500 cursor-default'
                    : recommended
                        ? 'bg-orange-500 hover:bg-orange-600 text-black shadow-lg shadow-orange-500/20'
                        : 'bg-white hover:bg-zinc-200 text-black'
                    }`}
            >
                {isLoading ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Redirection...
                    </>
                ) : isCurrent ? (
                    'Plan Actif'
                ) : (
                    'Choisir ce plan'
                )}
            </button>
        </div>
    );
};

export default function Subscription() {
    // currentPlan will be fetched from API after Paystack callback
    const [currentPlan] = useState('starter');
    const [loading, setLoading] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Fetch plans from API
    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch(`${getApiUrl()}/paystack/plans`);
                const data = await res.json();
                if (data.plans) {
                    setPlans(data.plans);
                }
            } catch (e) {
                console.error('Failed to fetch plans:', e);
                // Fallback to default plans
                setPlans([
                    { id: 'starter', name: 'Starter', price: 5000, currency: 'XOF', features: ['Bot IA WhatsApp', 'Gestion produits', '50 produits max', 'Support email'] },
                    { id: 'pro', name: 'Pro', price: 10000, currency: 'XOF', features: ['Tout du Starter +', 'Produits illimités', 'Statistiques détaillées', 'IA Négociatrice', 'Support prioritaire'] },
                    { id: 'business', name: 'Business', price: 15000, currency: 'XOF', features: ['Tout du Pro +', 'Support VIP', 'Formation personnalisée', 'Configuration sur mesure'] }
                ]);
            }
        };
        fetchPlans();
    }, []);

    // Handle upgrade - redirect to Paystack
    const handleUpgrade = async (plan: string) => {
        setLoading(true);
        setLoadingPlan(plan);
        setError(null);

        try {
            const token = localStorage.getItem('authToken');
            const userEmail = localStorage.getItem('userEmail') || 'user@example.com';

            const res = await fetch(`${getApiUrl()}/paystack/subscribe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ plan, email: userEmail })
            });

            const data = await res.json();

            if (data.success && data.paymentUrl) {
                // Redirect to Paystack payment page
                window.location.href = data.paymentUrl;
            } else {
                setError(data.error || 'Une erreur est survenue');
                setLoading(false);
                setLoadingPlan(null);
            }
        } catch (e: unknown) {
            console.error('Subscription error:', e);
            setError('Erreur de connexion au serveur');
            setLoading(false);
            setLoadingPlan(null);
        }
    };

    // Get plan details with fallback
    const getPlan = (planId: string) => {
        return plans.find(p => p.id === planId) || {
            id: planId,
            name: planId.charAt(0).toUpperCase() + planId.slice(1),
            price: 0,
            currency: 'XOF',
            features: []
        };
    };

    const starterPlan = getPlan('starter');
    const proPlan = getPlan('pro');
    const businessPlan = getPlan('business');

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 pb-20">
            <div className="text-center space-y-4 py-8">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                    Boostez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">Croissance</span>
                </h1>
                <p className="text-zinc-400 max-w-xl mx-auto">
                    Choisissez le plan adapté à votre volume de ventes. Payez par Wave, Orange Money ou Carte.
                </p>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-center">
                    {error}
                </div>
            )}

            <div className="grid md:grid-cols-3 gap-6">
                <PlanCard
                    title={starterPlan.name}
                    price={starterPlan.price}
                    planId="starter"
                    features={starterPlan.features.length > 0 ? starterPlan.features : [
                        "Bot IA WhatsApp",
                        "Gestion des produits",
                        "50 Produits max",
                        "Support Email"
                    ]}
                    currentPlan={currentPlan}
                    onUpgrade={handleUpgrade}
                    loading={loading}
                    loadingPlan={loadingPlan}
                />

                <PlanCard
                    title={proPlan.name}
                    price={proPlan.price}
                    planId="pro"
                    recommended={true}
                    features={proPlan.features.length > 0 ? proPlan.features : [
                        "Tout du Starter +",
                        "Produits illimités",
                        "IA Négociatrice Avancée",
                        "Statistiques détaillées",
                        "Support Prioritaire"
                    ]}
                    currentPlan={currentPlan}
                    onUpgrade={handleUpgrade}
                    loading={loading}
                    loadingPlan={loadingPlan}
                />

                <PlanCard
                    title={businessPlan.name}
                    price={businessPlan.price}
                    planId="business"
                    features={businessPlan.features.length > 0 ? businessPlan.features : [
                        "Tout du Pro +",
                        "Support VIP",
                        "Formation personnalisée",
                        "Configuration sur mesure"
                    ]}
                    currentPlan={currentPlan}
                    onUpgrade={handleUpgrade}
                    loading={loading}
                    loadingPlan={loadingPlan}
                />
            </div>

            <div className="mt-12 bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-800 rounded-full text-zinc-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Paiement Sécurisé</h3>
                        <p className="text-sm text-zinc-500">Wave, Orange Money, MTN, Visa/Mastercard</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-800 rounded-full text-zinc-400">
                        <Crown size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Besoin d'aide ?</h3>
                        <p className="text-sm text-zinc-500">Contactez-nous sur WhatsApp</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
