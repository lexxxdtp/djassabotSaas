import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { 
    RefreshCw, CheckCircle2, LogOut, Smartphone, Keyboard 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';

const WhatsAppConnect: React.FC = () => {
    const { token } = useAuth();
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [usePairingCode, setUsePairingCode] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [requestingCode, setRequestingCode] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) return;

        const fetchStatus = async () => {
            try {
                const res = await apiClient('/whatsapp/status');
                if (res.status === 401) return;

                const data = await res.json();
                setStatus(data.status);
                // Only update QR if we are in QR mode and not already successfully paired
                if (!usePairingCode && !pairingCode) {
                    setQr(data.qrCode || null);
                }
            } catch (err) {
                console.error('Failed to fetch status', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [token, usePairingCode, pairingCode]);

    const handleLogout = async () => {
        if (!confirm('Voulez-vous vraiment déconnecter votre WhatsApp ?')) return;
        setLoading(true);
        setError('');
        try {
            await apiClient('/whatsapp/logout', {
                method: 'POST',
            });
            setStatus('disconnected');
            setQr(null);
            setPairingCode(null);
            setUsePairingCode(false);
        } catch (err) {
            console.error('Logout failed', err);
            setError('Impossible de déconnecter l\'appareil');
        } finally {
            setLoading(false);
        }
    };

    const handleRequestPairingCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setRequestingCode(true);
        setPairingCode(null);

        const form = e.target as HTMLFormElement;
        const countryCode = (form.elements.namedItem('countryCode') as HTMLSelectElement).value;

        // Clean user input
        let cleanLocal = phoneNumber.replace(/[^0-9]/g, '');
        if (cleanLocal.startsWith('0')) {
            cleanLocal = cleanLocal.substring(1);
        }

        if (cleanLocal.length < 8) {
            setError('Numéro de téléphone invalide');
            setRequestingCode(false);
            return;
        }

        const fullNumber = countryCode + cleanLocal;

        try {
            const res = await apiClient('/whatsapp/pair-code', {
                method: 'POST',
                body: JSON.stringify({ phoneNumber: fullNumber })
            });
            const data = await res.json();
            if (data.success && data.code) {
                setPairingCode(data.code);
            } else {
                setError(data.error || 'Impossible de générer le code');
            }
        } catch (err) {
            console.error(err);
            setError('Erreur de connexion serveur');
        } finally {
            setRequestingCode(false);
        }
    };

    const anim = 'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300';

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Header */}
            <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${anim}`}>
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight uppercase flex items-center gap-2.5">
                        Connexion WhatsApp
                        {status === 'connected' && (
                            <span className="text-[10px] bg-[#00D97E]/10 text-[#00D97E] px-2 py-0.5 rounded border border-[#00D97E]/20 font-bold uppercase tracking-wider">
                                ACTIF
                            </span>
                        )}
                    </h1>
                    <p className="text-[#888] text-xs">Liez votre compte WhatsApp pour activer le Vendeur Augmenté.</p>
                </div>
                {status === 'connected' && (
                    <button
                        onClick={handleLogout}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500/15 px-4 py-2.5 rounded-xl flex items-center transition-[transform,background-color] active:scale-95 text-xs font-bold uppercase tracking-wide border border-red-500/20 cursor-pointer"
                    >
                        <LogOut size={13} className="mr-2" aria-hidden="true" />
                        Déconnecter
                    </button>
                )}
            </div>

            {error && (
                <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 p-3.5 rounded-xl text-xs font-semibold">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Connection Box */}
                <div className={`bg-[#111] rounded-2xl border border-[#1a1a1a] p-6 sm:p-8 flex flex-col items-center justify-center text-center shadow-2xl min-h-[380px] relative overflow-hidden group ${anim}`}>
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-[#00D97E]/30" />

                    {loading ? (
                        <div className="text-[#888] animate-pulse text-xs uppercase tracking-widest flex items-center gap-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00D97E]" /> Chargement du statut…
                        </div>
                    ) : status === 'connected' ? (
                        <div className="space-y-5 animate-in zoom-in duration-200">
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#00D97E] blur-2xl opacity-10 animate-pulse" />
                                <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center text-[#00D97E] border border-[#00D97E]/30 relative z-10 shadow-inner">
                                    <CheckCircle2 size={40} aria-hidden="true" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white tracking-tight">WhatsApp Connecté !</h3>
                                <p className="text-[#888] mt-1.5 text-xs">Le bot répond et prend les commandes de vos clients en direct.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full space-y-6">
                            
                            {/* Method Switcher */}
                            <div className="flex gap-2 p-1.5 bg-black border border-[#1a1a1a] rounded-xl">
                                <button
                                    type="button"
                                    onClick={() => { setUsePairingCode(true); setError(''); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-[background-color,color] flex items-center justify-center gap-1.5 cursor-pointer ${usePairingCode ? 'bg-[#00D97E] text-black' : 'text-[#888] hover:text-white'}`}
                                >
                                    <Keyboard className="w-3.5 h-3.5" aria-hidden="true" /> Code à taper
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setUsePairingCode(false); setError(''); }}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-[background-color,color] flex items-center justify-center gap-1.5 cursor-pointer ${!usePairingCode ? 'bg-[#00D97E] text-black' : 'text-[#888] hover:text-white'}`}
                                >
                                    <Smartphone className="w-3.5 h-3.5" aria-hidden="true" /> QR Code
                                </button>
                            </div>

                            {usePairingCode ? (
                                !pairingCode ? (
                                    <div className="space-y-4 text-left animate-in zoom-in duration-200">
                                        <form onSubmit={handleRequestPairingCode} className="space-y-4">
                                            <div>
                                                <label htmlFor="pairingPhone" className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">
                                                    Numéro de téléphone
                                                </label>
                                                <div className="relative flex items-center">
                                                    
                                                    {/* Country Selector */}
                                                    <div className="absolute left-0 top-0 bottom-0 flex items-center border-r border-[#1a1a1a] bg-white/5 rounded-l-xl z-10 w-24">
                                                        <select
                                                            id="countryCode"
                                                            name="countryCode"
                                                            className="w-full h-full bg-transparent text-white text-xs font-mono outline-none px-3 appearance-none cursor-pointer"
                                                            defaultValue="225"
                                                        >
                                                            <optgroup label="Afrique (Prioritaire)">
                                                                <option value="225">🇨🇮 +225</option>
                                                                <option value="221">🇸🇳 +221</option>
                                                                <option value="223">🇲🇱 +223</option>
                                                                <option value="226">🇧🇫 +226</option>
                                                                <option value="229">🇧 Benin</option>
                                                                <option value="228">🇹 Togo</option>
                                                                <option value="227">🇳 Niger</option>
                                                                <option value="224">🇬 Guinea</option>
                                                                <option value="233">🇬 Ghana</option>
                                                                <option value="234">🇳 Nigeria</option>
                                                            </optgroup>
                                                            <optgroup label="Europe / Internat.">
                                                                <option value="33">🇫🇷 +33</option>
                                                                <option value="1">🇺🇸 +1</option>
                                                                <option value="44">🇬🇧 +44</option>
                                                                <option value="32">🇧🇪 +32</option>
                                                            </optgroup>
                                                        </select>
                                                        <div className="pointer-events-none absolute right-2 flex items-center text-[#888]" aria-hidden="true">
                                                            <svg className="fill-current h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                                            </svg>
                                                        </div>
                                                    </div>

                                                    <input
                                                        id="pairingPhone"
                                                        type="tel"
                                                        inputMode="tel"
                                                        autoComplete="tel"
                                                        placeholder="0709483812"
                                                        value={phoneNumber}
                                                        onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                                        className="w-full bg-black border border-[#1a1a1a] rounded-xl pl-28 pr-4 py-3 text-white tracking-widest focus:outline-none focus:border-[#00D97E]/40 focus:ring-2 focus:ring-[#00D97E]/10 transition-[border-color,box-shadow] font-mono text-sm"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="submit"
                                                disabled={requestingCode || phoneNumber.length < 8}
                                                className="w-full bg-[#00D97E] hover:bg-[#00D97E]/95 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold uppercase py-3.5 rounded-xl transition-[transform,background-color] active:scale-95 cursor-pointer"
                                            >
                                                {requestingCode ? 'Génération…' : 'Recevoir le Code'}
                                            </button>
                                        </form>
                                    </div>
                                ) : (
                                    <div className="space-y-6 animate-in zoom-in duration-200">
                                        <div>
                                            <p className="text-[#888] text-[10px] uppercase tracking-widest mb-3">Code de Jumelage</p>
                                            <div className="flex justify-center gap-1.5 font-mono font-bold text-2xl text-white">
                                                {pairingCode.split('').map((char, i) => (
                                                    <span key={i} className="bg-black py-2 px-3 rounded-lg border border-[#1a1a1a] min-w-[36px] inline-block shadow-inner">
                                                        {char}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="bg-[#00D97E]/10 border border-[#00D97E]/20 rounded-xl p-4 text-xs text-[#00D97E]/80 text-left space-y-1.5">
                                            <p className="font-bold">Comment faire :</p>
                                            <p>1. Ouvrez WhatsApp &gt; <strong>Appareils connectés</strong></p>
                                            <p>2. Cliquez sur <strong>Connecter un appareil</strong></p>
                                            <p>3. Sélectionnez <strong>"Connecter avec numéro de téléphone"</strong></p>
                                            <p>4. Saisissez ce code.</p>
                                        </div>
                                        <div className="flex flex-col gap-2 pt-2">
                                            <p className="text-xs text-[#888] flex items-center justify-center gap-1.5 font-medium">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00D97E]" /> En attente de connexion…
                                            </p>
                                            <button
                                                onClick={() => { setPairingCode(null); setPhoneNumber(''); }}
                                                className="text-[#888] hover:text-white text-xs underline cursor-pointer decoration-[#1a1a1a] mt-2"
                                            >
                                                Essayer un autre numéro
                                            </button>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div className="space-y-6 animate-in zoom-in duration-200">
                                    <div className="bg-white p-4 rounded-xl shadow-2xl inline-block border border-white/10">
                                        {qr ? (
                                            <QRCode value={qr} size={170} />
                                        ) : (
                                            <div className="w-44 h-44 flex items-center justify-center bg-black rounded-lg">
                                                <RefreshCw className="animate-spin text-[#00D97E] w-6 h-6" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-sm font-bold text-white">Scannez pour lier</h3>
                                        <p className="text-[#888] text-[10px] uppercase tracking-wider font-semibold">
                                            WhatsApp → Réglages → Appareils connectés
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Instructions Panel */}
                <div className={`space-y-5 ${anim}`} style={{ animationDelay: '100ms' }}>
                    
                    {/* Feature Card */}
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none" aria-hidden="true">
                            <Smartphone size={80} className="text-white" />
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-[#00D97E]/10 rounded-xl text-[#00D97E] border border-[#00D97E]/20 shrink-0">
                                <Smartphone size={22} aria-hidden="true" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white mb-1 tracking-tight">Pilotage Automatique</h3>
                                <p className="text-[#888] text-xs leading-relaxed">
                                    Vos clients discutent avec une IA entraînée pour vendre. Elle connaît vos prix, vérifie les stocks et valide les reçus Wave/Mobile Money de manière autonome.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Steps Card */}
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-5">
                        <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest mb-4 border-b border-[#1a1a1a] pb-2">Procédure</h3>
                        <ol className="space-y-3.5 text-[#888] text-xs list-decimal list-inside marker:text-[#00D97E] marker:font-bold">
                            <li className="pl-1">Ouvrez <strong>WhatsApp</strong> sur votre mobile.</li>
                            <li className="pl-1">Menu <strong>⋮</strong> ou <strong>Réglages</strong> &gt; <strong>Appareils connectés</strong>.</li>
                            <li className="pl-1">Appuyez sur <span className="text-[#00D97E] font-bold">Connecter un appareil</span>.</li>
                            <li className="pl-1">
                                {usePairingCode ? (
                                    <>Choisissez <span className="text-[#00D97E] font-bold">"Connecter avec numéro"</span> en bas.</>
                                ) : (
                                    <>Scannez le code QR affiché à gauche.</>
                                )}
                            </li>
                        </ol>
                    </div>

                </div>

            </div>

        </div>
    );
};

export default WhatsAppConnect;
