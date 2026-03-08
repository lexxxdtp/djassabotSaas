
import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Settings, LogOut, Package, Share2, MessageSquare, User } from 'lucide-react';
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

    // All nav items for desktop sidebar
    const navItems = [
        { path: '/dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard, mobileLabel: 'Accueil' },
        { path: '/dashboard/inbox', label: 'Discussions', icon: MessageSquare, mobileLabel: 'Chat' },
        { path: '/dashboard/orders', label: 'Commandes', icon: ShoppingBag, mobileLabel: 'Commandes' },
        { path: '/dashboard/products', label: 'Produits', icon: Package, mobileLabel: 'Produits' },
        { path: '/dashboard/marketing', label: 'Marketing', icon: Share2 },
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
        <div className="flex h-screen bg-[#0f111a] text-slate-200 font-sans">
            <UserProfileModal isOpen={userModalOpen} onClose={() => setUserModalOpen(false)} />

            {/* ========== SIDEBAR DESKTOP (unchanged) ========== */}
            <aside className="hidden md:flex flex-col w-64 bg-[#0a0c10] border-r border-white/5">
                <div className="p-6 border-b border-white/5">
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-1">
                        DJASSA<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">BOT</span>
                    </h1>
                    <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-semibold">Vendeur Augmenté</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/dashboard'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${isActive
                                    ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500'
                                    : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={20} className={`transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-white'}`} />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5 space-y-2">
                    <button
                        onClick={() => setUserModalOpen(true)}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group text-left"
                    >
                        <div className="relative">
                            <div className="w-9 h-9 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold border border-indigo-500/30 group-hover:border-indigo-500/50 transition-colors">
                                {tenant?.name?.[0] || user?.email?.[0] || 'U'}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#0a0c10] rounded-full flex items-center justify-center border border-white/10">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            </div>
                        </div>
                        <div className="overflow-hidden flex-1">
                            <p className="text-sm font-bold text-white truncate group-hover:text-indigo-400 transition-colors">{tenant?.name || 'Mon Business'}</p>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-mono uppercase truncate max-w-full">{user?.email}</span>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-zinc-500 hover:text-red-400 transition-colors justify-center"
                    >
                        <LogOut size={14} />
                        Déconnexion
                    </button>
                </div>
            </aside>

            {/* ========== MAIN CONTENT ========== */}
            <main className="flex-1 overflow-auto bg-[#0f111a] scrollbar-hide flex flex-col">
                {/* Mobile Header — compact, logo + profile */}
                <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0a0c10]/90 backdrop-blur-md sticky top-0 z-10">
                    <h1 className="text-lg font-bold text-white tracking-tight">
                        DJASSA<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-600">BOT</span>
                    </h1>
                    <button
                        onClick={() => setUserModalOpen(true)}
                        className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-xs border border-indigo-500/30 active:scale-95 transition-transform"
                    >
                        {tenant?.name?.[0] || user?.email?.[0] || <User size={14} />}
                    </button>
                </div>

                {/* Page Content — extra bottom padding on mobile for the nav bar */}
                <div className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
                    <Outlet />
                </div>
            </main>

            {/* ========== MOBILE BOTTOM NAVIGATION ========== */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0a0c10]/95 backdrop-blur-xl border-t border-white/5">
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
                                <div className={`p-1.5 rounded-xl transition-all duration-200 ${active ? 'bg-indigo-500/15' : ''}`}>
                                    <item.icon
                                        size={22}
                                        className={`transition-colors duration-200 ${active ? 'text-indigo-400' : 'text-zinc-500'}`}
                                        strokeWidth={active ? 2.5 : 1.5}
                                    />
                                </div>
                                <span className={`text-[10px] font-medium transition-colors duration-200 ${active ? 'text-indigo-400' : 'text-zinc-600'}`}>
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
