import React, { useState, useEffect } from 'react';
import { ArrowRight, Mail, Lock, TrendingUp, Users, Zap } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';

const Login: React.FC = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();

    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let formattedIdentifier = identifier;
            const isTenDigitNumber = /^\d{10}$/.test(identifier);
            if (isTenDigitNumber) {
                formattedIdentifier = `+225${identifier}`;
            } else {
                formattedIdentifier = identifier.toLowerCase().trim();
            }

            const response = await apiClient('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    identifier: formattedIdentifier,
                    password,
                    rememberMe
                }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Identifiants invalides');

            login(data.token, data.user, data.tenant, rememberMe);
            navigate('/dashboard');
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Une erreur inconnue est survenue";
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex">

            {/* ========== GAUCHE : BRANDING (desktop only) ========== */}
            <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative border-r border-[#1a1a1a]">
                {/* Logo */}
                <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-[#00D97E] flex items-center justify-center">
                        <span className="text-black font-black text-base">D</span>
                    </div>
                    <span className="text-lg font-black tracking-tight text-white">
                        DJASSA<span className="text-[#00D97E]">BOT</span>
                    </span>
                </div>

                {/* Headline */}
                <div className="space-y-8">
                    <div className="space-y-3">
                        <p className="text-[#00D97E] text-[11px] font-bold uppercase tracking-[0.2em]">Commerce IA sur WhatsApp</p>
                        <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.05] tracking-tight">
                            Votre boutique<br />
                            vend pendant<br />
                            que vous dormez.
                        </h2>
                    </div>
                    <p className="text-[#888] text-base leading-relaxed max-w-md">
                        Le premier bot WhatsApp conçu pour les commerçants d'Afrique de l'Ouest.
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 pt-4 max-w-md">
                        {[
                            { icon: TrendingUp, value: 'Wave · OM', label: 'Paiements' },
                            { icon: Users, value: '2 min', label: 'Installation' },
                            { icon: Zap, value: '24/7', label: 'Bot actif' },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-xl border border-[#1a1a1a] bg-[#111] p-4">
                                <stat.icon className="w-4 h-4 text-[#00D97E] mb-3" />
                                <div className="text-white font-bold text-xl tracking-tight">{stat.value}</div>
                                <div className="text-[#555] text-[10px] uppercase tracking-wider mt-0.5">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <p className="text-[#555] text-xs">© 2026 DjassaBot — Abidjan, Côte d'Ivoire 🇨🇮</p>
            </div>

            {/* ========== DROITE : FORMULAIRE ========== */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-sm">

                    {/* Header mobile uniquement */}
                    <div className="lg:hidden text-center mb-10">
                        <div className="w-12 h-12 rounded-xl bg-[#00D97E] flex items-center justify-center mx-auto mb-4">
                            <span className="text-black font-black text-xl">D</span>
                        </div>
                        <h1 className="text-xl font-black text-white tracking-tight">DJASSA<span className="text-[#00D97E]">BOT</span></h1>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white tracking-tight mb-1">Bon retour 👋</h2>
                        <p className="text-[#888] text-sm">Connectez-vous à votre espace vendeur</p>
                    </div>

                    {/* Erreur */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Identifiant */}
                        <div>
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-2">Email ou Téléphone</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] w-4 h-4" />
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="email@exemple.com ou 0707XXXXXX"
                                    required
                                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Mot de passe */}
                        <div>
                            <label className="block text-[10px] font-bold text-[#888] uppercase tracking-widest mb-2">Mot de passe</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#555] w-4 h-4" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-[#111] border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Remember + forgot */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={() => setRememberMe(!rememberMe)}
                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-[#00D97E] border-[#00D97E]' : 'bg-transparent border-[#333]'}`}
                                >
                                    {rememberMe && <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </button>
                                <label onClick={() => setRememberMe(!rememberMe)} className="text-xs text-[#888] cursor-pointer">Me garder connecté</label>
                            </div>
                            <Link to="/forgot-password" className="text-xs text-[#00D97E] hover:text-white transition-colors font-medium">Mot de passe oublié ?</Link>
                        </div>

                        {/* Bouton */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-3 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] text-sm"
                        >
                            {loading ? 'Connexion...' : 'Accéder au Dashboard'}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-[#888]">
                        Pas de compte ?{' '}
                        <Link to="/signup" className="text-[#00D97E] hover:text-white font-bold transition-colors">Créer un compte</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
