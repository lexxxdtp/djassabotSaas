import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowRight, Mail, Lock } from 'lucide-react';
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
        <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
            <div className="bg-[#0a0c10] border border-white/5 p-8 rounded-3xl w-full max-w-md shadow-2xl shadow-indigo-500/10 backdrop-blur-xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/20">
                        <ShoppingBag className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Espace Vendeur</h1>
                    <p className="text-gray-400">Gérez votre bot WhatsApp Commerce</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Email ou Téléphone</label>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder="email@exemple.com ou 0707XXXXXX"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>

                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Mot de Passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* Remember Me Checkbox */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setRememberMe(!rememberMe)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${rememberMe
                                ? 'bg-indigo-500 border-indigo-500'
                                : 'bg-transparent border-gray-600 hover:border-gray-500'
                                }`}
                        >
                            {rememberMe && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                        <label
                            onClick={() => setRememberMe(!rememberMe)}
                            className="text-sm text-gray-400 cursor-pointer select-none hover:text-gray-300 transition-colors"
                        >
                            Me garder connecté
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                    >
                        <span>{loading ? 'Connexion en cours...' : 'Accéder au Dashboard'}</span>
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-gray-500">
                    Pas de compte ? <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-bold tracking-wide hover:underline cursor-pointer transition-colors">Créer un compte</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
