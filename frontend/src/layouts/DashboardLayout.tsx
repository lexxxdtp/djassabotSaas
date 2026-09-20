import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { Home, ShoppingBag, Settings, LogOut, Package, MessageSquare, ArrowUpRight, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserProfileModal from '../components/UserProfileModal';
import Brand from '../components/ui/Brand';

const navItems = [
    { path: '/dashboard', label: 'Aujourd’hui', mobileLabel: 'Accueil', icon: Home },
    { path: '/dashboard/inbox', label: 'Conversations', mobileLabel: 'Messages', icon: MessageSquare },
    { path: '/dashboard/orders', label: 'Commandes', mobileLabel: 'Commandes', icon: ShoppingBag },
    { path: '/dashboard/products', label: 'Produits', mobileLabel: 'Produits', icon: Package },
    { path: '/dashboard/settings', label: 'Réglages', mobileLabel: 'Réglages', icon: Settings },
];
const extraNames: Record<string, string> = { analytics: 'Vos chiffres', whatsapp: 'Connexion WhatsApp', subscription: 'Abonnement', marketing: 'Campagnes' };

export default function DashboardLayout() {
    const { logout, user, tenant } = useAuth();
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const [profileOpen, setProfileOpen] = useState(false);
    const section = pathname.split('/')[2];
    const label = extraNames[section] || navItems.find(item => item.path === `/dashboard/${section}`)?.label || 'Aujourd’hui';
    const active = (path: string) => path === '/dashboard' ? pathname === path : path === '/dashboard/settings'
        ? pathname.startsWith(path) || ['whatsapp', 'subscription', 'marketing'].includes(section)
        : pathname.startsWith(path);
    const shop = tenant?.name || 'Ma boutique';
    const initial = (tenant?.name?.[0] || user?.email?.[0] || 'D').toUpperCase();

    return <div className="product-app app-shell">
        <a href="#app-content" className="app-skip">Aller au contenu</a>
        <UserProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        <aside className="app-sidebar">
            <div className="app-sidebar-brand"><Brand /><span className="app-sidebar-caption">L’espace de votre commerce.</span></div>
            <button className="app-shop" onClick={() => setProfileOpen(true)} aria-label={`Ouvrir le profil de ${shop}`}><span className="app-avatar">{initial}</span><span><strong>{shop}</strong><small>Mon espace vendeur</small></span><ChevronRight size={16} aria-hidden="true" /></button>
            <nav className="app-navigation" aria-label="Navigation principale"><p className="app-eyebrow">Votre quotidien</p>{navItems.map(item => <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'} className={`app-nav-item ${active(item.path) ? 'is-active' : ''}`}><item.icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{item.label}</span>{active(item.path) && <span className="app-nav-dot" aria-hidden="true" />}</NavLink>)}</nav>
            <div className="app-sidebar-bottom"><Link to="/dashboard/whatsapp" className="app-connection-link"><MessageSquare size={18} aria-hidden="true" /><span>Mon WhatsApp</span><ArrowUpRight size={16} aria-hidden="true" /></Link><button className="app-logout" onClick={() => { logout(); navigate('/login'); }}><LogOut size={17} aria-hidden="true" />Se déconnecter</button><p>Du commerce. Du temps pour vous.</p></div>
        </aside>
        <div className="app-workspace">
            <header className="app-topbar"><div className="app-mobile-brand"><Brand /></div><div className="app-breadcrumb"><span>Espace vendeur</span><ChevronRight size={14} aria-hidden="true" /><span>{label}</span></div><button onClick={() => setProfileOpen(true)} className="app-profile" aria-label="Ouvrir mon profil"><span>{shop}</span><span className="app-avatar">{initial}</span></button></header>
            <main id="app-content" tabIndex={-1} className={`app-content ${section === 'inbox' ? 'app-content-inbox' : ''}`}><Outlet /></main>
        </div>
        <nav className="app-bottom-nav" aria-label="Navigation mobile">{navItems.map(item => <NavLink key={item.path} to={item.path} end={item.path === '/dashboard'} className={active(item.path) ? 'is-active' : ''}><item.icon size={21} strokeWidth={active(item.path) ? 2.25 : 1.75} aria-hidden="true" /><span>{item.mobileLabel}</span></NavLink>)}</nav>
    </div>;
}
