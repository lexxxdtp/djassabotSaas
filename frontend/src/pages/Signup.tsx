import React, { useState, useEffect } from 'react';
import {
    ShoppingBag, ArrowRight, ArrowLeft, Mail, Lock, Store, Phone, User,
    Eye, EyeOff, Sparkles
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';

// Visual business categories tailored for African commerce
const BUSINESS_TYPES = [
    { id: 'fashion', label: 'Mode', emoji: '👗' },
    { id: 'beauty', label: 'Mèches / Beauté', emoji: '💇' },
    { id: 'food', label: 'Restauration', emoji: '🍔' },
    { id: 'shoes', label: 'Chaussures', emoji: '👟' },
    { id: 'electronics', label: 'Électronique', emoji: '📱' },
    { id: 'grocery', label: 'Boutique', emoji: '🛒' },
    { id: 'jewelry', label: 'Bijoux', emoji: '💍' },
    { id: 'other', label: 'Autre', emoji: '✨' },
];

// Year-of-birth options (legal: must be 18+)
const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE = 18;
const MAX_AGE = 80;
const BIRTH_YEARS = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => CURRENT_YEAR - MIN_AGE - i);

const Signup: React.FC = () => {
    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // === Step 1: Personal Info ===
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');

    // === Step 2: Business Info ===
    const [businessName, setBusinessName] = useState('');
    const [businessType, setBusinessType] = useState('');
    const [birthYear, setBirthYear] = useState<string>('');

    // === Step 3: Password ===
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) navigate('/dashboard', { replace: true });
    }, [isAuthenticated, navigate]);

    // ===================================================================
    // Final submit (step 3)
    // ===================================================================
    const submitSignup = async () => {
        if (password !== confirmPassword) {
            setError('Les mots de passe ne correspondent pas.');
            return;
        }
        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            setError('Mot de passe : 8 caractères min, 1 majuscule, 1 chiffre.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const body = {
                businessName,
                businessType,
                fullName,
                birthDate: birthYear ? `${birthYear}-01-01` : null,
                password,
                email: email.trim() ? email.toLowerCase().trim() : undefined,
                phone: `+225${phone}`
            };

            const res = await apiClient('/auth/signup', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur inscription.');
            
            // Log in the user (they will be redirected to /verify-account by ProtectedRoute)
            login(data.token, data.user, data.tenant);
            navigate('/verify-account');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur inconnue.');
        } finally {
            setLoading(false);
        }
    };

    // ===================================================================
    // Navigation between steps
    // ===================================================================
    const goNext = () => {
        setError('');
        if (step === 1) {
            if (!fullName.trim()) return setError('Votre nom complet est requis.');
            if (phone.length !== 10) return setError('Le numéro WhatsApp doit contenir 10 chiffres.');
            if (email.trim() && !email.includes('@')) return setError('Adresse e-mail invalide.');
            setStep(2);
        } else if (step === 2) {
            if (!businessName.trim()) return setError('Nom du commerce requis.');
            if (!businessType) return setError('Sélectionnez votre type d\'activité.');
            if (!birthYear) return setError('Sélectionnez votre année de naissance.');
            setStep(3);
        }
    };
    const goBack = () => { setError(''); if (step > 1) setStep((step - 1) as 1 | 2 | 3); };

    // ===================================================================
    // Rendering
    // ===================================================================
    const passwordScore = (password.length >= 8 ? 1 : 0)
        + (/[A-Z]/.test(password) ? 1 : 0)
        + (/\d/.test(password) ? 1 : 0);

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-[#111] border border-[#1a1a1a] p-8 rounded-3xl w-full max-w-md shadow-2xl shadow-[#00D97E]/5 backdrop-blur-sm">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#00D97E] flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Créer votre Commerce IA</h1>
                    <p className="text-[#888] text-sm">Étape {step} sur 3</p>
                </div>

                {/* Progress bar */}
                <div className="flex gap-2 mb-6">
                    {[1, 2, 3].map(n => (
                        <div key={n} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${step >= n ? 'bg-[#00D97E]' : 'bg-white/10'}`} />
                    ))}
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                        {error.includes('déjà inscrit') && (
                            <div className="mt-2 ml-3.5 flex gap-3 text-xs">
                                <Link to="/login" className="text-[#00D97E] hover:text-[#00D97E]/80 underline underline-offset-2">
                                    Se connecter
                                </Link>
                                <Link to="/forgot-password" className="text-[#00D97E] hover:text-[#00D97E]/80 underline underline-offset-2">
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {/* =================== STEP 1: PERSONAL INFO =================== */}
                {step === 1 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-white font-bold text-lg">Vos informations personnelles</h2>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Nom complet</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] w-5 h-5" />
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    placeholder="Jean Kouassi"
                                    className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Votre numéro WhatsApp</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                                    <Phone className="text-[#888] w-5 h-5" />
                                    <span className="text-[#888] font-bold font-mono text-sm border-r border-gray-600 pr-2">+225</span>
                                </div>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="0709483812"
                                    className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 pl-[90px] pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all font-mono text-lg"
                                />
                            </div>
                            <p className="mt-1 text-xs text-[#555]">10 chiffres — c'est le numéro qui sera lié à votre bot</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">
                                Votre adresse e-mail <span className="normal-case font-normal text-[#555]">(optionnel)</span>
                            </label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="votre@email.com"
                                    className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all"
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={goNext}
                            className="w-full mt-2 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            Continuer <ArrowRight className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* =================== STEP 2: BUSINESS INFO =================== */}
                {step === 2 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-white font-bold text-lg">Votre boutique</h2>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Nom du commerce</label>
                            <div className="relative">
                                <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] w-5 h-5" />
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={e => setBusinessName(e.target.value)}
                                    placeholder="Ma Super Boutique"
                                    className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Vous vendez quoi ?</label>
                            <div className="grid grid-cols-4 gap-2">
                                {BUSINESS_TYPES.map(bt => (
                                    <button
                                        key={bt.id}
                                        type="button"
                                        onClick={() => setBusinessType(bt.id)}
                                        className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${businessType === bt.id ? 'bg-[#00D97E]/15 border-[#00D97E] ring-1 ring-[#00D97E]' : 'bg-[#111] border-[#1a1a1a] hover:border-[#333]'}`}
                                    >
                                        <span className="text-2xl">{bt.emoji}</span>
                                        <span className={`text-[10px] leading-tight text-center ${businessType === bt.id ? 'text-white' : 'text-[#888]'}`}>{bt.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Année de naissance</label>
                            <select
                                value={birthYear}
                                onChange={e => setBirthYear(e.target.value)}
                                className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all"
                            >
                                <option value="" disabled className="bg-black">Sélectionnez une année</option>
                                {BIRTH_YEARS.map(y => (
                                    <option key={y} value={y} className="bg-black">{y}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-[#555]">Vous devez avoir au moins 18 ans</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={goBack}
                                className="px-5 bg-white/5 border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center gap-2"
                            ><ArrowLeft className="w-4 h-4" /> Retour</button>
                            <button
                                type="button"
                                onClick={goNext}
                                className="flex-1 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
                            >Continuer <ArrowRight className="w-5 h-5" /></button>
                        </div>
                    </div>
                )}

                {/* =================== STEP 3: PASSWORD =================== */}
                {step === 3 && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-white font-bold text-lg">Sécurisez votre compte</h2>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Mot de passe</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] w-5 h-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-12 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
                                >{showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                            </div>

                            <div className="mt-3 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className={`h-full transition-all duration-300 ${passwordScore === 0 ? 'w-0' : passwordScore === 1 ? 'bg-red-500 w-1/3' : passwordScore === 2 ? 'bg-orange-500 w-2/3' : 'bg-green-500 w-full shadow-[0_0_10px_rgba(34,197,94,0.5)]'}`} />
                            </div>
                            <div className="grid grid-cols-1 gap-1 text-xs text-[#888] mt-2">
                                <div className={`flex items-center gap-2 ${password.length >= 8 ? 'text-green-400' : ''}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${password.length >= 8 ? 'bg-green-400' : 'bg-[#444]'}`} /> 8 caractères min
                                </div>
                                <div className={`flex items-center gap-2 ${/[A-Z]/.test(password) ? 'text-green-400' : ''}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${/[A-Z]/.test(password) ? 'bg-green-400' : 'bg-[#444]'}`} /> 1 majuscule
                                </div>
                                <div className={`flex items-center gap-2 ${/\d/.test(password) ? 'text-green-400' : ''}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${/\d/.test(password) ? 'bg-green-400' : 'bg-[#444]'}`} /> 1 chiffre
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Confirmer</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888] w-5 h-5" />
                                <input
                                    type={showConfirmPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-3 pl-10 pr-12 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 focus:ring-1 focus:ring-[#00D97E]/30 transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#888] hover:text-white"
                                >{showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}</button>
                            </div>
                        </div>

                        {/* Preview: what happens next */}
                        <div className="bg-[#00D97E]/8 border border-[#00D97E]/20 rounded-xl p-4 text-xs text-[#888]">
                            <p className="font-bold flex items-center gap-1 mb-2 text-[#00D97E]">
                                <Sparkles className="w-3.5 h-3.5" /> Après votre inscription :
                            </p>
                            <ol className="space-y-1 list-decimal list-inside text-[#888]">
                                <li>Connectez votre WhatsApp (30 secondes)</li>
                                <li>Ajoutez vos produits avec prix et stock</li>
                                <li>Le bot vend pour vous 24h/24 🚀</li>
                            </ol>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={goBack}
                                disabled={loading}
                                className="px-5 bg-white/5 border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white font-bold py-3.5 rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
                            ><ArrowLeft className="w-4 h-4" /> Retour</button>
                            <button
                                type="button"
                                onClick={submitSignup}
                                disabled={loading || passwordScore < 3 || !confirmPassword}
                                className="flex-1 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {loading ? 'Création...' : 'Créer mon compte'}
                                {!loading && <ArrowRight className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                )}

                <p className="mt-6 text-center text-sm text-[#888]">
                    Déjà un compte ? <Link to="/login" className="text-[#00D97E] hover:text-[#00D97E]/80 font-bold tracking-wide hover:underline">Se connecter</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
