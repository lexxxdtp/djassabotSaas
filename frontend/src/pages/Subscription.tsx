import { useState, useEffect } from 'react';
import { Check, ShieldCheck, Loader2, Sparkles } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';

// ---------- TYPES ----------

export interface Plan {
    id: string;
    name: string;
    price: number;
    currency: string;
    features: string[];
}

const FALLBACK_PLANS: Record<string, Plan> = {
    starter: { id: 'starter', name: 'Starter', price: 5000, currency: 'XOF', features: ['Bot IA sur WhatsApp', 'Gestion des produits', "Jusqu'à 50 produits", 'Support par email'] },
    pro: { id: 'pro', name: 'Pro', price: 10000, currency: 'XOF', features: ['Tout le Starter, et en plus :', 'Produits illimités', 'IA négociatrice avancée', 'Statistiques détaillées', 'Support prioritaire'] },
    business: { id: 'business', name: 'Business', price: 15000, currency: 'XOF', features: ['Tout le Pro, et en plus :', 'Support VIP', 'Formation personnalisée', 'Configuration sur mesure'] },
};

const PLAN_ORDER: { id: string; recommended?: boolean }[] = [
    { id: 'starter' },
    { id: 'pro', recommended: true },
    { id: 'business' },
];

// ---------- CONTAINER (data) ----------

export default function Subscription() {
    const { tenant, user } = useAuth();
    const currentPlan = tenant?.subscription_tier || 'starter';
    const [loading, setLoading] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await apiClient('/paystack/plans');
                const data = await res.json();
                if (data.plans) setPlans(data.plans);
            } catch (e) {
                console.error('Failed to fetch plans:', e);
                setPlans(Object.values(FALLBACK_PLANS));
            }
        };
        fetchPlans();
    }, []);

    const handleUpgrade = async (planId: string) => {
        setLoading(true);
        setLoadingPlan(planId);
        setError(null);
        try {
            const userEmail = user?.email || 'user@example.com';
            const res = await apiClient('/paystack/subscribe', {
                method: 'POST',
                body: JSON.stringify({ plan: planId, email: userEmail }),
            });
            const data = await res.json();
            if (data.success && data.paymentUrl) {
                window.location.href = data.paymentUrl;
            } else {
                setError(data.error || 'Une erreur est survenue');
                setLoading(false);
                setLoadingPlan(null);
            }
        } catch (e) {
            console.error('Subscription error:', e);
            setError('Impossible de contacter le serveur. Vérifiez votre connexion.');
            setLoading(false);
            setLoadingPlan(null);
        }
    };

    const resolve = (id: string): Plan =>
        plans.find(p => p.id === id) || FALLBACK_PLANS[id] || { id, name: id, price: 0, currency: 'XOF', features: [] };

    const plansToShow = PLAN_ORDER.map(({ id, recommended }) => ({ plan: resolve(id), recommended: !!recommended }));

    return (
        <SubscriptionView
            plansToShow={plansToShow}
            currentPlan={currentPlan}
            loading={loading}
            loadingPlan={loadingPlan}
            error={error}
            onUpgrade={handleUpgrade}
        />
    );
}

// ---------- PRESENTATIONAL VIEW (réutilisée par la preview) ----------

export interface SubscriptionViewProps {
    plansToShow: { plan: Plan; recommended: boolean }[];
    currentPlan: string;
    loading: boolean;
    loadingPlan: string | null;
    error: string | null;
    onUpgrade: (planId: string) => void;
}

export const SubscriptionView: React.FC<SubscriptionViewProps> = ({
    plansToShow, currentPlan, loading, loadingPlan, error, onUpgrade,
}) => {
    const anim = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both';
    const delay = (i: number): React.CSSProperties => ({ animationDuration: '450ms', animationDelay: `${i * 60}ms` });

    const activePlan = plansToShow.find(p => p.plan.id === currentPlan)?.plan;

    return (
        <div className="space-y-5 pb-4">
            {/* HEADER */}
            <div className={anim} style={delay(0)}>
                <h1 className="text-2xl font-bold text-white tracking-tight">Abonnement</h1>
                <p className="text-[#888] text-sm mt-0.5">Choisissez le plan adapté à votre volume de ventes.</p>
            </div>

            {/* PLAN ACTUEL */}
            {activePlan && (
                <div className={`flex items-center justify-between gap-3 bg-[#111] border border-[#00D97E]/30 rounded-2xl p-4 ${anim}`} style={delay(1)}>
                    <div className="min-w-0">
                        <p className="text-xs text-[#888]">Votre plan actuel</p>
                        <p className="text-lg font-bold text-white mt-0.5">{activePlan.name}</p>
                    </div>
                    <p className="text-sm text-[#888] shrink-0">
                        <span className="text-white font-bold tabular-nums">{activePlan.price.toLocaleString('fr-FR')}</span> F/mois
                    </p>
                </div>
            )}

            {error && (
                <div className={`flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl text-sm ${anim}`} style={delay(1)}>
                    {error}
                </div>
            )}

            {/* PLANS */}
            <div className="space-y-3">
                {plansToShow.map(({ plan, recommended }, i) => (
                    <div key={plan.id} className={anim} style={delay(2 + i)}>
                        <PlanCard
                            plan={plan}
                            recommended={recommended}
                            isCurrent={currentPlan === plan.id}
                            loading={loading}
                            isLoading={loading && loadingPlan === plan.id}
                            onUpgrade={onUpgrade}
                        />
                    </div>
                ))}
            </div>

            {/* PAIEMENT SÉCURISÉ */}
            <div className={`bg-[#111] border border-[#1a1a1a] rounded-2xl p-4 ${anim}`} style={delay(5)}>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#00D97E]/10 text-[#00D97E] shrink-0">
                        <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-white text-sm font-bold">Paiement sécurisé</p>
                        <p className="text-xs text-[#888] mt-0.5">Wave, Orange Money, MTN, Visa et Mastercard.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ---------- PLAN CARD ----------

interface PlanCardProps {
    plan: Plan;
    recommended: boolean;
    isCurrent: boolean;
    loading: boolean;
    isLoading: boolean;
    onUpgrade: (planId: string) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, recommended, isCurrent, loading, isLoading, onUpgrade }) => {
    const border = isCurrent
        ? 'border-[#00D97E]'
        : recommended
            ? 'border-[#00D97E]/40'
            : 'border-[#1a1a1a]';

    return (
        <div className={`relative bg-[#111] border ${border} rounded-2xl p-5`}>
            {/* Badge */}
            {isCurrent ? (
                <span className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00D97E] text-black text-[10px] font-bold">
                    <Check className="w-3 h-3" aria-hidden="true" /> Votre plan
                </span>
            ) : recommended ? (
                <span className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#00D97E]/10 text-[#00D97E] border border-[#00D97E]/20 text-[10px] font-bold">
                    <Sparkles className="w-3 h-3" aria-hidden="true" /> Recommandé
                </span>
            ) : null}

            <h3 className="text-base font-bold text-white">{plan.name}</h3>
            <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-3xl font-bold text-white tracking-tight tabular-nums">{plan.price.toLocaleString('fr-FR')}</span>
                <span className="text-[#888] text-sm">FCFA/mois</span>
            </div>

            <div className="space-y-2.5 mt-4 mb-5">
                {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-sm text-[#888]">
                        <Check className="w-4 h-4 mt-0.5 text-[#00D97E] shrink-0" aria-hidden="true" />
                        <span>{feat}</span>
                    </div>
                ))}
            </div>

            <button
                onClick={() => !isCurrent && !loading && onUpgrade(plan.id)}
                disabled={isCurrent || loading}
                className={`w-full py-3 rounded-xl font-bold text-sm transition-[transform,background-color] flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[#00D97E]/30 ${isCurrent
                    ? 'bg-[#1a1a1a] text-[#888] cursor-default'
                    : recommended
                        ? 'bg-[#00D97E] text-black active:scale-[0.98] cursor-pointer'
                        : 'bg-[#1a1a1a] text-white hover:bg-[#222] active:scale-[0.98] cursor-pointer'} ${loading && !isCurrent ? 'opacity-60' : ''}`}
            >
                {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Redirection…</>
                ) : isCurrent ? (
                    'Plan actuel'
                ) : (
                    'Choisir ce plan'
                )}
            </button>
        </div>
    );
};
