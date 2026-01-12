

import { useNavigate } from 'react-router-dom';
import {
    Bot,
    MessageCircle,
    ShoppingBag,
    TrendingUp,
    CheckCircle2,
    ArrowRight,
    Zap,
    Shield,
    Globe
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const handleAuthAction = (path: string) => {
        if (isAuthenticated) {
            navigate('/dashboard');
        } else {
            navigate(path);
        }
    };

    return (
        <div className="min-h-screen bg-[#0f111a] text-white selection:bg-indigo-500 selection:text-white font-sans overflow-x-hidden">

            {/* Navigation */}
            <nav className="fixed w-full z-50 bg-[#0f111a]/80 backdrop-blur-lg border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-20">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Bot className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                                DjassaBot
                            </span>
                        </div>

                        <div className="hidden md:flex items-center gap-8">
                            <a href="#features" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Fonctionnalités</a>
                            <a href="#how-it-works" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Comment ça marche</a>
                            <a href="#pricing" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Tarifs</a>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => handleAuthAction('/login')}
                                className="px-5 py-2.5 text-sm font-medium text-white bg-white/5 border border-white/10 rounded-full hover:bg-white/10 transition-all hover:scale-105"
                            >
                                {isAuthenticated ? 'Dashboard' : 'Connexion'}
                            </button>
                            <button
                                onClick={() => handleAuthAction('/signup')}
                                className="hidden md:flex px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full hover:shadow-lg hover:shadow-indigo-500/25 transition-all hover:scale-105"
                            >
                                {isAuthenticated ? 'Mon Espace' : 'Commencer Gratuitement'}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
                {/* Background Elements */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                    <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
                    <div className="absolute top-40 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-8 animate-fade-in-up">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        <span className="text-xs font-medium text-indigo-300">Nouvelle Version 2.0 Disponible</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-gray-500">
                        Votre Commercial IA <br />
                        sur WhatsApp
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
                        Automatisez vos ventes, gérez votre stock et offrez un support client 24/7.
                        Laissez l'IA s'occuper de vos clients pendant que vous vous concentrez sur la croissance.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => handleAuthAction('/signup')}
                            className="w-full sm:w-auto px-8 py-4 text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full font-medium hover:shadow-xl hover:shadow-indigo-500/25 transition-all hover:scale-105 flex items-center justify-center gap-2 group"
                        >
                            {isAuthenticated ? 'Accéder au Dashboard' : 'Essayer Gratuitement'}
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button className="w-full sm:w-auto px-8 py-4 text-white bg-white/5 border border-white/10 rounded-full font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-500" />
                            Voir la Démo
                        </button>
                    </div>

                    {/* Stats / Social Proof */}
                    <div className="mt-20 pt-10 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-8">
                        {[
                            { label: 'Messages Traités', value: '10k+' },
                            { label: 'Ventes Générées', value: '50M+' },
                            { label: 'Taux de Réponse', value: '100%' },
                            { label: 'Satisfaction Client', value: '4.9/5' },
                        ].map((stat, i) => (
                            <div key={i}>
                                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                                <div className="text-sm text-gray-500">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section id="features" className="py-24 bg-[#0a0c10]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Tout ce dont vous avez besoin</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Une suite complète d'outils pour transformer votre WhatsApp en machine de vente.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                icon: <MessageCircle className="w-6 h-6 text-blue-400" />,
                                title: "Réponses Intelligentes",
                                desc: "Notre IA comprend le contexte et répond naturellement à vos clients, 24/7."
                            },
                            {
                                icon: <ShoppingBag className="w-6 h-6 text-purple-400" />,
                                title: "Gestion de Commandes",
                                desc: "Transformez les conversations en commandes automatiquement. Suivi de stock en temps réel."
                            },
                            {
                                icon: <TrendingUp className="w-6 h-6 text-green-400" />,
                                title: "Analyses Détaillées",
                                desc: "Suivez vos performances, identifiez vos meilleurs produits et optimisez vos ventes."
                            },
                            {
                                icon: <Shield className="w-6 h-6 text-indigo-400" />,
                                title: "Sécurité Maximale",
                                desc: "Vos données et celles de vos clients sont chiffrées et protégées."
                            },
                            {
                                icon: <Globe className="w-6 h-6 text-pink-400" />,
                                title: "Multi-langues",
                                desc: "L'IA s'adapte à la langue de vos clients pour une expérience personnalisée."
                            },
                            {
                                icon: <Zap className="w-6 h-6 text-yellow-400" />,
                                title: "Installation Rapide",
                                desc: "Connectez votre WhatsApp en quelques secondes via QR Code."
                            }
                        ].map((feature, i) => (
                            <div key={i} className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all hover:-translate-y-1 group">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                                <p className="text-gray-400 leading-relaxed text-sm">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 relative overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Tarifs Simples</h2>
                        <p className="text-gray-400 max-w-2xl mx-auto">
                            Choisissez le plan qui correspond à la taille de votre business.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                        {/* Starter */}
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all">
                            <div className="text-sm font-medium text-gray-400 mb-2">Starter</div>
                            <div className="text-4xl font-bold mb-6">5.000 <span className="text-lg text-gray-500 font-normal">FCFA</span></div>
                            <ul className="space-y-4 mb-8">
                                {['1 Compte WhatsApp', 'Réponses IA illimitées', 'Support Basique', 'Tableau de bord'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => navigate('/signup')} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">
                                Choisir
                            </button>
                        </div>

                        {/* Pro - Featured */}
                        <div className="p-8 rounded-3xl bg-gradient-to-b from-indigo-900/50 to-indigo-900/10 border border-indigo-500/50 relative">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full text-center whitespace-nowrap">
                                POPULAIRE
                            </div>
                            <div className="text-sm font-medium text-indigo-300 mb-2">Pro</div>
                            <div className="text-4xl font-bold mb-6">10.000 <span className="text-lg text-gray-500 font-normal">FCFA</span></div>
                            <ul className="space-y-4 mb-8">
                                {['Tout du Starter', 'Support Prioritaire', 'Analytiques Avancées', 'Export des données', 'Personnalisation IA'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => navigate('/signup')} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors shadow-lg shadow-indigo-500/25">
                                Choisir
                            </button>
                        </div>

                        {/* Business */}
                        <div className="p-8 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all">
                            <div className="text-sm font-medium text-gray-400 mb-2">Business</div>
                            <div className="text-4xl font-bold mb-6">15.000 <span className="text-lg text-gray-500 font-normal">FCFA</span></div>
                            <ul className="space-y-4 mb-8">
                                {['Tout du Pro', 'Gestion multi-comptes', 'API Access', 'Account Manager Dedie'].map((item, i) => (
                                    <li key={i} className="flex items-center gap-3 text-sm text-gray-300">
                                        <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <button onClick={() => navigate('/signup')} className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-colors">
                                Choisir
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 bg-[#0a0c10]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-bold text-lg">DjassaBot</span>
                    </div>

                    <div className="text-gray-500 text-sm">
                        © 2024 DjassaBot. Tous droits réservés.
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
