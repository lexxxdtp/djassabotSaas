import React, { useState, useEffect } from 'react';
import { ArrowRight, Mail, Lock } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth, type User, type Tenant } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import { usePageTitle } from '../hooks/usePageTitle';

const Login: React.FC = () => {
    usePageTitle('Connexion');
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

            let data: Partial<{ error: string; token: string; user: User; tenant: Tenant }> = {};
            try {
                data = await response.json();
            } catch {
                throw new Error('Erreur de communication avec le serveur (réponse invalide).');
            }
            if (!response.ok) throw new Error(data.error || 'Identifiants invalides');

            if (!data.token || !data.user || !data.tenant) throw new Error('Réponse incomplète du serveur.');
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
        <div className="auth-form-page auth-login">
            <p className="app-eyebrow">Heureux de vous retrouver</p>
            <h1>On reprend ?</h1>
            <p className="auth-intro">Connectez-vous pour retrouver votre boutique.</p>
                    {/* Erreur */}
                    {error && (
                        <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl mb-5 text-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                        {/* Identifiant */}
                        <div>
                            <label htmlFor="login-identifier" className="block text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest mb-2">Email ou Téléphone</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] w-4 h-4" />
                                <input
                                    id="login-identifier" autoComplete="username" type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="email@exemple.com ou 0707XXXXXX"
                                    required
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Mot de passe */}
                        <div>
                            <label htmlFor="login-password" className="block text-xs font-bold text-[var(--color-muted)] uppercase tracking-widest mb-2">Mot de passe</label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] w-4 h-4" />
                                <input
                                    id="login-password" autoComplete="current-password" type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all text-sm"
                                />
                            </div>
                        </div>

                        {/* Remember + forgot */}
                        <div className="flex items-center justify-between pt-1 gap-3">
                            {/* La case seule mesurait 16x16 : intappable sur téléphone, sans nom
                                accessible, et son texte n'était relié que par un onClick. Case et
                                texte ne font plus qu'une cible, annoncée correctement. */}
                            <button
                                type="button"
                                role="checkbox"
                                aria-checked={rememberMe}
                                onClick={() => setRememberMe(!rememberMe)}
                                className="flex items-center gap-2 py-2.5 -my-2.5 text-xs text-[var(--color-muted)] hover:text-white transition-colors cursor-pointer"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-all ${rememberMe ? 'bg-[#00D97E] border-[#00D97E]' : 'bg-transparent border-[#333]'}`}
                                >
                                    {rememberMe && <svg className="w-2.5 h-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </span>
                                Me garder connecté
                            </button>
                            <Link to="/forgot-password" className="text-xs text-[#00D97E] hover:text-white transition-colors font-medium py-2.5 -my-2.5">Mot de passe oublié ?</Link>
                        </div>

                        {/* Bouton */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-3 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99] text-sm"
                        >
                            {loading ? 'Connexion...' : 'Ouvrir ma boutique'}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
                        Pas de compte ?{' '}
                        <Link to="/signup" className="text-[#00D97E] hover:text-white font-bold transition-colors inline-block py-2 -my-2">Créer un compte</Link>
                    </p>
        </div>
    );
};

export default Login;
