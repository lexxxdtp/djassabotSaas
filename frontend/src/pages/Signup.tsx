import React, { useState } from 'react';
import { ShoppingBag, ArrowRight, Mail, Lock, Store, Phone, User, Calendar } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';

const Signup: React.FC = () => {
    const [usePhone, setUsePhone] = useState(false); // Toggle email/téléphone
    const [formData, setFormData] = useState({
        businessName: '',
        email: '',
        phone: '',
        fullName: '',
        birthDate: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const { login } = useAuth();
    const API_URL = getApiUrl();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Ne garder que les chiffres
        const cleaned = e.target.value.replace(/\D/g, '');
        // Limiter à 10 chiffres max
        const truncated = cleaned.slice(0, 10);
        setFormData({ ...formData, phone: truncated });
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }

        if (!usePhone && !formData.email) {
            setError('Veuillez fournir un email.');
            return;
        }

        if (usePhone && !formData.phone) {
            setError('Veuillez fournir un numéro de téléphone.');
            return;
        }

        // Validation du format téléphone (doit avoir 10 chiffres)
        if (usePhone && formData.phone.length !== 10) {
            setError('Le numéro de téléphone doit contenir 10 chiffres.');
            return;
        }

        setLoading(true);

        try {
            // Formater pour le backend : ajouter +225 automatiquement
            const finalPhone = usePhone ? `+225${formData.phone}` : null;

            const response = await fetch(`${API_URL}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businessName: formData.businessName,
                    email: usePhone ? null : formData.email,
                    phone: finalPhone,
                    fullName: formData.fullName,
                    birthDate: formData.birthDate,
                    password: formData.password
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Erreur lors de l\'inscription');
            }

            // Auto-login after signup
            login(data.token, data.user, data.tenant);
            navigate('/dashboard');

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-zinc-900 p-8 rounded-2xl w-full max-w-md border border-zinc-800 shadow-2xl shadow-orange-500/5">
                <div className="text-center mb-8">
                    <div className="bg-orange-500 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20">
                        <ShoppingBag className="text-black w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Créer un Compte</h1>
                    <p className="text-zinc-500">Démarrez votre commerce sur WhatsApp</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Nom du Commerce</label>
                        <div className="relative group">
                            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors w-5 h-5" />
                            <input
                                type="text"
                                name="businessName"
                                value={formData.businessName}
                                onChange={handleChange}
                                placeholder="Ma Super Boutique"
                                required
                                className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Votre Nom Complet</label>
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors w-5 h-5" />
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Jean Kouassi"
                                required
                                className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Date de Naissance</label>
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors w-5 h-5" />
                            <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                required
                                className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                            />
                        </div>
                    </div>

                    {/* Toggle Email/Téléphone */}
                    <div className="flex gap-2 p-1 bg-black rounded-xl border border-zinc-800">
                        <button
                            type="button"
                            onClick={() => setUsePhone(false)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!usePhone
                                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                                : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            📧 Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setUsePhone(true)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${usePhone
                                ? 'bg-orange-500 text-black shadow-lg shadow-orange-500/20'
                                : 'text-zinc-500 hover:text-white'
                                }`}
                        >
                            📱 Téléphone
                        </button>
                    </div>

                    {/* Champ Email OU Téléphone */}
                    {!usePhone ? (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors w-5 h-5" />
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="votre@email.com"
                                    required
                                    className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Téléphone</label>
                            <div className="relative group">
                                {/* Préfixe Fixe +225 visualisé à l'intérieur de l'input */}
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                                    <Phone className="text-zinc-500 w-5 h-5" />
                                    <span className="text-zinc-400 font-bold font-mono text-sm border-r border-zinc-700 pr-2">+225</span>
                                </div>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handlePhoneChange}
                                    placeholder="0709483812"
                                    required
                                    maxLength={10}
                                    className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-[90px] pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all font-mono text-lg tracking-wide"
                                />
                            </div>
                            <p className="mt-1 text-xs text-zinc-600">Entrez les 10 chiffres de votre numéro</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Mot de Passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors w-5 h-5" />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                        </div>
                        <p className="mt-1 text-xs text-zinc-600">Minimum 8 caractères</p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Confirmer Mot de Passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-500 transition-colors w-5 h-5" />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                className="w-full bg-black border border-zinc-700/50 rounded-xl py-3 pl-10 pr-4 text-white placeholder-zinc-700 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
                    >
                        <span>{loading ? 'Création en cours...' : 'S\'inscrire'}</span>
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-zinc-500">
                    Déjà un compte ? <Link to="/login" className="text-orange-500 hover:text-orange-400 font-bold tracking-wide hover:underline cursor-pointer transition-colors">Se connecter</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
