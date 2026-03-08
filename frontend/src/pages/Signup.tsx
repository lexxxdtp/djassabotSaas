import React, { useState } from 'react';
import { ShoppingBag, ArrowRight, Mail, Lock, Store, Phone, User, Calendar, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
        grecaptcha: {
            reset: (widgetId?: number) => void;
        };
    }
}

const Signup: React.FC = () => {
    const [usePhone, setUsePhone] = useState(false); // Toggle email/téléphone
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

    // Phone OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [countdown, setCountdown] = useState(0);

    // Email OTP State
    const [emailOtpSent, setEmailOtpSent] = useState(false);
    const [emailOtpCode, setEmailOtpCode] = useState('');
    const [emailCountdown, setEmailCountdown] = useState(0);

    const navigate = useNavigate();
    const { login, isAuthenticated } = useAuth();
    const API_URL = getApiUrl();

    // Setup Visible Recaptcha for Firebase (Safari/React 18 Strict Mode Fix)
    React.useEffect(() => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'normal',
            });
            window.recaptchaVerifier.render(); // Explicitly render it
        }

        return () => {
            // Unmount: Clear recaptchaVerifier to avoid "auth/invalid-app-credential" React 18 bug
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
            }
        };
    }, []);

    // Redirect to dashboard if already authenticated
    React.useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, navigate]);

    // Phone OTP Timer effect
    React.useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    // Email OTP Timer effect
    React.useEffect(() => {
        let timer: ReturnType<typeof setTimeout>;
        if (emailCountdown > 0) {
            timer = setTimeout(() => setEmailCountdown(emailCountdown - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [emailCountdown]);

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

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(formData.password)) {
            setError('Le mot de passe doit contenir 8 caractères minimum, une majuscule et un chiffre.');
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
            if (usePhone) {
                if (!otpSent) {
                    // Etape 1 : Obtenir un code OTP via Firebase
                    const finalPhoneFirebase = `+225${formData.phone}`;
                    const appVerifier = window.recaptchaVerifier;
                    const confirmation = await signInWithPhoneNumber(auth, finalPhoneFirebase, appVerifier);
                    setConfirmationResult(confirmation);
                    setOtpSent(true);
                    setCountdown(30); // Start 30s countdown
                    setLoading(false);
                    return; // On arrête ici pour afficher le champ OTP
                } else {
                    // Etape 2 : Vérification du code
                    if (!confirmationResult) throw new Error("Erreur de session OTP");
                    await confirmationResult.confirm(otpCode);

                    const finalPhone = `+225${formData.phone}`;
                    const response = await fetch(`${API_URL}/auth/signup`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            businessName: formData.businessName,
                            email: null,
                            phone: finalPhone,
                            fullName: formData.fullName,
                            birthDate: formData.birthDate,
                            password: formData.password,
                            phoneVerified: true
                        }),
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || "Erreur lors de l'inscription");

                    login(data.token, data.user, data.tenant);
                    navigate('/dashboard');
                    return;
                }
            }

            // --- EMAIL OTP FLOW ---
            if (!emailOtpSent) {
                // Étape 1 : Envoyer le code OTP par email
                const sendRes = await fetch(`${API_URL}/auth/send-email-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email.toLowerCase().trim() }),
                });
                const sendData = await sendRes.json();
                if (!sendRes.ok) throw new Error(sendData.error || "Erreur lors de l'envoi du code");

                setEmailOtpSent(true);
                setEmailCountdown(30);
                setLoading(false);
                return;
            } else {
                // Étape 2 : Vérifier le code OTP
                const verifyRes = await fetch(`${API_URL}/auth/verify-email-otp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: formData.email.toLowerCase().trim(),
                        code: emailOtpCode
                    }),
                });
                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) throw new Error(verifyData.error || 'Code incorrect');

                // Étape 3 : Inscription avec email vérifié
                const response = await fetch(`${API_URL}/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        businessName: formData.businessName,
                        email: formData.email.toLowerCase().trim(),
                        phone: null,
                        fullName: formData.fullName,
                        birthDate: formData.birthDate,
                        password: formData.password,
                        emailVerified: true
                    }),
                });

                const data = await response.json();
                if (!response.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');

                login(data.token, data.user, data.tenant);
                navigate('/dashboard');
            }

        } catch (err: unknown) {
            // Re-initialize recaptcha on error so the user can try again
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                    window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                        'size': 'normal',
                    });
                    window.recaptchaVerifier.render();
                } catch (e) {
                    console.error("Could not reset recaptcha", e);
                }
            }

            if (err instanceof Error) {
                if (err.message.includes('auth/invalid-verification-code')) {
                    setError("Le code de vérification est incorrect.");
                } else if (err.message.includes('auth/code-expired')) {
                    setError("Le code a expiré. Veuillez recommencer.");
                } else {
                    setError(err.message);
                }
            } else {
                setError("Une erreur inconnue est survenue");
            }
        } finally {
            setLoading(false);
        }
    };

    const resendOTP = async () => {
        setError('');
        setLoading(true);
        try {
            const finalPhoneFirebase = `+225${formData.phone}`;
            const appVerifier = window.recaptchaVerifier;
            const confirmation = await signInWithPhoneNumber(auth, finalPhoneFirebase, appVerifier);
            setConfirmationResult(confirmation);
            setCountdown(30);
            setOtpCode('');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Erreur lors du renvoi du code");
            }
        } finally {
            setLoading(false);
        }
    };

    const resendEmailOTP = async () => {
        setError('');
        setLoading(true);
        try {
            const sendRes = await fetch(`${API_URL}/auth/send-email-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email.toLowerCase().trim() }),
            });
            const sendData = await sendRes.json();
            if (!sendRes.ok) throw new Error(sendData.error || "Erreur lors du renvoi");
            setEmailCountdown(30);
            setEmailOtpCode('');
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("Erreur lors du renvoi du code");
            }
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
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Créer un Compte</h1>
                    <p className="text-gray-400">Démarrez votre commerce sur WhatsApp</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Nom du Commerce</label>
                        <div className="relative group">
                            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type="text"
                                name="businessName"
                                value={formData.businessName}
                                onChange={handleChange}
                                placeholder="Ma Super Boutique"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Votre Nom Complet</label>
                        <div className="relative group">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleChange}
                                placeholder="Jean Kouassi"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Date de Naissance</label>
                        <div className="relative group">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type="date"
                                name="birthDate"
                                value={formData.birthDate}
                                onChange={handleChange}
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all [&::-webkit-calendar-picker-indicator]:invert"
                            />
                        </div>
                    </div>

                    {/* Toggle Email/Téléphone */}
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                        <button
                            type="button"
                            onClick={() => { setUsePhone(false); setOtpSent(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${!usePhone
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-gray-500 hover:text-white'
                                }`}
                        >
                            📧 Email
                        </button>
                        <button
                            type="button"
                            onClick={() => setUsePhone(true)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${usePhone
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : 'text-gray-500 hover:text-white'
                                }`}
                        >
                            📱 Téléphone
                        </button>
                    </div>

                    {/* Champ Email OU Téléphone */}
                    {!usePhone ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Email</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="votre@email.com"
                                        required
                                        disabled={emailOtpSent}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                                {emailOtpSent && (
                                    <button type="button" onClick={() => { setEmailOtpSent(false); setEmailOtpCode(''); }} className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Modifier l'email</button>
                                )}
                            </div>

                            {/* Email OTP Field */}
                            {emailOtpSent && (
                                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Code de validation (OTP)</label>
                                    <input
                                        type="text"
                                        name="emailOtpCode"
                                        value={emailOtpCode}
                                        onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="123456"
                                        required
                                        maxLength={6}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-center text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-2xl tracking-[0.5em]"
                                    />
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-green-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Code envoyé ! Vérifiez votre boîte mail.</p>
                                        <button
                                            type="button"
                                            onClick={resendEmailOTP}
                                            disabled={emailCountdown > 0 || loading}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {emailCountdown > 0 ? `Renvoyer le code (${emailCountdown}s)` : 'Renvoyer le code'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Téléphone</label>
                                <div className="relative group">
                                    {/* Préfixe Fixe +225 visualisé à l'intérieur de l'input */}
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10">
                                        <Phone className="text-gray-500 w-5 h-5" />
                                        <span className="text-gray-400 font-bold font-mono text-sm border-r border-gray-600 pr-2">+225</span>
                                    </div>
                                    <input
                                        type="tel"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                        placeholder="0709483812"
                                        required
                                        maxLength={10}
                                        disabled={otpSent}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-[90px] pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-lg tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                </div>
                                {!otpSent ? (
                                    <p className="mt-1 text-xs text-gray-600">Entrez les 10 chiffres de votre numéro</p>
                                ) : (
                                    <button type="button" onClick={() => { setOtpSent(false); setOtpCode(''); }} className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Modifier le numéro</button>
                                )}
                            </div>

                            {/* OTP Field inline */}
                            {otpSent && (
                                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Code de validation (OTP)</label>
                                    <input
                                        type="text"
                                        name="otpCode"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="123456"
                                        required
                                        maxLength={6}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 text-center text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-2xl tracking-[0.5em]"
                                    />
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-xs text-green-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> SMS envoyé ! Vérifiez votre téléphone.</p>
                                        <button
                                            type="button"
                                            onClick={resendOTP}
                                            disabled={countdown > 0 || loading}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {countdown > 0 ? `Renvoyer le code (${countdown}s)` : 'Renvoyer le code'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Mot de Passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                minLength={8}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>

                        {/* Indicateur de force du mot de passe */}
                        <div className="mt-3 space-y-2">
                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex">
                                <div className={`h-full transition-all duration-300 ${formData.password.length === 0 ? 'w-0' :
                                    (() => {
                                        const score = (formData.password.length >= 8 ? 1 : 0) + (/[A-Z]/.test(formData.password) ? 1 : 0) + (/\d/.test(formData.password) ? 1 : 0);
                                        if (score === 1) return 'bg-red-500 w-1/3';
                                        if (score === 2) return 'bg-orange-500 w-2/3';
                                        if (score === 3) return 'bg-green-500 w-full shadow-[0_0_10px_rgba(34,197,94,0.5)]';
                                        return 'bg-red-500 w-1/4';
                                    })()
                                    }`}></div>
                            </div>

                            <div className="grid grid-cols-1 gap-1.5 text-xs text-gray-500 mt-2">
                                <div className={`flex items-center gap-2 transition-colors ${formData.password.length >= 8 ? 'text-green-400' : ''}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${formData.password.length >= 8 ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                                    Minimum 8 caractères
                                </div>
                                <div className={`flex items-center gap-2 transition-colors ${/[A-Z]/.test(formData.password) ? 'text-green-400' : ''}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${/[A-Z]/.test(formData.password) ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                                    Une lettre majuscule
                                </div>
                                <div className={`flex items-center gap-2 transition-colors ${/\d/.test(formData.password) ? 'text-green-400' : ''}`}>
                                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${/\d/.test(formData.password) ? 'bg-green-400' : 'bg-gray-600'}`}></div>
                                    Un chiffre
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Confirmer Mot de Passe</label>
                        <div className="relative group">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-12 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Force recaptcha to be visible when testing phone */}
                    <div id="recaptcha-container" className="my-4 flex justify-center w-full overflow-hidden"></div>

                    <button
                        type="submit"
                        disabled={loading || (usePhone && otpSent && otpCode.length !== 6) || (!usePhone && emailOtpSent && emailOtpCode.length !== 6)}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6 hover:scale-[1.02]"
                    >
                        <span>
                            {loading ? 'Traitement en cours...' : (
                                usePhone ? (
                                    !otpSent ? '1. Recevoir le code par SMS' : '2. Valider et S\'inscrire'
                                ) : (
                                    !emailOtpSent ? '1. Recevoir le code par Email' : '2. Valider et S\'inscrire'
                                )
                            )}
                        </span>
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-gray-500">
                    Déjà un compte ? <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold tracking-wide hover:underline cursor-pointer transition-colors">Se connecter</Link>
                </p>
            </div>
        </div>
    );
};

export default Signup;
