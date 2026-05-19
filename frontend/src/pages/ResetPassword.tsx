import React, { useState, useEffect } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getApiUrl } from '../utils/apiConfig';

const ResetPassword: React.FC = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();
    const API_URL = getApiUrl();

    useEffect(() => {
        if (!token) {
            setError('Lien de réinitialisation invalide ou manquant.');
        }
    }, [token]);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            setError('Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch(`${API_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de la réinitialisation');
            }

            setSuccess('Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.');
            setTimeout(() => {
                navigate('/login');
            }, 3000);

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(String(err) || "Une erreur inconnue est survenue");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#020B18] flex items-center justify-center p-4">
            <div className="bg-[#0D1117] border border-white/5 p-8 rounded-2xl w-full max-w-md shadow-2xl shadow-black/50">
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-xl bg-[#00D97E] flex items-center justify-center mx-auto mb-4">
                        <Lock className="text-black w-7 h-7" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">Nouveau Mot de Passe</h1>
                    <p className="text-zinc-500 text-sm">Veuillez entrer votre nouveau mot de passe</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></div>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-[#00D97E]/10 border border-[#00D97E]/20 text-[#00D97E] p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00D97E] mt-1.5 shrink-0"></div>
                        <p>{success} Redirection en cours...</p>
                    </div>
                )}

                <form onSubmit={handleResetPassword} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Nouveau mot de passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#00D97E] transition-colors w-5 h-5" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={!token || !!success}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all disabled:opacity-50"
                            />
                        </div>
                        <p className="text-xs text-zinc-500 mt-2">8 caractères min, 1 majuscule, 1 chiffre</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Confirmer le mot de passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-[#00D97E] transition-colors w-5 h-5" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                disabled={!token || !!success}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-600 focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all disabled:opacity-50"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !token || !!success}
                        className="w-full bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                    >
                        <span>{loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}</span>
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-zinc-500">
                    <Link to="/login" className="text-[#00D97E] hover:text-[#00D97E]/80 font-bold tracking-wide hover:underline cursor-pointer transition-colors">
                        ← Retour à la connexion
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default ResetPassword;
