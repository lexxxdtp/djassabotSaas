import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUpRight, Check, CheckCheck, ChevronDown, MessageCircle, Package, ScanLine, SlidersHorizontal, Smartphone, Sparkles, Store, Menu, X, Pause, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useInView } from '../hooks/useInView';
import SalesDemo from '../components/landing/SalesDemo';
import '../styles/landing.css';

function Reveal({ children, className = '' }: React.PropsWithChildren<{ className?: string }>) {
    const { ref, inView } = useInView<HTMLDivElement>('0px');
    return <div ref={ref} data-reveal={inView ? 'visible' : 'hidden'} className={className}>{children}</div>;
}

function Brand() {
    return <span className="lp-brand"><span className="lp-brand-mark">D<span /></span><span>djassa<span className="lp-green">bot</span><span className="lp-brand-dot">®</span></span></span>;
}

const capabilities = [
    { icon: MessageCircle, title: 'Il a le sens du commerce.', text: 'Français, ton chaleureux, expressions ivoiriennes. Votre bot accueille les clients avec la personnalité que vous lui donnez.', label: 'LA CONVERSATION', art: 'voice' },
    { icon: SlidersHorizontal, title: 'Il négocie. À vos conditions.', text: 'Vous fixez vos prix et votre marge. Il discute avec le client en respectant les limites de votre boutique.', label: 'VOS RÈGLES DU JEU', art: 'price' },
    { icon: ScanLine, title: 'Du message à la commande.', text: 'Articles, adresse, livraison, reçu de paiement : retrouvez les informations utiles au même endroit.', label: 'LA VENTE, ORGANISÉE', art: 'order' },
];

const plans = [
    { name: 'Starter', price: '5 000', description: 'Le début d’une belle histoire.', features: ['1 numéro WhatsApp', 'Jusqu’à 50 produits', 'Bot de vente personnalisable', 'Gestion des commandes', 'Support par email'] },
    { name: 'Pro', price: '10 000', description: 'Plus de place pour vos ambitions.', features: ['Tout le plan Starter', 'Produits illimités', 'Statistiques détaillées', 'Support prioritaire'], featured: true },
    { name: 'Business', price: '15 000', description: 'Un accompagnement plus proche.', features: ['Tout le plan Pro', 'Support VIP', 'Formation personnalisée', 'Configuration sur mesure'] },
];

const questions = [
    { question: 'Je dois changer de numéro WhatsApp ?', answer: 'Non. Vous connectez votre numéro avec un code de jumelage ou un QR code. Les clients continuent à vous écrire comme d’habitude. Gardez votre téléphone principal régulièrement connecté à WhatsApp.' },
    { question: 'Et si je veux répondre moi-même ?', answer: 'Vous pouvez reprendre une conversation depuis votre espace vendeur et mettre le bot en pause pour ce client. Vous pouvez aussi désactiver le bot pour toute la boutique.' },
    { question: 'Le bot peut-il casser mes prix ?', answer: 'Vous définissez un prix minimum ou une marge de négociation dans vos réglages. Le serveur vérifie le prix proposé avant d’ajouter un article à la commande. Vous pouvez également désactiver la négociation.' },
    { question: 'Comment se passent les paiements des clients ?', answer: 'Vous configurez les moyens de paiement de votre boutique. Les clients peuvent envoyer leur reçu Wave ou Orange Money dans la conversation. Le bot analyse le reçu ; vérifiez toujours que le paiement est bien arrivé sur votre compte.' },
    { question: 'Est-ce que ça marche sur mon téléphone ?', answer: 'Oui. Votre espace vendeur fonctionne dans le navigateur de votre téléphone. Vous pouvez aussi l’ajouter à votre écran d’accueil pour retrouver rapidement vos commandes, produits et conversations.' },
];

export default function LandingPage() {
    const { isAuthenticated } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [motionPaused, setMotionPaused] = useState(false);
    const signupUrl = isAuthenticated ? '/dashboard' : '/signup';

    return (
        <div className={`landing ${motionPaused ? 'lp-motion-paused' : ''}`}>
            <a href="#main-content" className="lp-skip">Aller au contenu</a>
            <header className="lp-header">
                <div className="lp-container lp-nav">
                    <Link to="/" aria-label="DjassaBot, accueil"><Brand /></Link>
                    <nav className="lp-desktop-nav" aria-label="Navigation principale">
                        <a href="#features">Le bot</a><a href="#demo">En action <span className="lp-mini-dot" /></a><a href="#pricing">Les tarifs</a>
                    </nav>
                    <div className="lp-nav-actions">
                        <Link className="lp-login" to={isAuthenticated ? '/dashboard' : '/login'}>{isAuthenticated ? 'Mon espace' : 'Connexion'}</Link>
                        <Link className="lp-button lp-button-small" to={signupUrl}>C’est parti <ArrowUpRight size={16} /></Link>
                        <button className="lp-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-navigation" aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
                    </div>
                </div>
                {menuOpen && <nav id="mobile-navigation" className="lp-mobile-nav" aria-label="Navigation mobile">
                    <a onClick={() => setMenuOpen(false)} href="#features">Le bot <ArrowUpRight size={18} /></a>
                    <a onClick={() => setMenuOpen(false)} href="#demo">En action <ArrowUpRight size={18} /></a>
                    <a onClick={() => setMenuOpen(false)} href="#pricing">Les tarifs <ArrowUpRight size={18} /></a>
                    <Link to={isAuthenticated ? '/dashboard' : '/login'}>{isAuthenticated ? 'Mon espace' : 'Connexion'} <ArrowUpRight size={18} /></Link>
                </nav>}
            </header>

            <main id="main-content">
                <section className="lp-container lp-hero">
                    <div className="lp-hero-copy reveal-stagger">
                        <p className="lp-eyebrow"><span className="lp-mini-dot" /> LE COMMERCE D’ICI. L’IA EN PLUS.</p>
                        <h1>Le business<br />continue.<br /><em>Même sans vous.</em></h1>
                        <p className="lp-hero-description">Vos clients sont sur WhatsApp.<br />Votre meilleur vendeur aussi.</p>
                        <p className="lp-hero-detail">DjassaBot répond, négocie et prend les commandes.<br className="lp-desktop-break" /> À votre image. Selon vos règles.</p>
                        <div className="lp-hero-actions"><Link to={signupUrl} className="lp-button">Créer ma boutique <ArrowUpRight size={19} /></Link><a className="lp-text-link" href="#demo"><span className="lp-play"><Play size={12} fill="currentColor" /></span> Voir le bot en action</a></div>
                        <p className="lp-trial"><Check size={14} /> 30 jours d’essai <span>·</span> Sans carte bancaire</p>
                    </div>
                    <div className="lp-hero-art" aria-label="Illustration des fonctions du bot WhatsApp">
                        <div className="lp-orbit lp-orbit-one" aria-hidden="true" /><div className="lp-orbit lp-orbit-two" aria-hidden="true" />
                        <div className="lp-disc" aria-hidden="true"><span>d.</span></div>
                        <div className="lp-art-stamp"><Sparkles size={15} /> FAIT POUR LE DJASSA</div>
                        <div className="lp-phone">
                            <div className="lp-phone-top"><span>Votre boutique</span><span className="lp-phone-camera" /><MessageCircle size={15} /></div>
                            <div className="lp-phone-profile"><span className="lp-bot-avatar">d.</span><div><strong>Votre vendeur IA</strong><small>Un aperçu de ce qu’il sait faire</small></div><Sparkles size={18} /></div>
                            <div className="lp-phone-body">
                                <span className="lp-chat-label">COMMENT ÇA MARCHE</span>
                                <div className="lp-hero-bubble lp-hero-bubble-user">Un client vous écrit…<CheckCheck size={14} /></div>
                                <div className="lp-hero-bubble lp-hero-bubble-bot">Votre bot prend le relais.<br /><strong>Avec le sens de l’accueil.</strong></div>
                                <div className="lp-product-art"><svg viewBox="0 0 220 130" role="img" aria-label="Illustration d’un sac de boutique"><ellipse cx="113" cy="118" rx="70" ry="7" fill="#000" opacity=".15" /><path d="M63 47 166 40 182 115 48 115Z" fill="#ffb892" /><path d="m63 47 20 13-10 55H48Z" fill="#d58c69" /><path d="m83 60 83-20 16 75H73Z" fill="#ffd2b5" /><path d="M94 63V40c0-33 44-33 44 0v14" fill="none" stroke="#342b23" strokeWidth="6" strokeLinecap="round" /><path d="m110 77 30-7-12 32-20 4Z" fill="#00d97e" /><path d="m121 82 9-2-5 14-6 1Z" fill="#111" /></svg><div><span>Votre catalogue</span><small>Photos · Prix · Disponibilités</small></div></div>
                                <div className="lp-hero-bubble lp-hero-bubble-bot">Il conseille. Il négocie.<br />Il prépare la commande.<span className="lp-typing" aria-hidden="true"><i /><i /><i /></span></div>
                            </div>
                            <div className="lp-phone-bottom"><span>Votre commerce, bien accompagné.</span><span><ArrowUpRight size={17} /></span></div>
                        </div>
                        <div className="lp-float-tag lp-tag-control"><span className="lp-tag-icon"><SlidersHorizontal size={18} /></span><div><strong>Vos prix. Vos règles.</strong><small>Vous gardez la main.</small></div></div>
                        <div className="lp-float-tag lp-tag-order"><span className="lp-tag-icon"><Package size={18} /></span><div><strong>Prêt pour la livraison.</strong><small>Chaque commande organisée.</small></div><Check size={17} /></div>
                        <span className="lp-art-caption">WHATSAPP × VOTRE SAVOIR-FAIRE</span>
                    </div>
                </section>

                <div className="lp-container lp-hero-foot"><span><span className="lp-location-dot" /> Pensé à Abidjan. Pour les commerces d’ici.</span><a href="#features">La suite <ArrowDown size={15} /></a></div>
                <div className="lp-ticker" aria-label="Mode, beauté, restauration, accessoires, votre commerce">
                    <div className="lp-ticker-track" aria-hidden="true">{[0, 1].map(copy => <div key={copy}>{['LA MODE', 'LA BEAUTÉ', 'LA RESTAURATION', 'LES ACCESSOIRES', 'VOTRE COMMERCE'].map(word => <span key={word}>{word}<span className="lp-spark">✳</span></span>)}</div>)}</div>
                    <button className="lp-motion-toggle" onClick={() => setMotionPaused(!motionPaused)} aria-pressed={motionPaused} aria-label={motionPaused ? 'Reprendre les animations décoratives' : 'Mettre en pause les animations décoratives'}>{motionPaused ? <Play size={15} /> : <Pause size={15} />}</button>
                </div>

                <section id="features" className="lp-container lp-section">
                    <Reveal className="lp-section-heading"><div><p className="lp-eyebrow">01 / UN VENDEUR QUI VOUS RESSEMBLE</p><h2>Vous avez le talent.<br /><em>Il vous donne le temps.</em></h2></div><p>Les mêmes questions, les prix à discuter, les commandes à noter… Vous connaissez. Lui aussi.</p></Reveal>
                    <Reveal className="lp-feature-grid">{capabilities.map(({ icon: Icon, title, text, label, art }) => <article className={`lp-feature lp-feature-${art}`} key={art}>
                        <div className="lp-feature-top"><span>{label}</span><Icon size={21} strokeWidth={1.5} /></div>
                        <div className="lp-feature-visual" aria-hidden="true">
                            {art === 'voice' && <><span className="lp-quote">« On est ensemble. »</span><div className="lp-waveform">{[10, 24, 38, 18, 48, 32, 56, 22, 42, 16, 32, 10].map((height, i) => <i key={i} style={{ height, animationDelay: `${i * 90}ms` }} />)}</div><span className="lp-visual-caption">LE TON DE VOTRE BOUTIQUE</span></>}
                            {art === 'price' && <><div className="lp-price-rail"><span>Prix minimum</span><span>Prix affiché</span></div><div className="lp-negotiation-rail"><span /><i /><i /><i /><i /><i /></div><div className="lp-rule-note"><Check size={14} /> Votre marge est la limite.</div></>}
                            {art === 'order' && <div className="lp-mini-receipt"><div><span>LA COMMANDE</span><CheckCheck size={17} /></div>{['Articles choisis', 'Adresse renseignée', 'Total calculé'].map(item => <p key={item}><Check size={13} />{item}</p>)}<span className="lp-receipt-tear" /></div>}
                        </div>
                        <h3>{title}</h3><p>{text}</p>
                    </article>)}</Reveal>
                    <Reveal className="lp-control-note"><span><Store size={19} /> Toujours votre commerce.</span><p>Mettez le bot en pause ou reprenez la conversation à tout moment.</p><ArrowUpRight size={20} aria-hidden="true" /></Reveal>
                </section>

                <section id="demo" className="lp-demo-section"><div className="lp-container lp-demo-layout"><Reveal className="lp-demo-copy"><p className="lp-eyebrow">02 / MOINS DE BLABLA. PLACE AU BOT.</p><h2>Le prochain message<br />peut être<br /><em>une commande.</em></h2><p>Découvrez comment le bot accompagne un client. Choisissez une question, puis regardez la conversation avancer.</p><div className="lp-demo-points"><span><MessageCircle size={17} /> Une conversation naturelle</span><span><SlidersHorizontal size={17} /> Les règles de votre boutique</span><span><Package size={17} /> Une vente bien organisée</span></div><p className="lp-demo-disclaimer">Démonstration guidée et illustrative.<br />Aucun message WhatsApp ni commande réelle.</p></Reveal><Reveal><SalesDemo /></Reveal></div></section>

                <section className="lp-container lp-section" id="how-it-works"><Reveal className="lp-section-heading"><div><p className="lp-eyebrow">03 / SIMPLE, COMME BONJOUR.</p><h2>Votre boutique.<br /><em>En mode augmenté.</em></h2></div><Link className="lp-text-link" to={signupUrl}>Je me lance <ArrowUpRight size={18} /></Link></Reveal><Reveal className="lp-steps">{[
                    { icon: Smartphone, title: 'Connectez WhatsApp.', text: 'Un code ou un QR code, et votre numéro rejoint votre espace vendeur.' },
                    { icon: Package, title: 'Montrez ce que vous vendez.', text: 'Ajoutez les photos, les prix et le stock. Précisez comment vous aimez vendre.' },
                    { icon: Sparkles, title: 'Donnez-lui le feu vert.', text: 'Testez votre bot, ajustez son ton, puis activez-le quand vous êtes prêt.' },
                ].map(({ icon: Icon, title, text }, i) => <article key={title}><div className="lp-step-number">0{i + 1}<Icon size={25} strokeWidth={1.5} /></div><h3>{title}</h3><p>{text}</p></article>)}</Reveal></section>

                <section id="pricing" className="lp-container lp-section lp-pricing-section"><Reveal className="lp-pricing-heading"><p className="lp-eyebrow">04 / UN PRIX QUI PARLE COMMERCE.</p><h2>De petites boutiques.<br /><em>De grandes ambitions.</em></h2><p>30 jours pour essayer. Puis le plan qui vous correspond.</p></Reveal><Reveal className="lp-plans">{plans.map(plan => <article className={`lp-plan ${plan.featured ? 'lp-plan-featured' : ''}`} key={plan.name}><div className="lp-plan-name"><h3>{plan.name}</h3>{plan.featured && <span>POUR GRANDIR <Sparkles size={11} /></span>}</div><p>{plan.description}</p><div className="lp-plan-price">{plan.price}<span>FCFA / mois</span></div><Link className={`lp-button ${plan.featured ? '' : 'lp-button-outline'}`} to={signupUrl}>Choisir {plan.name}<ArrowUpRight size={17} /></Link><ul>{plan.features.map(feature => <li key={feature}><Check size={15} />{feature}</li>)}</ul></article>)}</Reveal></section>

                <section className="lp-container lp-section lp-faq"><Reveal><p className="lp-eyebrow">ON VOUS RÉPOND.</p><h2>Les bonnes<br /><em>questions.</em></h2><span className="lp-faq-flower" aria-hidden="true">✳</span></Reveal><div>{questions.map(item => <details className="lp-faq-item" key={item.question}><summary>{item.question}<ChevronDown size={19} /></summary><p>{item.answer}</p></details>)}</div></section>

                <section className="lp-final"><div className="lp-container"><Reveal><p className="lp-eyebrow">LE PROCHAIN CHAPITRE DE VOTRE COMMERCE.</p><h2>On fait<br /><em>du business ?</em><ArrowUpRight aria-hidden="true" /></h2><div className="lp-final-bottom"><p>Votre boutique mérite un coup de main.<br />Donnez-lui DjassaBot.</p><Link className="lp-button lp-button-dark" to={signupUrl}>Créer ma boutique <ArrowUpRight size={19} /></Link></div></Reveal></div></section>
            </main>
            <footer className="lp-container lp-footer"><div className="lp-footer-top"><Link to="/" aria-label="DjassaBot, accueil"><Brand /></Link><p>Le commerce a de l’avenir.<br />Et l’accent d’ici.</p><nav aria-label="Liens utiles"><Link to="/login">Connexion</Link><Link to="/conditions">Conditions</Link><Link to="/confidentialite">Confidentialité</Link></nav></div><div className="lp-footer-bottom"><span>© {new Date().getFullYear()} DjassaBot · Abidjan, Côte d’Ivoire</span><span>CONÇU POUR CEUX QUI ENTREPRENNENT. <span className="lp-green">↗</span></span></div><p className="lp-recaptcha">Ce site est protégé par reCAPTCHA. La <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">politique de confidentialité</a> et les <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer">conditions d’utilisation</a> de Google s’appliquent.</p></footer>
        </div>
    );
}
