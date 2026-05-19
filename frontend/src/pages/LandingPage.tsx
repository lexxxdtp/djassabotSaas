import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, MessageSquare, Package, BarChart2, Zap, Shield, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LandingPage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();

    const go = (path: string) => navigate(isAuthenticated ? '/dashboard' : path);

    return (
        <div className="min-h-screen bg-black text-white font-sans antialiased">

            {/* ═══ NAV ═══ */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1a1a1a] bg-black/90 backdrop-blur-md">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#00D97E] flex items-center justify-center">
                            <Bot className="w-4 h-4 text-black" />
                        </div>
                        <span className="font-bold text-[15px] tracking-tight">DjassaBot</span>
                    </div>

                    {/* Nav links - desktop */}
                    <nav className="hidden md:flex items-center gap-8">
                        {['#features', '#pricing'].map((href, i) => (
                            <a key={i} href={href}
                                className="text-[13px] text-[#888] hover:text-white transition-colors">
                                {['Fonctionnalités', 'Tarifs'][i]}
                            </a>
                        ))}
                    </nav>

                    {/* CTA */}
                    <div className="flex items-center gap-3">
                        <button onClick={() => go('/login')}
                            className="text-[13px] text-[#888] hover:text-white transition-colors px-3 py-1.5">
                            {isAuthenticated ? 'Dashboard' : 'Connexion'}
                        </button>
                        <button onClick={() => go('/signup')}
                            className="text-[13px] font-medium bg-white text-black px-4 py-1.5 rounded-md hover:bg-[#eee] transition-colors">
                            {isAuthenticated ? 'Mon Espace' : 'Démarrer'}
                        </button>
                    </div>
                </div>
            </header>

            {/* ═══ HERO ═══ */}
            <section className="pt-40 pb-32 px-6">
                <div className="max-w-4xl mx-auto text-center">

                    {/* Badge */}
                    <div className="inline-flex items-center gap-2 border border-[#00D97E]/30 bg-[#00D97E]/5 text-[#00D97E] text-[12px] font-medium px-3 py-1 rounded-full mb-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00D97E]" />
                        Conçu pour les commerçants d'Afrique de l'Ouest
                    </div>

                    {/* Headline */}
                    <h1 className="text-[56px] sm:text-[72px] lg:text-[88px] font-black leading-[0.95] tracking-tight mb-8">
                        Votre boutique<br />
                        <span className="text-[#00D97E]">WhatsApp</span><br />
                        tourne seule.
                    </h1>

                    {/* Tagline */}
                    <p className="text-[#888] text-lg max-w-xl mx-auto mb-12 leading-relaxed">
                        DjassaBot répond à vos clients, prend les commandes et gère votre stock.
                        Vous encaissez, l'IA travaille.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <button onClick={() => go('/signup')}
                            className="flex items-center gap-2 bg-[#00D97E] text-black font-semibold px-6 py-3 rounded-lg hover:bg-[#00c470] transition-colors text-sm group">
                            Commencer gratuitement
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                        <button onClick={() => go('/login')}
                            className="flex items-center gap-2 border border-[#333] text-[#aaa] hover:text-white hover:border-[#555] px-6 py-3 rounded-lg transition-colors text-sm">
                            Se connecter
                        </button>
                    </div>
                </div>
            </section>

            {/* ═══ DIVIDER ═══ */}
            <div className="border-t border-[#1a1a1a]" />

            {/* ═══ STATS ═══ */}
            <section className="py-16 px-6">
                <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    {[
                        { value: '30 sec', label: 'pour connecter WhatsApp' },
                        { value: '24/7', label: 'bot actif sans interruption' },
                        { value: '100%', label: 'taux de réponse client' },
                        { value: 'Gratuit', label: 'pour commencer' },
                    ].map((s, i) => (
                        <div key={i} className="text-center">
                            <div className="text-3xl font-black text-white mb-1">{s.value}</div>
                            <div className="text-[12px] text-[#555] leading-tight">{s.label}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ DIVIDER ═══ */}
            <div className="border-t border-[#1a1a1a]" />

            {/* ═══ FEATURES ═══ */}
            <section id="features" className="py-24 px-6">
                <div className="max-w-6xl mx-auto">

                    <div className="mb-16">
                        <p className="text-[#00D97E] text-[12px] font-semibold uppercase tracking-widest mb-3">Fonctionnalités</p>
                        <h2 className="text-[36px] md:text-[48px] font-black leading-tight max-w-lg">
                            Tout pour vendre<br />sur WhatsApp.
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-3 gap-px bg-[#1a1a1a] border border-[#1a1a1a] rounded-xl overflow-hidden">
                        {[
                            {
                                icon: MessageSquare,
                                title: 'Réponses automatiques',
                                desc: "L'IA lit les messages, comprend la demande et répond naturellement — même en nouchi.",
                                color: '#00D97E'
                            },
                            {
                                icon: Package,
                                title: 'Gestion des commandes',
                                desc: "Les commandes sont prises, enregistrées et notifiées en temps réel. Stock mis à jour automatiquement.",
                                color: '#0EA5E9'
                            },
                            {
                                icon: BarChart2,
                                title: 'Tableau de bord',
                                desc: 'Suivez vos ventes, commandes et messages depuis un seul endroit, sur mobile ou desktop.',
                                color: '#F59E0B'
                            },
                            {
                                icon: Zap,
                                title: 'Connexion instantanée',
                                desc: "Scannez un QR code ou entrez un code de jumelage. Votre bot est en ligne en moins d'une minute.",
                                color: '#A855F7'
                            },
                            {
                                icon: Shield,
                                title: 'Multi-marchands isolé',
                                desc: "Chaque marchand a ses propres données. Rien ne se mélange, jamais. Architecture SaaS sécurisée.",
                                color: '#EC4899'
                            },
                            {
                                icon: Bot,
                                title: 'IA personnalisée',
                                desc: 'Choisissez la personnalité de votre bot : sympa, ivoirien nouchi, ou commercial. Il s\'adapte.',
                                color: '#00D97E'
                            },
                        ].map((f, i) => (
                            <div key={i} className="bg-black p-8 hover:bg-[#0a0a0a] transition-colors group">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-5"
                                    style={{ backgroundColor: `${f.color}15` }}>
                                    <f.icon className="w-4 h-4" style={{ color: f.color }} />
                                </div>
                                <h3 className="font-bold text-[15px] mb-2">{f.title}</h3>
                                <p className="text-[#555] text-[13px] leading-relaxed">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ DIVIDER ═══ */}
            <div className="border-t border-[#1a1a1a]" />

            {/* ═══ HOW IT WORKS ═══ */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-16 text-center">
                        <p className="text-[#00D97E] text-[12px] font-semibold uppercase tracking-widest mb-3">Comment ça marche</p>
                        <h2 className="text-[36px] md:text-[48px] font-black">3 étapes. C'est tout.</h2>
                    </div>

                    <div className="space-y-px">
                        {[
                            {
                                num: '01',
                                title: 'Créez votre compte',
                                desc: 'Inscrivez-vous avec votre numéro ou email. 2 minutes chrono.',
                            },
                            {
                                num: '02',
                                title: 'Connectez WhatsApp',
                                desc: 'Scannez le QR code ou saisissez le code de jumelage. Votre numéro reste le vôtre.',
                            },
                            {
                                num: '03',
                                title: 'Ajoutez vos produits',
                                desc: 'Renseignez vos articles, leurs prix, vos conditions. Le bot vend pour vous dès maintenant.',
                            },
                        ].map((step, i) => (
                            <div key={i} className="flex gap-8 py-8 border-b border-[#1a1a1a] last:border-0">
                                <div className="text-[#333] text-[13px] font-mono font-bold w-8 pt-0.5 flex-shrink-0">{step.num}</div>
                                <div>
                                    <h3 className="font-bold text-[17px] mb-1.5">{step.title}</h3>
                                    <p className="text-[#555] text-[14px] leading-relaxed">{step.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ DIVIDER ═══ */}
            <div className="border-t border-[#1a1a1a]" />

            {/* ═══ PRICING ═══ */}
            <section id="pricing" className="py-24 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="mb-16 text-center">
                        <p className="text-[#00D97E] text-[12px] font-semibold uppercase tracking-widest mb-3">Tarifs</p>
                        <h2 className="text-[36px] md:text-[48px] font-black mb-3">Simple et transparent.</h2>
                        <p className="text-[#555] text-[14px]">30 jours d'essai gratuit. Aucune carte bancaire requise.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                        {[
                            {
                                name: 'Starter',
                                price: '5 000',
                                desc: 'Pour lancer votre boutique WhatsApp.',
                                features: ['1 numéro WhatsApp', 'Produits illimités', 'Bot IA actif 24/7', 'Tableau de bord'],
                                cta: 'Commencer',
                                featured: false,
                            },
                            {
                                name: 'Pro',
                                price: '10 000',
                                desc: 'Pour les marchands en croissance.',
                                features: ['Tout du Starter', 'Analytics avancées', 'IA personnalisée', 'Support prioritaire', 'Export des données'],
                                cta: 'Choisir Pro',
                                featured: true,
                            },
                            {
                                name: 'Business',
                                price: '20 000',
                                desc: 'Pour les équipes et multi-boutiques.',
                                features: ['Tout du Pro', 'Multi-comptes', 'Accès API', 'Account manager dédié'],
                                cta: 'Nous contacter',
                                featured: false,
                            },
                        ].map((plan, i) => (
                            <div key={i}
                                className={`rounded-xl p-7 flex flex-col ${plan.featured
                                    ? 'bg-[#00D97E] text-black'
                                    : 'bg-[#0d0d0d] border border-[#1a1a1a] text-white'
                                    }`}>
                                <div className="mb-6">
                                    <div className={`text-[12px] font-semibold uppercase tracking-widest mb-1 ${plan.featured ? 'text-black/60' : 'text-[#555]'}`}>
                                        {plan.name}
                                    </div>
                                    <div className="text-[36px] font-black leading-none mb-1">
                                        {plan.price}
                                        <span className={`text-[14px] font-normal ml-1 ${plan.featured ? 'text-black/60' : 'text-[#555]'}`}>FCFA/mois</span>
                                    </div>
                                    <p className={`text-[13px] mt-2 ${plan.featured ? 'text-black/70' : 'text-[#555]'}`}>{plan.desc}</p>
                                </div>

                                <ul className="space-y-2.5 flex-1 mb-6">
                                    {plan.features.map((f, j) => (
                                        <li key={j} className="flex items-center gap-2.5 text-[13px]">
                                            <Check className={`w-3.5 h-3.5 flex-shrink-0 ${plan.featured ? 'text-black' : 'text-[#00D97E]'}`} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <button onClick={() => go('/signup')}
                                    className={`w-full py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${plan.featured
                                        ? 'bg-black text-white hover:bg-[#111]'
                                        : 'bg-[#1a1a1a] text-white hover:bg-[#222] border border-[#333]'
                                        }`}>
                                    {plan.cta}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA BAND ═══ */}
            <section className="py-24 px-6 border-t border-[#1a1a1a]">
                <div className="max-w-3xl mx-auto text-center">
                    <h2 className="text-[40px] md:text-[56px] font-black leading-tight mb-6">
                        Prêt à automatiser<br />vos ventes ?
                    </h2>
                    <p className="text-[#555] text-[15px] mb-10">
                        Rejoignez les commerçants qui font confiance à DjassaBot.
                    </p>
                    <button onClick={() => go('/signup')}
                        className="inline-flex items-center gap-2 bg-[#00D97E] text-black font-semibold px-8 py-3.5 rounded-lg hover:bg-[#00c470] transition-colors group">
                        Créer mon compte gratuitement
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                </div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="border-t border-[#1a1a1a] py-10 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#00D97E] flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-black" />
                        </div>
                        <span className="font-bold text-[14px]">DjassaBot</span>
                    </div>
                    <p className="text-[#333] text-[12px]">© 2026 DjassaBot — Abidjan, Côte d'Ivoire 🇨🇮</p>
                    <div className="flex gap-5">
                        {['Connexion', 'Créer un compte'].map((label, i) => (
                            <button key={i} onClick={() => go(i === 0 ? '/login' : '/signup')}
                                className="text-[#444] hover:text-white text-[12px] transition-colors">
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
