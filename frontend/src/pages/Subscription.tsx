import { useState } from 'react';
import { Check, Shield, Crown } from 'lucide-react';

export default function Subscription() {
    const [currentPlan, setCurrentPlan] = useState('starter');
    const [loading, setLoading] = useState(false);

    // Mock upgrade function
    const handleUpgrade = (plan: string) => {
        setLoading(true);
        setTimeout(() => {
            setCurrentPlan(plan);
            setLoading(false);
            alert(`Félicitations ! Vous êtes passé au plan ${plan.toUpperCase()}.`);
        }, 1500);
    };

    const PlanCard = ({ title, price, features, planId, recommended = false }: any) => {
        const isCurrent = currentPlan === planId;

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
                        <span className="text-3xl font-bold text-white">{price}</span>
                        <span className="text-zinc-500 text-sm">/mois</span>
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
                    onClick={() => !isCurrent && handleUpgrade(planId)}
                    disabled={isCurrent || loading}
                    className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${isCurrent
                        ? 'bg-zinc-800 text-zinc-500 cursor-default'
                        : recommended
                            ? 'bg-orange-500 hover:bg-orange-600 text-black shadow-lg shadow-orange-500/20'
                            : 'bg-white hover:bg-zinc-200 text-black'
                        }`}
                >
                    {loading && !isCurrent ? 'Traitement...' : isCurrent ? 'Plan Actif' : 'Choisir ce plan'}
                </button>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500 pb-20">
            <div className="text-center space-y-4 py-8">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                    Boostez votre <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-600">Croissance</span>
                </h1>
                <p className="text-zinc-400 max-w-xl mx-auto">
                    Choisissez le plan adapté à votre volume de ventes. Changez à tout moment.
                </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                <PlanCard
                    title="Starter"
                    price="0 FCFA"
                    planId="starter"
                    features={[
                        "1 Numéro WhatsApp",
                        "Bot Vendeur IA Base",
                        "50 Produits max",
                        "Commandes illimitées",
                        "Support Email"
                    ]}
                />

                <PlanCard
                    title="Pro"
                    price="15.000 FCFA"
                    planId="pro"
                    recommended={true}
                    features={[
                        "Tout du Starter +",
                        "IA Négociatrice Avancée",
                        "Produits illimités",
                        "Relances paniers abandonnés",
                        "Statistiques détaillées",
                        "Support Prioritaire"
                    ]}
                />

                <PlanCard
                    title="Business"
                    price="45.000 FCFA"
                    planId="business"
                    features={[
                        "Tout du Pro +",
                        "3 Numéros WhatsApp",
                        "IA Personnalisable (Voix)",
                        "API Accès",
                        "Account Manager dédié",
                        "Formation équipe"
                    ]}
                />
            </div>

            <div className="mt-12 bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-800 rounded-full text-zinc-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Garantie Satisfait ou Remboursé</h3>
                        <p className="text-sm text-zinc-500">Testez le plan Pro sans risque pendant 14 jours.</p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-800 rounded-full text-zinc-400">
                        <Crown size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-white">Besoin de plus ?</h3>
                        <p className="text-sm text-zinc-500">Contactez-nous pour une offre sur mesure.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
