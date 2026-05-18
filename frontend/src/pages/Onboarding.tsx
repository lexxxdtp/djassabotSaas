import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import {
    Sparkles, ArrowRight, ArrowLeft, Smartphone, Keyboard, Check,
    Package, MessageCircle, RefreshCw, PartyPopper, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';

type Step = 'welcome' | 'whatsapp' | 'product' | 'personality' | 'done';

// Bot personality presets — each maps to settings.persona
const PERSONALITIES = [
    {
        id: 'friendly',
        emoji: '😊',
        title: 'Sympa & chaleureux',
        desc: 'Le bot parle comme un ami proche, accueillant et patient',
    },
    {
        id: 'ivoirien',
        emoji: '🇨🇮',
        title: 'Authentique ivoirien',
        desc: 'Le bot mélange français + Nouchi pour un contact local',
    },
    {
        id: 'commercial',
        emoji: '💼',
        title: 'Commercial & efficace',
        desc: 'Le bot va droit au but, pousse à la vente, crée l\'urgence',
    },
];

const Onboarding: React.FC = () => {
    const navigate = useNavigate();
    const { token, isAuthenticated, isLoading } = useAuth();
    const API_URL = getApiUrl();

    const [step, setStep] = useState<Step>('welcome');
    const [error, setError] = useState('');

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!isLoading && !isAuthenticated) navigate('/login', { replace: true });
    }, [isAuthenticated, isLoading, navigate]);

    // ============== WhatsApp connect state ==============
    const [waMethod, setWaMethod] = useState<'pairing' | 'qr'>('pairing');
    const [waPhone, setWaPhone] = useState('');
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [waConnected, setWaConnected] = useState(false);
    const [requestingCode, setRequestingCode] = useState(false);

    // Poll for WhatsApp status when on the WhatsApp step
    useEffect(() => {
        if (step !== 'whatsapp' || !token) return;
        let active = true;
        const poll = async () => {
            try {
                const res = await fetch(`${API_URL}/whatsapp/status`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!active || !res.ok) return;
                const data = await res.json();
                if (data.status === 'connected') {
                    setWaConnected(true);
                } else if (waMethod === 'qr' && data.qrCode) {
                    setQrCode(data.qrCode);
                }
            } catch {/* noop */ }
        };
        poll();
        const interval = setInterval(poll, 3000);
        return () => { active = false; clearInterval(interval); };
    }, [step, token, waMethod, API_URL]);

    const requestPairingCode = async () => {
        if (waPhone.replace(/\D/g, '').length < 10) {
            setError('Entrez les 10 chiffres de votre numéro');
            return;
        }
        setError('');
        setRequestingCode(true);
        setPairingCode(null);
        try {
            const cleaned = waPhone.replace(/\D/g, '').replace(/^0/, '');
            const fullNumber = `225${cleaned}`;
            const res = await fetch(`${API_URL}/whatsapp/pair-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ phoneNumber: fullNumber }),
            });
            const data = await res.json();
            if (data.success && data.code) setPairingCode(data.code);
            else throw new Error(data.error || 'Erreur génération du code');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur');
        } finally {
            setRequestingCode(false);
        }
    };

    // ============== First product state ==============
    const [productName, setProductName] = useState('');
    const [productPrice, setProductPrice] = useState('');
    const [productStock, setProductStock] = useState('');
    const [productSaving, setProductSaving] = useState(false);
    const [productAdded, setProductAdded] = useState(false);

    const saveFirstProduct = async () => {
        if (!productName.trim()) return setError('Nom du produit requis');
        const price = parseInt(productPrice);
        if (!price || price <= 0) return setError('Prix invalide');
        const stock = parseInt(productStock) || 0;
        setError('');
        setProductSaving(true);
        try {
            const res = await fetch(`${API_URL}/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ name: productName.trim(), price, stock }),
            });
            if (!res.ok) throw new Error('Erreur lors de la création');
            setProductAdded(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur');
        } finally {
            setProductSaving(false);
        }
    };

    // ============== Personality state ==============
    const [persona, setPersona] = useState('friendly');
    const [personaSaving, setPersonaSaving] = useState(false);

    const savePersonality = async () => {
        setPersonaSaving(true);
        setError('');
        try {
            // Fetch current settings, merge, then PUT
            const getRes = await fetch(`${API_URL}/settings`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const current = await getRes.json();
            const slangLevel = persona === 'ivoirien' ? 'high' : persona === 'commercial' ? 'low' : 'medium';
            const next = { ...current, persona, slangLevel };
            await fetch(`${API_URL}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(next),
            });
            setStep('done');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur');
        } finally {
            setPersonaSaving(false);
        }
    };

    // ============== Navigation helpers ==============
    const stepOrder: Step[] = ['welcome', 'whatsapp', 'product', 'personality', 'done'];
    const stepIndex = stepOrder.indexOf(step);

    const goPrev = () => {
        setError('');
        const idx = stepOrder.indexOf(step);
        if (idx > 0) setStep(stepOrder[idx - 1]);
    };
    const skipStep = () => {
        setError('');
        const idx = stepOrder.indexOf(step);
        if (idx < stepOrder.length - 1) setStep(stepOrder[idx + 1]);
    };

    // ============== Render ==============
    return (
        <div className="min-h-screen bg-[#0f111a] flex items-center justify-center p-4">
            <div className="bg-[#0a0c10] border border-white/5 p-8 rounded-3xl w-full max-w-lg shadow-2xl shadow-indigo-500/10">

                {/* Progress dots */}
                {step !== 'done' && (
                    <div className="flex gap-2 mb-6">
                        {stepOrder.slice(0, -1).map((s, i) => (
                            <div key={s} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${i <= stepIndex ? 'bg-gradient-to-r from-indigo-500 to-purple-500' : 'bg-white/5'}`} />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
                )}

                {/* ============== WELCOME ============== */}
                {step === 'welcome' && (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                        <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-6 shadow-xl shadow-indigo-500/30">
                            <Sparkles className="w-10 h-10 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white mb-3">Bienvenue ! 🎉</h1>
                        <p className="text-gray-400 mb-8">Configurons votre bot ensemble en <strong className="text-white">3 minutes</strong>.</p>

                        <div className="space-y-3 text-left mb-8">
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">1</div>
                                <div>
                                    <p className="text-white font-semibold">Connecter WhatsApp</p>
                                    <p className="text-gray-500 text-xs">Lier votre numéro au bot</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">2</div>
                                <div>
                                    <p className="text-white font-semibold">Ajouter votre 1er produit</p>
                                    <p className="text-gray-500 text-xs">Pour que le bot ait quelque chose à vendre</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300 font-bold">3</div>
                                <div>
                                    <p className="text-white font-semibold">Choisir le ton du bot</p>
                                    <p className="text-gray-500 text-xs">Sympa, pro ou nouchi 🇨🇮</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setStep('whatsapp')}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg hover:shadow-indigo-500/25 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                        >
                            C'est parti <ArrowRight className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full mt-3 text-gray-500 hover:text-gray-300 text-sm transition-colors"
                        >
                            Plus tard, accéder au dashboard
                        </button>
                    </div>
                )}

                {/* ============== WHATSAPP CONNECT ============== */}
                {step === 'whatsapp' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white mb-2">Connecter WhatsApp</h2>
                        <p className="text-gray-400 text-sm mb-6">Étape 1 sur 3</p>

                        {waConnected ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                    <Check className="w-8 h-8 text-green-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">WhatsApp connecté ! ✨</h3>
                                <p className="text-gray-400 text-sm mb-6">Votre bot est lié à votre numéro.</p>
                                <button
                                    onClick={() => setStep('product')}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                                >Continuer <ArrowRight className="w-5 h-5" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10 mb-4">
                                    <button
                                        type="button"
                                        onClick={() => setWaMethod('pairing')}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${waMethod === 'pairing' ? 'bg-indigo-500 text-white' : 'text-gray-500'}`}
                                    ><Keyboard className="w-4 h-4" /> Code à taper</button>
                                    <button
                                        type="button"
                                        onClick={() => setWaMethod('qr')}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-1 ${waMethod === 'qr' ? 'bg-indigo-500 text-white' : 'text-gray-500'}`}
                                    ><Smartphone className="w-4 h-4" /> QR Code</button>
                                </div>

                                {waMethod === 'pairing' ? (
                                    !pairingCode ? (
                                        <>
                                            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Votre numéro WhatsApp</label>
                                            <div className="relative mb-4">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold font-mono text-sm border-r border-gray-600 pr-2 pointer-events-none">+225</div>
                                                <input
                                                    type="tel"
                                                    value={waPhone}
                                                    onChange={e => setWaPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                    placeholder="0709483812"
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-[70px] pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono"
                                                />
                                            </div>
                                            <button
                                                onClick={requestPairingCode}
                                                disabled={requestingCode || waPhone.length < 10}
                                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                {requestingCode ? 'Génération...' : 'Recevoir le code'}
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center animate-in zoom-in duration-300">
                                            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Votre code de jumelage</p>
                                            <div className="flex justify-center gap-1.5 font-mono font-bold text-2xl text-white mb-6">
                                                {pairingCode.split('').map((c, i) => (
                                                    <span key={i} className="bg-white/10 p-2 rounded border border-white/5 min-w-[36px]">{c}</span>
                                                ))}
                                            </div>
                                            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-left text-xs text-indigo-200 space-y-1">
                                                <p>1. Ouvrez <strong>WhatsApp</strong> sur ce téléphone</p>
                                                <p>2. Allez dans <strong>Réglages → Appareils connectés</strong></p>
                                                <p>3. <strong>Connecter un appareil → Avec un numéro</strong></p>
                                                <p>4. Tapez ce code</p>
                                            </div>
                                            <p className="text-xs text-gray-500 mt-4 flex items-center justify-center gap-1">
                                                <RefreshCw className="w-3 h-3 animate-spin" /> En attente de connexion...
                                            </p>
                                            <button onClick={() => { setPairingCode(null); setWaPhone(''); }} className="text-xs text-gray-500 hover:text-white mt-2">Essayer un autre numéro</button>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center">
                                        {qrCode ? (
                                            <div className="bg-white p-4 rounded-2xl inline-block">
                                                <QRCode value={qrCode} size={200} />
                                            </div>
                                        ) : (
                                            <div className="w-52 h-52 mx-auto flex items-center justify-center bg-white/5 rounded-2xl">
                                                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500 mt-4">Scannez avec WhatsApp depuis un autre appareil</p>
                                    </div>
                                )}
                            </>
                        )}

                        {!waConnected && (
                            <div className="flex gap-2 mt-6">
                                <button onClick={goPrev} className="px-5 bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-xl flex items-center gap-2">
                                    <ArrowLeft className="w-4 h-4" /> Retour
                                </button>
                                <button onClick={skipStep} className="flex-1 text-gray-500 hover:text-white py-3 rounded-xl">
                                    Plus tard, passer cette étape
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ============== FIRST PRODUCT ============== */}
                {step === 'product' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white mb-2">Votre 1er produit</h2>
                        <p className="text-gray-400 text-sm mb-6">Étape 2 sur 3 — pour que le bot ait quelque chose à proposer.</p>

                        {productAdded ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                    <Package className="w-8 h-8 text-green-400" />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2">Produit ajouté ! 📦</h3>
                                <p className="text-gray-400 text-sm mb-6">{productName} — {parseInt(productPrice).toLocaleString()} FCFA</p>
                                <button
                                    onClick={() => setStep('personality')}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                                >Continuer <ArrowRight className="w-5 h-5" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Nom du produit</label>
                                        <input
                                            type="text"
                                            value={productName}
                                            onChange={e => setProductName(e.target.value)}
                                            placeholder="Ex: Bazin Riche, Mèche Brésilienne..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Prix (FCFA)</label>
                                        <input
                                            type="number"
                                            value={productPrice}
                                            onChange={e => setProductPrice(e.target.value)}
                                            placeholder="15000"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Stock disponible (optionnel)</label>
                                        <input
                                            type="number"
                                            value={productStock}
                                            onChange={e => setProductStock(e.target.value)}
                                            placeholder="10"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-xs text-gray-600 mt-1">Laisser vide = stock illimité</p>
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-6">
                                    <button onClick={goPrev} className="px-5 bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-xl flex items-center gap-2">
                                        <ArrowLeft className="w-4 h-4" /> Retour
                                    </button>
                                    <button
                                        onClick={saveFirstProduct}
                                        disabled={productSaving}
                                        className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {productSaving ? 'Ajout...' : 'Ajouter ce produit'}
                                        {!productSaving && <ArrowRight className="w-4 h-4" />}
                                    </button>
                                </div>
                                <button onClick={skipStep} className="w-full mt-2 text-gray-500 hover:text-white text-sm py-2">
                                    Plus tard, passer cette étape
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* ============== PERSONALITY ============== */}
                {step === 'personality' && (
                    <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                        <h2 className="text-2xl font-bold text-white mb-2">Le ton du bot</h2>
                        <p className="text-gray-400 text-sm mb-6">Étape 3 sur 3 — comment votre bot doit-il parler à vos clients ?</p>

                        <div className="space-y-3 mb-6">
                            {PERSONALITIES.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setPersona(p.id)}
                                    className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3 ${persona === p.id ? 'bg-indigo-500/20 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
                                >
                                    <span className="text-3xl">{p.emoji}</span>
                                    <div className="flex-1">
                                        <p className={`font-bold ${persona === p.id ? 'text-white' : 'text-gray-300'}`}>{p.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{p.desc}</p>
                                    </div>
                                    {persona === p.id && <Check className="w-5 h-5 text-indigo-400" />}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <button onClick={goPrev} className="px-5 bg-white/5 border border-white/10 hover:bg-white/10 text-white py-3 rounded-xl flex items-center gap-2">
                                <ArrowLeft className="w-4 h-4" /> Retour
                            </button>
                            <button
                                onClick={savePersonality}
                                disabled={personaSaving}
                                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {personaSaving ? 'Configuration...' : 'Terminer'}
                                {!personaSaving && <ArrowRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* ============== DONE ============== */}
                {step === 'done' && (
                    <div className="text-center py-8 animate-in fade-in zoom-in duration-500">
                        <div className="w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mb-6 shadow-xl shadow-green-500/30">
                            <PartyPopper className="w-12 h-12 text-white" />
                        </div>
                        <h2 className="text-3xl font-bold text-white mb-3">C'est prêt ! 🚀</h2>
                        <p className="text-gray-400 mb-8 max-w-sm mx-auto">
                            Votre bot DjassaBot est configuré. Il va maintenant accueillir et vendre à vos clients sur WhatsApp 24h/24.
                        </p>

                        <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-left text-xs text-indigo-200 mb-6">
                            <p className="font-bold mb-2 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" /> Prochaines étapes recommandées :
                            </p>
                            <ul className="space-y-1 list-disc list-inside text-indigo-200/80">
                                <li>Tester le bot en envoyant un message depuis un autre numéro</li>
                                <li>Ajouter d'autres produits avec photos et variations</li>
                                <li>Personnaliser les heures d'ouverture et zones de livraison</li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2"
                            >
                                Accéder au dashboard <ArrowRight className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => navigate('/dashboard/inbox')}
                                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 rounded-xl flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="w-4 h-4" /> Tester le bot (Playground)
                            </button>
                        </div>
                    </div>
                )}

                {/* Logout link */}
                {step !== 'done' && (
                    <button
                        onClick={() => { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }}
                        className="mt-6 text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 mx-auto"
                    >
                        <LogOut className="w-3 h-3" /> Se déconnecter
                    </button>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
