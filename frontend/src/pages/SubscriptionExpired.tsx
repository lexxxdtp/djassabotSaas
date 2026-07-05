import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { SubscriptionView, type Plan } from './Subscription';

const FALLBACK_PLANS: Plan[] = [
    { id: 'starter', name: 'Starter', price: 5000, currency: 'XOF', features: ['Bot IA sur WhatsApp', 'Gestion des produits', "Jusqu'à 50 produits", 'Support par email'] },
    { id: 'pro', name: 'Pro', price: 10000, currency: 'XOF', features: ['Tout le Starter, et en plus :', 'Produits illimités', 'IA négociatrice avancée', 'Statistiques détaillées', 'Support prioritaire'] },
    { id: 'business', name: 'Business', price: 15000, currency: 'XOF', features: ['Tout le Pro, et en plus :', 'Support VIP', 'Formation personnalisée', 'Configuration sur mesure'] },
];

const PLAN_ORDER: { id: string; recommended?: boolean }[] = [
    { id: 'starter' },
    { id: 'pro', recommended: true },
    { id: 'business' },
];

/**
 * Écran plein affiché quand l'abonnement (ou l'essai) du vendeur a expiré :
 * le backend renvoie 402 sur les routes du dashboard, apiClient émet
 * `subscription:expired`, AuthContext lève le flag, ProtectedRoute redirige ici.
 * L'accès au tableau de bord est bloqué tant que le paiement n'est pas renouvelé.
 */
export default function SubscriptionExpired() {
    const { user, logout } = useAuth();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await apiClient('/paystack/plans');
                const data = await res.json();
                if (data.plans) setPlans(data.plans);
                else setPlans(FALLBACK_PLANS);
            } catch {
                setPlans(FALLBACK_PLANS);
            }
        })();
    }, []);

    const handleUpgrade = async (planId: string) => {
        setLoading(true);
        setLoadingPlan(planId);
        setError(null);
        try {
            const res = await apiClient('/paystack/subscribe', {
                method: 'POST',
                body: JSON.stringify({ plan: planId, email: user?.email }),
            });
            const data = await res.json();
            if (data.success && data.paymentUrl) {
                window.location.href = data.paymentUrl;
                return;
            }
            setError(data.error || "Le paiement n'est pas encore disponible. Contactez le support pour renouveler.");
        } catch {
            setError('Impossible de contacter le serveur. Vérifiez votre connexion.');
        } finally {
            setLoading(false);
            setLoadingPlan(null);
        }
    };

    const resolve = (id: string): Plan =>
        plans.find(p => p.id === id) || FALLBACK_PLANS.find(p => p.id === id)!;
    const plansToShow = PLAN_ORDER.map(({ id, recommended }) => ({ plan: resolve(id), recommended: !!recommended }));

    return (
        <div className="min-h-screen bg-black px-4 py-8 flex justify-center">
            <div className="w-full max-w-md">
                {/* Bandeau d'expiration */}
                <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 mb-6">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500 shrink-0">
                        <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-white font-bold text-lg leading-tight">Votre abonnement a expiré</h1>
                        <p className="text-[#888] text-sm mt-1">
                            L'accès à votre tableau de bord est en pause. Choisissez un forfait ci-dessous
                            pour reprendre vos ventes.
                        </p>
                    </div>
                </div>

                {/* currentPlan volontairement vide : sur l'écran d'expiration, TOUS les
                    forfaits doivent être choisissables (y compris renouveler l'actuel). */}
                <SubscriptionView
                    plansToShow={plansToShow}
                    currentPlan=""
                    loading={loading}
                    loadingPlan={loadingPlan}
                    error={error}
                    onUpgrade={handleUpgrade}
                />

                {/* Support + déconnexion */}
                <div className="mt-4 text-center space-y-3">
                    <p className="text-xs text-[#555]">
                        Un souci pour payer ? Écrivez à{' '}
                        <a href="mailto:support@djassabot.com" className="text-[#00D97E] hover:underline">support@djassabot.com</a>
                    </p>
                    <button
                        onClick={logout}
                        className="text-sm text-[#888] hover:text-white underline underline-offset-4 transition-colors"
                    >
                        Se déconnecter
                    </button>
                </div>
            </div>
        </div>
    );
}
