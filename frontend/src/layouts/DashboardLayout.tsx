
import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ShoppingBag, Settings, LogOut, Package, MessageSquare, User, Bell, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import UserProfileModal from '../components/UserProfileModal';

const DashboardLayout: React.FC = () => {
    const { logout, user, tenant } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [userModalOpen, setUserModalOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Nav structure — task-oriented, not module-oriented
    // Marketing hidden (not functional yet). WhatsApp + Subscription moved under Réglages.
    const navItems = [
        { path: '/dashboard', label: 'Aujourd\'hui', icon: Home, mobileLabel: 'Accueil' },
        { path: '/dashboard/inbox', label: 'Conversations', icon: MessageSquare, mobileLabel: 'Conv' },
        { path: '/dashboard/orders', label: 'Commandes', icon: ShoppingBag, mobileLabel: 'Commandes' },
        { path: '/dashboard/products', label: 'Produits', icon: Package, mobileLabel: 'Produits' },
        { path: '/dashboard/settings', label: 'Réglages', icon: Settings, mobileLabel: 'Réglages' },
    ];

    // Bottom nav items (subset for mobile — 5 max)
    const bottomNavItems = navItems.filter(item => item.mobileLabel);

    // Check if a path is active (exact for /dashboard, startsWith for others)
    const isPathActive = (path: string) => {
        if (path === '/dashboard') return location.pathname === '/dashboard';
        return location.pathname.startsWith(path);
    };

    return (
        <div className="flex h-[100dvh] bg-[#050605] text-white overflow-hidden">
            <UserProfileModal isOpen={userModalOpen} onClose={() => setUserModalOpen(false)} />

            <div className="djassa-orb hidden md:block -top-72 -right-40" aria-hidden="true" />

            {/* ========== SIDEBAR DESKTOP (unchanged) ========== */}
            <aside className="hidden md:flex flex-col relative z-10 w-[276px] bg-[#090a09]/95 border-r border-[#242824]">
                <div className="p-6 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#00D97E] grid place-items-center text-black font-black text-xl shadow-[0_0_28px_rgba(0,217,126,.18)]">D</div>
                        <div>
                            <h1 className="text-lg font-black tracking-[-.06em] leading-none text-white">DJASSA<span className="text-[#00D97E]">BOT</span></h1>
                            <p className="text-[9px] text-[#737d75] mt-1.5 uppercase tracking-[.18em] font-bold">Commerce autonome</p>
                        </div>
                    </div>
                    <div className="mt-7 p-3 rounded-xl bg-[#101310] border border-[#242824] flex items-center gap-2.5">
                        <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D97E] opacity-50" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00D97E]" /></span>
                        <span className="text-xs font-semibold text-[#c7cdc8]">Espace vendeur</span>
                    </div>
                </div>

                <nav className="flex-1 px-4 py-3 space-y-1">
                    <p className="djassa-kicker px-3 mb-3">Pilotage</p>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/dashboard'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                                    ? 'bg-[#00D97E] text-[#031c11] shadow-[0_10px_24px_rgba(0,217,126,.12)]'
                                    : 'text-[#8d968f] hover:bg-[#151816] hover:text-white'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={19} strokeWidth={isActive ? 2.5 : 1.8} className="transition-colors" />
                                    <span className="font-bold text-sm tracking-[-.01em] flex-1">{item.label}</span>
                                    {isActive && <ChevronRight size={15} />}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-[#242824] space-y-2">
                    <button
                        onClick={() => setUserModalOpen(true)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-[#101310] hover:bg-[#151816] border border-[#242824] transition-all group text-left"
                    >
                        <div className="relative">
                            <div className="w-9 h-9 rounded-xl bg-[#00D97E]/10 flex items-center justify-center text-[#00D97E] font-black border border-[#00D97E]/20 transition-colors">
                                {tenant?.name?.[0] || user?.email?.[0] || 'U'}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-black rounded-full flex items-center justify-center border border-[#1a1a1a]">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            </div>
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-bold text-white truncate group-hover:text-[#00D97E] transition-colors">{tenant?.name || 'Mon Business'}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-[#737d75] truncate max-w-full">{user?.email || 'Compte vendeur'}</span>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-[#888] hover:text-red-400 transition-colors justify-center"
                    >
                        <LogOut size={14} />
                        Déconnexion
                    </button>
                </div>
            </aside>

            {/* ========== MAIN CONTENT ========== */}
            <main className="flex-1 overflow-auto relative z-0 djassa-surface scrollbar-hide flex flex-col">
                {/* Mobile Header — compact, logo + profile */}
                <div className="md:hidden flex items-center justify-between px-4 py-3.5 border-b border-[#242824] bg-[#090a09]/95 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-[#00D97E] grid place-items-center text-black text-sm font-black">D</div><h1 className="text-base font-black tracking-[-.06em]">DJASSA<span className="text-[#00D97E]">BOT</span></h1></div>
                    <div className="flex items-center gap-2"><button aria-label="Notifications" className="w-8 h-8 grid place-items-center text-[#8d968f]"><Bell size={17} /></button>
                    <button
                        onClick={() => setUserModalOpen(true)}
                        className="w-8 h-8 rounded-full bg-[#00D97E]/10 flex items-center justify-center text-[#00D97E] font-bold text-xs border border-[#00D97E]/20 active:scale-95 transition-transform"
                    >
                        {tenant?.name?.[0] || user?.email?.[0] || <User size={14} />}
                    </button></div>
                </div>

                {/* Page Content — extra bottom padding on mobile for the nav bar */}
                <div className="flex-1 p-4 md:p-8 lg:p-10 pb-24 md:pb-10 max-w-[1440px] mx-auto w-full">
                    <Outlet />
                </div>
            </main>

            {/* ========== MOBILE BOTTOM NAVIGATION ========== */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#090a09]/95 backdrop-blur-xl border-t border-[#242824]">
                {/* Safe area for iPhones with home indicator */}
                <div className="flex items-center justify-around px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                    {bottomNavItems.map((item) => {
                        const active = isPathActive(item.path);
                        return (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 active:scale-90 min-w-[56px]"
                            >
                                <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? 'bg-[#00D97E]/15' : ''}`}>
                                    <item.icon
                                        size={22}
                                        className={`transition-colors duration-200 ${active ? 'text-[#00D97E]' : 'text-[#8d968f]'}`}
                                        strokeWidth={active ? 2.5 : 1.5}
                                    />
                                </div>
                                <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-[#00D97E]' : 'text-[#555]'}`}>
                                    {item.mobileLabel}
                                </span>
                            </NavLink>
                        );
                    })}
                </div>
            </nav>
        </div>
    );
};

export default DashboardLayout;
