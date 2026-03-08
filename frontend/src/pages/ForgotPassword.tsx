import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowRight, Mail, Phone, Lock } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiUrl } from '../utils/apiConfig';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

const ForgotPassword: React.FC = () => {
    const [usePhone, setUsePhone] = useState(false);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    // OTP States
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [countdown, setCountdown] = useState(0);

    const API_URL = getApiUrl();
    const navigate = useNavigate();

    // Timer for OTP
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Setup Invisible Recaptcha for Firebase (React 18 Strict Mode Fix)
    useEffect(() => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
            });
        }
        return () => {
            if (window.recaptchaVerifier) {
                window.recaptchaVerifier.clear();
                window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
            }
        };
    }, []);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (usePhone) {
                if (phone.length !== 10) {
                    setError('Le numéro de téléphone doit contenir 10 chiffres.');
                    setLoading(false);
                    return;
                }

                if (!otpSent) {
                    // Send OTP
                    const finalPhoneFirebase = `+225${phone}`;
                    const appVerifier = window.recaptchaVerifier;

                    if (!appVerifier) {
                        throw new Error("Recaptcha non initialisé, rfechargez la page.");
                    }

                    const confirmation = await signInWithPhoneNumber(auth, finalPhoneFirebase, appVerifier);
                    setConfirmationResult(confirmation);
                    setOtpSent(true);
                    setCountdown(30);
                    setLoading(false);
                    return;
                } else {
                    // Verify OTP
                    if (!confirmationResult) throw new Error("Erreur de session OTP");
                    await confirmationResult.confirm(otpCode);

                    // Ask backend for a DB reset token
                    const finalPhone = `+225${phone}`;
                    const response = await fetch(`${API_URL}/auth/verify-phone-reset`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: finalPhone }),
                    });

                    const data = await response.json();
                    if (!response.ok) {
                        throw new Error(data.error || 'Erreur lors de la réinitialisation');
                    }

                    // Redirect to reset password with the backend token
                    navigate(`/reset-password?token=${data.token}`);
                    return;
                }
            } else {
                // Email Flow
                const response = await fetch(`${API_URL}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: email.toLowerCase().trim()
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Erreur lors de la demande de réinitialisation');
                }

                setSuccess('Si votre adresse e-mail existe dans notre système, vous recevrez bientôt un lien de réinitialisation de mot de passe.');
                setEmail('');
            }

        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError(String(err) || "Une erreur inconnue est survenue");
            }
            if (otpSent && usePhone) {
                setOtpCode(''); // clear input on error
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
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Mot de Passe Oublié</h1>
                    <p className="text-gray-400">Réinitialisez votre mot de passe pour retrouver l'accès à votre compte.</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-500/10 border border-green-500/50 text-green-500 p-4 rounded-lg mb-6 text-sm flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5"></div>
                        <p>{success}</p>
                    </div>
                )}

                <form onSubmit={handleResetRequest} className="space-y-6">
                    <div id="recaptcha-container"></div>

                    {!otpSent && (
                        <div className="flex bg-white/5 p-1 rounded-xl mb-6 border border-white/5">
                            <button
                                type="button"
                                onClick={() => { setUsePhone(false); setError(''); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${!usePhone ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Mail className="w-4 h-4" /> Email
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUsePhone(true); setError(''); }}
                                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 ${usePhone ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                            >
                                <Phone className="w-4 h-4" /> Téléphone
                            </button>
                        </div>
                    )}

                    {!usePhone && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="email@exemple.com"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {usePhone && !otpSent && (
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Téléphone</label>
                            <div className="relative group">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 text-gray-400 border-r border-white/10 pr-2 pb-1">
                                    <Phone className="w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
                                    <span className="text-sm font-medium group-focus-within:text-white">+225</span>
                                </div>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="0700000000"
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-24 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono tracking-wider"
                                />
                            </div>
                        </div>
                    )}

                    {otpSent && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Code de validation (OTP)</label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
                                    <input
                                        type="text"
                                        value={otpCode}
                                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                        placeholder="123456"
                                        required
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-center text-xl font-mono tracking-[0.5em]"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <button
                                    type="button"
                                    onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); }}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    Modifier le numéro
                                </button>
                                {countdown > 0 ? (
                                    <span className="text-gray-500">Renvoyer dans {countdown}s</span>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setError('');
                                            setLoading(true);
                                            try {
                                                const finalPhoneFirebase = `+225${phone}`;
                                                const appVerifier = window.recaptchaVerifier;
                                                if (!appVerifier) throw new Error("Recaptcha non initialisé");
                                                const confirmation = await signInWithPhoneNumber(auth, finalPhoneFirebase, appVerifier);
                                                setConfirmationResult(confirmation);
                                                setCountdown(30);
                                            } catch (err: unknown) {
                                                if (err instanceof Error) {
                                                    setError(err.message || 'Erreur lors du renvoi du code');
                                                }
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
                                    >
                                        Renvoyer le code
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !!success || (usePhone && otpSent && otpCode.length < 6)}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]"
                    >
                        <span>
                            {loading && !otpSent ? 'Envoi...' :
                                loading && otpSent ? 'Vérification...' :
                                    usePhone && !otpSent ? 'Recevoir le SMS' :
                                        usePhone && otpSent ? 'Vérifier le code' :
                                            'Envoyer le lien'}
                        </span>
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-gray-500">
                    <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-bold tracking-wide hover:underline cursor-pointer transition-colors">
                        ← Retour à la connexion
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPassword;
