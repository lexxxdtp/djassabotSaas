import { Outlet, Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, MessageCircle, PackageCheck, SlidersHorizontal } from 'lucide-react';
import Brand from '../components/ui/Brand';

export default function AuthLayout() {
    const { pathname } = useLocation();
    const creating = pathname === '/signup' || pathname === '/onboarding';
    return <div className="product-app auth-app">
        <a className="app-skip" href="#auth-content">Aller au formulaire</a>
        <header className="auth-topbar"><Brand /><Link to={creating ? '/login' : '/signup'} className="app-text-link">{creating ? 'Déjà un compte ?' : 'Créer ma boutique'}<ArrowUpRight size={17} aria-hidden="true" /></Link></header>
        <div className="auth-layout">
            <aside className="auth-story" aria-label="Votre espace vendeur">
                <p className="app-eyebrow"><span aria-hidden="true" />Le commerce d’ici. L’IA en plus.</p>
                <h2>Votre boutique.<br /><em>À votre image.</em></h2>
                <p>Vos produits, votre façon de vendre. Un assistant pour les questions du quotidien, et vous pour l’essentiel.</p>
                <div className="auth-commerce-note">
                    <span className="auth-note-label">VOTRE ESPACE VENDEUR</span>
                    <div><MessageCircle aria-hidden="true" /><span>Les conversations, au même endroit.</span></div>
                    <div><PackageCheck aria-hidden="true" /><span>Les commandes, bien organisées.</span></div>
                    <div><SlidersHorizontal aria-hidden="true" /><span>Les règles, c’est vous qui les fixez.</span></div>
                    <p>Votre commerce, bien accompagné.<span aria-hidden="true">↗</span></p>
                </div>
                <span className="auth-origin">Pensé à Abidjan. Pour les commerces d’ici.</span>
            </aside>
            <main id="auth-content" className="auth-content" tabIndex={-1}><Outlet /></main>
        </div>
        <footer className="auth-footer"><span>© {new Date().getFullYear()} DjassaBot</span><nav aria-label="Informations légales"><Link to="/conditions">Conditions</Link><Link to="/confidentialite">Confidentialité</Link></nav></footer>
    </div>;
}
