import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import {
    Sparkles, ArrowRight, ArrowLeft, Smartphone, Keyboard, Check,
    Package, MessageCircle, RefreshCw, PartyPopper, LogOut
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';

type Step = 'welcome' | 'whatsapp' | 'product' | 'personality' | 'done';

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
    const [step, setStep] = useState<Step>('welcome');
    const [error, setError] = useState('');

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

    useEffect(() => {
        if (step !== 'whatsapp' || !token) return;
        let active = true;
        const poll = async () => {
            try {
                const res = await apiClient('/whatsapp/status');
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
    }, [step, token, waMethod]);

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
            const res = await apiClient('/whatsapp/pair-code', {
                method: 'POST',
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
            const res = await apiClient('/products', {
                method: 'POST',
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
            const getRes = await apiClient('/settings');
            const current = await getRes.json();
            const slangLevel = persona === 'ivoirien' ? 'high' : persona === 'commercial' ? 'low' : 'medium';
            const next = { ...current, persona, slangLevel };
            await apiClient('/settings', {
                method: 'POST',
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
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="bg-[#111] border border-[#1a1a1a] p-6 md:p-8 rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden transition-colors">
                
                {/* Progress bar */}
                {step !== 'done' && (
                    <div className="flex gap-2 mb-6" aria-label="Progression de la configuration">
                        {stepOrder.slice(0, -1).map((s, i) => (
                            <div 
                                key={s} 
                                className={`flex-1 h-1 rounded-full transition-colors duration-300 ${i <= stepIndex ? 'bg-[#00D97E]' : 'bg-[#222]'}`} 
                            />
                        ))}
                    </div>
                )}

                {error && (
                    <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl mb-4 text-xs font-semibold">
                        {error}
                    </div>
                )}

                {/* ============== WELCOME ============== */}
                {step === 'welcome' && (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-14 h-14 mx-auto rounded-xl bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center mb-6">
                            <Sparkles className="w-7 h-7 text-[#00D97E]" aria-hidden="true" />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Bienvenue ! 🎉</h1>
                        <p className="text-[#888] mb-8 text-xs md:text-sm">Configurons votre bot ensemble en <strong className="text-white">3 minutes</strong>.</p>

                        <div className="space-y-3.5 text-left mb-8">
                            {[
                                { n: '1', title: 'Connecter WhatsApp', sub: 'Liez votre numéro de téléphone au bot' },
                                { n: '2', title: 'Ajouter votre premier produit', sub: 'Pour que le bot ait un article à proposer' },
                                { n: '3', title: 'Choisir la personnalité', sub: 'Amical, commercial ou en nouchi 🇨🇮' },
                            ].map(item => (
                                <div key={item.n} className="flex items-center gap-3.5 bg-black/40 border border-[#1a1a1a] rounded-2xl p-4">
                                    <div className="w-9 h-9 rounded-xl bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center text-[#00D97E] font-bold text-xs shrink-0">{item.n}</div>
                                    <div>
                                        <p className="text-white font-bold text-sm">{item.title}</p>
                                        <p className="text-[#888] text-xs mt-0.5">{item.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setStep('whatsapp')}
                            className="w-full bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                        >
                            C'est parti <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="w-full mt-4 text-[#888] hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                            Plus tard, accéder au tableau de bord
                        </button>
                    </div>
                )}

                {/* ============== WHATSAPP CONNECT ============== */}
                {step === 'whatsapp' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h2 className="text-xl font-bold text-white mb-1">Connecter WhatsApp</h2>
                        <p className="text-[#888] text-xs font-medium mb-6">Étape 1 sur 3</p>

                        {waConnected ? (
                            <div className="text-center py-6 animate-in zoom-in duration-200">
                                <div className="w-14 h-14 mx-auto rounded-xl bg-[#00D97E]/15 border border-[#00D97E]/20 flex items-center justify-center mb-4">
                                    <Check className="w-7 h-7 text-[#00D97E]" aria-hidden="true" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">WhatsApp connecté ! ✨</h3>
                                <p className="text-[#888] text-xs mb-6">Votre bot est désormais lié à votre numéro de téléphone.</p>
                                <button
                                    onClick={() => setStep('product')}
                                    className="w-full bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                                >Continuer <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="flex gap-2 p-1.5 bg-black border border-[#1a1a1a] rounded-xl mb-6">
                                    <button
                                        type="button"
                                        onClick={() => setWaMethod('pairing')}
                                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-[background-color,color] flex items-center justify-center gap-1.5 cursor-pointer ${waMethod === 'pairing' ? 'bg-[#00D97E] text-black' : 'text-[#888] hover:text-white'}`}
                                    ><Keyboard className="w-3.5 h-3.5" aria-hidden="true" /> Code à taper</button>
                                    <button
                                        type="button"
                                        onClick={() => setWaMethod('qr')}
                                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-[background-color,color] flex items-center justify-center gap-1.5 cursor-pointer ${waMethod === 'qr' ? 'bg-[#00D97E] text-black' : 'text-[#888] hover:text-white'}`}
                                    ><Smartphone className="w-3.5 h-3.5" aria-hidden="true" /> QR Code</button>
                                </div>

                                {waMethod === 'pairing' ? (
                                    !pairingCode ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label htmlFor="waPhone" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Numéro de téléphone WhatsApp</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888] font-bold font-mono text-sm border-r border-[#1a1a1a] pr-3 pointer-events-none">+225</div>
                                                    <input
                                                        id="waPhone"
                                                        type="tel"
                                                        inputMode="tel"
                                                        autoComplete="tel"
                                                        value={waPhone}
                                                        onChange={e => setWaPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                        placeholder="0709483812"
                                                        className="w-full bg-black border border-[#1a1a1a] rounded-xl py-3 pl-[72px] pr-4 text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 font-mono text-sm transition-[border-color,box-shadow]"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={requestPairingCode}
                                                disabled={requestingCode || waPhone.length < 10}
                                                className="w-full bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-95 cursor-pointer text-sm mt-2"
                                            >
                                                {requestingCode ? 'Génération…' : 'Recevoir le code'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center animate-in zoom-in duration-200">
                                            <p className="text-xs text-[#888] uppercase tracking-widest mb-3">Votre code de jumelage</p>
                                            <div className="flex justify-center gap-2 font-mono font-bold text-2xl text-white mb-6">
                                                {pairingCode.split('').map((c, i) => (
                                                    <span key={i} className="bg-black py-2.5 px-3 rounded-lg border border-[#1a1a1a] min-w-[38px] inline-block shadow-inner">{c}</span>
                                                ))}
                                            </div>
                                            <div className="bg-[#00D97E]/10 border border-[#00D97E]/20 rounded-xl p-4 text-left text-xs text-[#00D97E]/85 space-y-1.5">
                                                <p className="font-bold">Comment faire :</p>
                                                <p>1. Ouvrez <strong>WhatsApp</strong> sur ce téléphone</p>
                                                <p>2. Allez dans <strong>Réglages → Appareils connectés</strong></p>
                                                <p>3. Sélectionnez <strong>Connecter un appareil → Avec le numéro</strong></p>
                                                <p>4. Saisissez ce code</p>
                                            </div>
                                            <p className="text-xs text-[#888] mt-5 flex items-center justify-center gap-1.5 font-medium">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00D97E]" /> En attente de connexion…
                                            </p>
                                            <button onClick={() => { setPairingCode(null); setWaPhone(''); }} className="text-xs text-[#555] hover:text-white mt-4 underline decoration-[#1a1a1a] cursor-pointer">
                                                Essayer un autre numéro
                                            </button>
                                        </div>
                                    )
                                ) : (
                                    <div className="text-center animate-in zoom-in duration-200">
                                        {qrCode ? (
                                            <div className="bg-white p-4 rounded-xl inline-block shadow-2xl">
                                                <QRCode value={qrCode} size={180} />
                                            </div>
                                        ) : (
                                            <div className="w-48 h-48 mx-auto flex items-center justify-center bg-black border border-[#1a1a1a] rounded-xl shadow-inner">
                                                <RefreshCw className="w-7 h-7 text-[#00D97E] animate-spin" />
                                            </div>
                                        )}
                                        <p className="text-xs text-[#888] mt-4 font-medium">Scannez avec WhatsApp depuis un autre appareil</p>
                                    </div>
                                )}
                            </>
                        )}

                        {!waConnected && (
                            <div className="flex gap-2.5 mt-8 border-t border-[#1a1a1a]/60 pt-4">
                                <button 
                                    onClick={goPrev} 
                                    aria-label="Retour"
                                    className="px-4 bg-black border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white py-3 rounded-xl flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                                >
                                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                                </button>
                                <button 
                                    onClick={skipStep} 
                                    className="flex-1 text-[#888] hover:text-white py-3 rounded-xl text-xs font-semibold cursor-pointer text-center hover:bg-white/5 transition-colors"
                                >
                                    Plus tard, passer cette étape
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* ============== FIRST PRODUCT ============== */}
                {step === 'product' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h2 className="text-xl font-bold text-white mb-1">Votre premier produit</h2>
                        <p className="text-[#888] text-xs font-medium mb-6">Étape 2 sur 3 — pour que le bot ait un article à proposer.</p>

                        {productAdded ? (
                            <div className="text-center py-6 animate-in zoom-in duration-200">
                                <div className="w-14 h-14 mx-auto rounded-xl bg-[#00D97E]/15 border border-[#00D97E]/20 flex items-center justify-center mb-4">
                                    <Package className="w-7 h-7 text-[#00D97E]" aria-hidden="true" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Produit ajouté ! 📦</h3>
                                <p className="text-[#888] text-xs mb-6 pr-2 truncate font-mono">{productName} — {parseInt(productPrice).toLocaleString()} FCFA</p>
                                <button
                                    onClick={() => setStep('personality')}
                                    className="w-full bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                                >Continuer <ArrowRight className="w-4 h-4" aria-hidden="true" /></button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="productName" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Nom du produit</label>
                                        <input
                                            id="productName"
                                            type="text"
                                            autoComplete="off"
                                            value={productName}
                                            onChange={e => setProductName(e.target.value)}
                                            placeholder="Ex: Bazin Riche, Mèche Brésilienne…"
                                            className="w-full bg-black border border-[#1a1a1a] rounded-xl py-3 px-4 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow]"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="productPrice" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Prix (FCFA)</label>
                                        <input
                                            id="productPrice"
                                            type="number"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={productPrice}
                                            onChange={e => setProductPrice(e.target.value)}
                                            placeholder="15000"
                                            className="w-full bg-black border border-[#1a1a1a] rounded-xl py-3 px-4 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow] font-mono"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="productStock" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Stock disponible (optionnel)</label>
                                        <input
                                            id="productStock"
                                            type="number"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            value={productStock}
                                            onChange={e => setProductStock(e.target.value)}
                                            placeholder="10"
                                            className="w-full bg-black border border-[#1a1a1a] rounded-xl py-3 px-4 text-sm text-white placeholder-[#555] focus:outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow] font-mono"
                                        />
                                        <p className="text-[10px] text-[#555] mt-1.5 font-medium">Laisser vide = stock illimité</p>
                                    </div>
                                </div>

                                <div className="flex gap-2.5 mt-8 border-t border-[#1a1a1a]/60 pt-4">
                                    <button 
                                        onClick={goPrev} 
                                        aria-label="Retour"
                                        className="px-4 bg-black border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white py-3 rounded-xl flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                                    >
                                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                    <button
                                        onClick={saveFirstProduct}
                                        disabled={productSaving}
                                        className="flex-1 bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                                    >
                                        {productSaving ? 'Ajout…' : 'Ajouter ce produit'}
                                        {!productSaving && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
                                    </button>
                                </div>
                                <button 
                                    onClick={skipStep} 
                                    className="w-full mt-3 text-[#888] hover:text-white text-xs font-semibold py-2 cursor-pointer text-center hover:bg-white/5 transition-colors rounded-xl"
                                >
                                    Plus tard, passer cette étape
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* ============== PERSONALITY ============== */}
                {step === 'personality' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <h2 className="text-xl font-bold text-white mb-1">Le ton du bot</h2>
                        <p className="text-[#888] text-sm mb-6">Étape 3 sur 3 — comment votre bot doit-il s'adresser à vos clients ?</p>

                        <div className="space-y-3 mb-6">
                            {PERSONALITIES.map(p => {
                                const isSelected = persona === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setPersona(p.id)}
                                        className={`w-full p-4 rounded-2xl border text-left transition-[background-color,border-color,box-shadow] flex items-center gap-3.5 cursor-pointer active:scale-[0.99] ${isSelected ? 'bg-[#00D97E]/5 border-[#00D97E]/20 ring-1 ring-[#00D97E]/20 shadow-lg' : 'bg-black border-[#1a1a1a] hover:border-[#00D97E]/10'}`}
                                    >
                                        <span className="text-2xl shrink-0">{p.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-sm leading-none ${isSelected ? 'text-[#00D97E]' : 'text-white'}`}>{p.title}</p>
                                            <p className="text-xs text-[#888] mt-1.5 truncate pr-2">{p.desc}</p>
                                        </div>
                                        {isSelected && <Check className="w-4 h-4 text-[#00D97E] shrink-0" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex gap-2.5 mt-8 border-t border-[#1a1a1a]/60 pt-4">
                            <button 
                                onClick={goPrev} 
                                aria-label="Retour"
                                className="px-4 bg-black border border-[#1a1a1a] hover:bg-[#1a1a1a] text-white py-3 rounded-xl flex items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                            >
                                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                                onClick={savePersonality}
                                disabled={personaSaving}
                                className="flex-1 bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                            >
                                {personaSaving ? 'Configuration…' : 'Terminer'}
                                {!personaSaving && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
                            </button>
                        </div>
                    </div>
                )}

                {/* ============== DONE ============== */}
                {step === 'done' && (
                    <div className="text-center py-6 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 mx-auto rounded-xl bg-[#00D97E]/10 border border-[#00D97E]/20 flex items-center justify-center mb-6">
                            <PartyPopper className="w-8 h-8 text-[#00D97E]" aria-hidden="true" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">C'est prêt ! 🚀</h2>
                        <p className="text-[#888] mb-8 max-w-sm mx-auto text-xs md:text-sm">
                            Votre bot DjassaBot est maintenant configuré. Il va pouvoir accueillir et vendre automatiquement à vos clients WhatsApp 24h/24.
                        </p>

                        <div className="bg-[#00D97E]/10 border border-[#00D97E]/20 rounded-xl p-4 text-left text-xs text-[#00D97E]/80 mb-8 space-y-2">
                            <p className="font-bold flex items-center gap-1.5 text-[#00D97E]">
                                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Prochaines étapes suggérées :
                            </p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>Tester le bot en lui envoyant un message depuis un autre compte</li>
                                <li>Ajouter d'autres articles avec photos et descriptions</li>
                                <li>Configurer les zones et frais de livraison dans vos Réglages</li>
                            </ul>
                        </div>

                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full bg-[#00D97E] hover:bg-[#00D97E]/95 text-black font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                            >
                                Accéder au tableau de bord <ArrowRight className="w-4 h-4" aria-hidden="true" />
                            </button>
                            <button
                                onClick={() => navigate('/dashboard/inbox')}
                                className="w-full bg-black hover:bg-[#1a1a1a] border border-[#1a1a1a] text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-[transform,background-color] active:scale-95 cursor-pointer text-sm"
                            >
                                <MessageCircle className="w-4 h-4" aria-hidden="true" /> Ouvrir les discussions
                            </button>
                        </div>
                    </div>
                )}

                {/* Logout link */}
                {step !== 'done' && (
                    <button
                        onClick={() => { localStorage.clear(); sessionStorage.clear(); navigate('/login'); }}
                        className="mt-6 text-xs text-[#555] hover:text-[#888] flex items-center gap-1.5 mx-auto cursor-pointer"
                    >
                        <LogOut className="w-3 h-3" aria-hidden="true" /> Se déconnecter
                    </button>
                )}
            </div>
        </div>
    );
};

export default Onboarding;
