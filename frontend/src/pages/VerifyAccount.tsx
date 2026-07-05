import React, { useState, useEffect } from 'react';
import { ShoppingBag, ArrowRight, Mail, Phone, Sparkles, Check, Edit2, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import { auth } from '../firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { toast } from 'react-hot-toast';

const VerifyAccount: React.FC = () => {
    const { user, refreshUser, logout } = useAuth();
    const navigate = useNavigate();

    // Verification method: 'email' or 'phone'
    const [method, setMethod] = useState<'email' | 'phone'>(() => {
        return user?.email ? 'email' : 'phone';
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    // Edit states
    const [isEditing, setIsEditing] = useState(false);
    const [editEmail, setEditEmail] = useState(user?.email || '');
    const [editPhone, setEditPhone] = useState(user?.phone?.replace('+225', '') || '');

    // OTP states
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
    const [countdown, setCountdown] = useState(0);

    // Countdown timer
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // Recaptcha initialization
    useEffect(() => {
        if (!auth || method !== 'phone') return;
        if (!window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                    size: 'invisible',
                });
            } catch (err) {
                console.error("Recaptcha init failed:", err);
            }
        }
        return () => {
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                } catch { /* déjà nettoyé / non monté */ }
                window.recaptchaVerifier = undefined as unknown as RecaptchaVerifier;
            }
        };
    }, [method]);

    // Update form when user context updates
    useEffect(() => {
        if (user) {
            setEditEmail(user.email || '');
            setEditPhone(user.phone?.replace('+225', '') || '');
            if (user.emailVerified || user.phoneVerified) {
                navigate('/onboarding', { replace: true });
            }
        }
    }, [user, navigate]);

    // ===================================================================
    // Edit Profile Info
    // ===================================================================
    const handleUpdateProfile = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            const body: Record<string, string> = {};
            if (method === 'email') {
                if (!editEmail.includes('@')) throw new Error('Veuillez entrer une adresse e-mail valide.');
                body.email = editEmail.toLowerCase().trim();
            } else {
                if (editPhone.length !== 10) throw new Error('Le numéro WhatsApp doit contenir 10 chiffres.');
                body.phone = `+225${editPhone}`;
            }

            const res = await apiClient('/auth/me', {
                method: 'PUT',
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Erreur lors de la mise à jour.');

            await refreshUser();
            setIsEditing(false);
            setOtpSent(false);
            setOtpCode('');
            toast.success('Informations mises à jour.');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
        } finally {
            setLoading(false);
        }
    };

    // ===================================================================
    // OTP Sending Actions
    // ===================================================================
    const sendOTP = async () => {
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (method === 'email') {
                const targetEmail = user?.email || editEmail;
                if (!targetEmail) throw new Error('Aucune adresse e-mail disponible.');

                const res = await apiClient('/auth/send-email-otp', {
                    method: 'POST',
                    body: JSON.stringify({ email: targetEmail.toLowerCase().trim() })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Impossible d'envoyer l'email.");

                setOtpSent(true);
                setCountdown(30);
                setSuccess('Code envoyé avec succès par e-mail.');
            } else {
                const rawPhone = user?.phone || `+225${editPhone}`;
                if (!rawPhone || rawPhone.length < 5) throw new Error('Aucun numéro disponible.');

                if (!auth) {
                    throw new Error("L'envoi de SMS n'est pas configuré. Veuillez utiliser la validation par e-mail.");
                }

                const appVerifier = window.recaptchaVerifier;
                if (!appVerifier) throw new Error('Protection Recaptcha en cours de chargement. Veuillez réessayer.');

                const confirmation = await signInWithPhoneNumber(auth, rawPhone, appVerifier);
                setConfirmationResult(confirmation);
                setOtpSent(true);
                setCountdown(30);
                setSuccess('SMS de validation envoyé.');
            }
        } catch (err) {
            console.error('OTP Send error:', err);
            setError(err instanceof Error ? err.message : "Une erreur s'est produite lors de l'envoi.");
        } finally {
            setLoading(false);
        }
    };

    // ===================================================================
    // OTP Verification Actions
    // ===================================================================
    const verifyOTP = async () => {
        if (otpCode.length !== 6) {
            setError('Code à 6 chiffres requis.');
            return;
        }

        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (method === 'email') {
                const targetEmail = user?.email || editEmail;
                const res = await apiClient('/auth/verify-email-otp', {
                    method: 'POST',
                    body: JSON.stringify({
                        email: targetEmail.toLowerCase().trim(),
                        code: otpCode
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Code invalide.');

                toast.success('E-mail vérifié avec succès !');
                await refreshUser();
                navigate('/onboarding');
            } else {
                if (!confirmationResult) throw new Error('Session OTP expirée. Renvoyez le code.');
                const credential = await confirmationResult.confirm(otpCode);
                const phoneIdToken = await credential.user.getIdToken();

                const targetPhone = user?.phone || `+225${editPhone}`;
                const res = await apiClient('/auth/verify-phone-otp', {
                    method: 'POST',
                    body: JSON.stringify({
                        phone: targetPhone,
                        phoneIdToken
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Vérification échouée.');

                toast.success('Téléphone vérifié avec succès !');
                await refreshUser();
                navigate('/onboarding');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Code incorrect ou expiré.');
        } finally {
            setLoading(false);
        }
    };

    const currentTarget = method === 'email' ? user?.email : user?.phone;

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-[#111] border border-[#1a1a1a] p-8 rounded-3xl w-full max-w-md shadow-2xl shadow-[#00D97E]/5 backdrop-blur-sm">
                
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center mx-auto mb-4">
                        <ShoppingBag className="text-[#00D97E] w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Vérifiez votre Compte</h1>
                    <p className="text-[#888] text-sm">Étape requise avant de configurer votre bot IA</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {success && (
                    <div className="bg-[#00D97E]/10 border border-[#00D97E]/30 text-green-400 p-3 rounded-lg mb-4 text-sm flex items-start gap-2 animate-in fade-in duration-300">
                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#00D97E]" />
                        <span>{success}</span>
                    </div>
                )}

                {/* Tabs */}
                {!otpSent && !isEditing && (
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-[#1a1a1a] mb-6">
                        <button
                            type="button"
                            onClick={() => { setMethod('email'); setError(''); setSuccess(''); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${method === 'email' ? 'bg-[#00D97E] text-black shadow-lg shadow-[#00D97E]/20' : 'text-[#888] hover:text-white'}`}
                        >
                            <Mail className="w-4 h-4" /> E-mail
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMethod('phone'); setError(''); setSuccess(''); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${method === 'phone' ? 'bg-[#00D97E] text-black shadow-lg shadow-[#00D97E]/20' : 'text-[#888] hover:text-white'}`}
                        >
                            <Phone className="w-4 h-4" /> Téléphone
                        </button>
                    </div>
                )}

                {/* Recaptcha element container */}
                <div id="recaptcha-container" className="mb-2" />

                {/* View Current Value / Edit Forms */}
                {isEditing ? (
                    <div className="space-y-4 mb-6 p-4 bg-white/5 rounded-2xl border border-[#1a1a1a] animate-in slide-in-from-top-2 duration-300">
                        <h3 className="text-white font-bold text-sm">Modifier vos coordonnées</h3>
                        
                        {method === 'email' ? (
                            <div>
                                <label className="block text-xs text-[#888] mb-1">Nouvel e-mail</label>
                                <input
                                    type="email"
                                    value={editEmail}
                                    onChange={e => setEditEmail(e.target.value)}
                                    placeholder="exemple@mail.com"
                                    className="w-full bg-black border border-[#1a1a1a] rounded-xl py-2 px-3 text-white focus:outline-none focus:border-[#00D97E]/50"
                                />
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs text-[#888] mb-1">Nouveau WhatsApp (+225)</label>
                                <input
                                    type="tel"
                                    value={editPhone}
                                    onChange={e => setEditPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                    placeholder="0700000000"
                                    className="w-full bg-black border border-[#1a1a1a] rounded-xl py-2 px-3 text-white font-mono focus:outline-none focus:border-[#00D97E]/50"
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-2 bg-white/5 border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white rounded-lg text-xs font-bold transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleUpdateProfile}
                                disabled={loading}
                                className="flex-1 py-2 bg-[#00D97E] hover:bg-[#00D97E]/90 text-black rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1"
                            >
                                <CheckSquare className="w-3.5 h-3.5" /> Enregistrer
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="mb-6">
                        {!otpSent && (
                            <div className="bg-white/5 p-4 rounded-2xl border border-[#1a1a1a] flex justify-between items-center">
                                <div>
                                    <span className="block text-xs text-[#888] uppercase tracking-wider font-bold">
                                        {method === 'email' ? 'Adresse E-mail' : 'Numéro WhatsApp'}
                                    </span>
                                    <span className="text-white text-base font-semibold font-mono tracking-wide">
                                        {currentTarget || (method === 'email' ? 'Non renseigné' : 'Non renseigné')}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditEmail(user?.email || '');
                                        setEditPhone(user?.phone?.replace('+225', '') || '');
                                        setIsEditing(true);
                                    }}
                                    className="p-2 text-[#00D97E] hover:bg-white/5 rounded-xl border border-[#1a1a1a] transition-all"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* OTP Sending / Verifying Controls */}
                {!otpSent ? (
                    <button
                        type="button"
                        onClick={sendOTP}
                        disabled={loading || isEditing || !currentTarget}
                        className="w-full bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? 'Envoi du code...' : 'Recevoir le code'}
                        {!loading && <ArrowRight className="w-5 h-5" />}
                    </button>
                ) : (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Code de validation</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="123456"
                                maxLength={6}
                                className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl py-4 px-4 text-center text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/50 transition-all font-mono text-2xl tracking-[0.5em]"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => { setOtpSent(false); setOtpCode(''); setError(''); setSuccess(''); }}
                                className="text-xs text-[#888] hover:text-white transition-colors"
                            >
                                Retour
                            </button>
                            <button
                                type="button"
                                onClick={sendOTP}
                                disabled={countdown > 0 || loading}
                                className="text-xs text-[#00D97E] hover:text-[#00D97E]/80 disabled:opacity-50 font-bold"
                            >
                                {countdown > 0 ? `Renvoyer (${countdown}s)` : 'Renvoyer le code'}
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={verifyOTP}
                            disabled={loading || otpCode.length !== 6}
                            className="w-full bg-[#00D97E] hover:bg-[#00D97E]/90 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? 'Validation en cours...' : 'Valider le code'}
                            {!loading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </div>
                )}

                {/* Helpful guides and fallbacks */}
                {method === 'phone' && !otpSent && (
                    <div className="bg-[#00D97E]/5 border border-[#00D97E]/10 rounded-2xl p-4 text-xs text-[#888] mt-6 animate-in fade-in duration-500">
                        <p className="font-bold flex items-center gap-1 mb-1.5 text-[#00D97E]">
                            <Sparkles className="w-3.5 h-3.5" /> SMS indisponible ou bloqué ?
                        </p>
                        <p>
                            Si le SMS n'arrive pas, basculez sur l'onglet **E-mail** ci-dessus. C'est instantané et extrêmement fiable.
                        </p>
                    </div>
                )}

                {/* Filet de sécurité phase de test : permet de continuer sans code si
                    l'envoi d'email/SMS n'est pas encore fiable pour tous les comptes.
                    TODO: retirer ce bouton une fois Resend + Firebase pleinement opérationnels. */}
                <button
                    type="button"
                    onClick={() => {
                        localStorage.setItem('verificationSkipped', 'true');
                        navigate('/onboarding');
                    }}
                    className="w-full mt-4 py-3 bg-white/5 hover:bg-[#1a1a1a] border border-[#1a1a1a] text-[#888] hover:text-white rounded-xl text-sm font-semibold transition-all"
                >
                    Vérifier plus tard
                </button>

                {/* Logout link */}
                <p className="mt-6 text-center text-sm text-[#888]">
                    <button
                        onClick={logout}
                        className="text-[#888] hover:text-white underline underline-offset-4 cursor-pointer transition-colors"
                    >
                        Se déconnecter du compte
                    </button>
                </p>

            </div>
        </div>
    );
};

export default VerifyAccount;
