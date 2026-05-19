import React, { useState, useEffect } from 'react';
import { ArrowRight, Mail, Lock, Bot, TrendingUp, Users, Zap } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';

const Login: React.FC = () => {
    const [identifier, setIdentifier] = useState(''); // email OU téléphone (+225XXXXXXXXXX)
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true); // Par défaut activé
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    const API_URL = getApiUrl();

    // Redirect to dashboard if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            console.log('[Login] User already authenticated, redirecting to dashboard');
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Auto-detect phone number format (10 digits)
            let formattedIdentifier = identifier;
            const isTenDigitNumber = /^\d{10}$/.test(identifier);
            if (isTenDigitNumber) {
                formattedIdentifier = `+225${identifier}`;
            } else {
                formattedIdentifier = identifier.toLowerCase().trim();
            }

            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: formattedIdentifier,
                    password,
                    rememberMe // Envoyer au backend pour token longue durée
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Identifiants invalides');
            }

            // Pass rememberMe to login function for storage decision
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
            <div className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden border-r border-[#1a1a1a]">
                {/* Orbs de fond */}
                <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#00D97E]/8 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-[#0EA5E9]/8 rounded-full blur-3xl pointer-events-none" />

                {/* Logo */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D97E] to-[#0EA5E9] flex items-center justify-center shadow-lg shadow-[#00D97E]/20">
                            <Bot className="text-white w-5 h-5" />
                        </div>
                        <span className="text-xl font-black tracking-tight text-white">
                            DJASSA<span className="text-[#00D97E]">BOT</span>
                        </span>
                    </div>
                </div>

                {/* Headline */}
                <div className="relative z-10 space-y-6">
                    <div className="space-y-2">
                        <p className="text-[#00D97E] text-sm font-semibold uppercase tracking-widest">Commerce IA sur WhatsApp</p>
                        <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1]">
                            Votre boutique<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00D97E] to-[#0EA5E9]">
                                vend pendant<br />que vous dormez.
                            </span>
                        </h2>
                    </div>
                    <p className="text-slate-400 text-base leading-relaxed max-w-sm">
                        Le premier bot WhatsApp conçu pour les commerçants d'Afrique de l'Ouest. Automatisez vos ventes, gérez vos commandes, encaissez en ligne.
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 pt-4">
                        {[
                            { icon: TrendingUp, value: '+340%', label: 'Ventes moyennes' },
                            { icon: Users, value: '2 min', label: 'Setup complet' },
                            { icon: Zap, value: '24/7', label: 'Bot actif' },
                        ].map((stat) => (
                            <div key={stat.label} className="rounded-xl border border-white/8 bg-white/3 p-4 backdrop-blur-sm">
                                <stat.icon className="w-4 h-4 text-[#00D97E] mb-2" />
                                <div className="text-white font-bold text-lg">{stat.value}</div>
                                <div className="text-slate-500 text-xs">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="relative z-10">
                    <p className="text-slate-600 text-xs">© 2026 DjassaBot — Abidjan, Côte d'Ivoire 🇨🇮</p>
                </div>
            </div>

            {/* ========== DROITE : FORMULAIRE ========== */}
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
                <div className="w-full max-w-sm">

                    {/* Header mobile uniquement */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#00D97E] to-[#0EA5E9] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#00D97E]/20">
                            <Bot className="text-white w-7 h-7" />
                        </div>
                        <h1 className="text-2xl font-black text-white">DJASSA<span className="text-[#00D97E]">BOT</span></h1>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white mb-1">Bon retour 👋</h2>
                        <p className="text-slate-500 text-sm">Connectez-vous à votre espace vendeur</p>
                    </div>

                    {/* Erreur */}
                    {error && (
                        <div className="bg-red-500/8 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Identifiant */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Email ou Téléphone</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="email@exemple.com ou 0707XXXXXX"
                                    required
                                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Mot de passe */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Mot de passe</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Remember + forgot */}
                        <div className="flex items-center justify-between pt-1">
                            <button type="button" onClick={() => setRememberMe(!rememberMe)}
                                className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-[#00D97E] border-[#00D97E]' : 'bg-transparent border-slate-600'}`}
                            >
                                {rememberMe && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </button>
                            <label onClick={() => setRememberMe(!rememberMe)} className="text-xs text-slate-500 cursor-pointer ml-2 flex-1">Me garder connecté</label>
                            <Link to="/forgot-password" className="text-xs text-[#00D97E] hover:text-[#00D97E]/80 transition-colors">Mot de passe oublié ?</Link>
                        </div>

                        {/* Bouton */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 bg-gradient-to-r from-[#00D97E] to-[#0EA5E9] text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:shadow-lg hover:shadow-[#00D97E]/20 hover:scale-[1.01] active:scale-[0.99] text-sm"
                        >
                            {loading ? 'Connexion...' : 'Accéder au Dashboard'}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-600">
                        Pas de compte ?{' '}
                        <Link to="/signup" className="text-[#00D97E] hover:text-[#00D97E]/80 font-semibold transition-colors">Créer un compte</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
