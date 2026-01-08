
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Settings, LogOut, Package, Share2, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DashboardLayout: React.FC = () => {
    const { logout, user } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { path: '/dashboard', label: 'Vue d\'ensemble', icon: LayoutDashboard },
        { path: '/dashboard/orders', label: 'Commandes', icon: ShoppingBag },
        { path: '/dashboard/products', label: 'Produits', icon: Package },
        { path: '/dashboard/marketing', label: 'Marketing', icon: Share2 },
        { path: '/dashboard/settings', label: 'Réglages', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-black text-slate-200 font-sans">
            {/* Sidebar Desktop */}
            <aside className="hidden md:flex flex-col w-64 bg-zinc-950 border-r border-zinc-800">
                <div className="p-6 border-b border-zinc-800">
                    <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-1">
                        DJASSA<span className="text-orange-500">BOT</span>
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
                                    ? 'bg-orange-500/5 text-orange-500 border-l-2 border-orange-500'
                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={20} className={`transition-colors ${isActive ? 'text-orange-500' : 'text-zinc-500 group-hover:text-white'}`} />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                <div className="p-4 border-t border-zinc-800">
                    <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg hover:bg-zinc-900/50 transition-colors">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-orange-500 font-bold border border-zinc-700">
                            {(user as any)?.name?.[0] || 'U'}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">{(user as any)?.name}</p>
                            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-zinc-500 hover:text-red-400 transition-colors"
                    >
                        <LogOut size={16} />
                        Déconnexion
                    </button>
                </div>
            </aside>

            {/* Mobile Menu Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden" onClick={() => setMobileMenuOpen(false)}>
                    <div className="absolute left-0 top-0 bottom-0 w-64 bg-zinc-950 border-r border-zinc-800 p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <h1 className="text-xl font-bold text-white">DJASSA<span className="text-orange-500">BOT</span></h1>
                            <button onClick={() => setMobileMenuOpen(false)} className="text-zinc-400 hover:text-white"><X size={24} /></button>
                        </div>
                        <nav className="space-y-2">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.path}
                                    to={item.path}
                                    onClick={() => setMobileMenuOpen(false)}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive ? 'bg-orange-500/10 text-orange-500' : 'text-zinc-400'
                                        }`
                                    }
                                >
                                    <item.icon size={20} />
                                    <span>{item.label}</span>
                                </NavLink>
                            ))}
                        </nav>
                    </div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 overflow-auto bg-black scrollbar-hide">
                <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
                    <h1 className="font-bold text-white">DJASSA<span className="text-orange-500">BOT</span></h1>
                    <button onClick={() => setMobileMenuOpen(true)} className="text-white"><Menu size={24} /></button>
                </div>
                <div className="p-4 md:p-8 max-w-7xl mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default DashboardLayout;
