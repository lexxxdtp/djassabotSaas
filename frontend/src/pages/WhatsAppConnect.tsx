import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { RefreshCw, CheckCircle, LogOut, Smartphone, Keyboard } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';

const WhatsAppConnect: React.FC = () => {
    const { token } = useAuth();
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [usePairingCode, setUsePairingCode] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [requestingCode, setRequestingCode] = useState(false);

    const API_URL = getApiUrl();

    useEffect(() => {
        if (!token) return;

        const fetchStatus = async () => {
            try {
                const res = await fetch(`${API_URL}/whatsapp/status`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.status === 401) return;

                const data = await res.json();
                setStatus(data.status);
                // Only update QR if we are in QR mode and not already successfully paired
                if (!usePairingCode && !pairingCode) {
                    setQr(data.qrCode || null);
                }
            } catch (error) {
                console.error('Failed to fetch status', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [token, API_URL, usePairingCode, pairingCode]);

    const handleLogout = async () => {
        if (!confirm('Voulez-vous vraiment déconnecter votre WhatsApp ?')) return;
        setLoading(true);
        try {
            await fetch(`${API_URL}/whatsapp/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setStatus('disconnected');
            setQr(null);
            setPairingCode(null);
            setUsePairingCode(false);
        } catch (error) {
            console.error('Logout failed', error);
        }
    };

    const handleRequestPairingCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequestingCode(true);
        setPairingCode(null);

        // Get selected country code
        const form = e.target as HTMLFormElement;
        const countryCode = (form.elements.namedItem('countryCode') as HTMLSelectElement).value;

        // Clean user input (remove spaces, dashes)
        let cleanLocal = phoneNumber.replace(/[^0-9]/g, '');
        // Remove leading zero if present (standard for international format, except some countries but mostly yes)
        if (cleanLocal.startsWith('0')) {
            cleanLocal = cleanLocal.substring(1);
        }

        const fullNumber = countryCode + cleanLocal;
        console.log('Requesting pairing for:', fullNumber);

        try {
            const res = await fetch(`${API_URL}/whatsapp/pair-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phoneNumber: fullNumber })
            });
            const data = await res.json();
            if (data.success && data.code) {
                setPairingCode(data.code);
            } else {
                alert('Erreur: ' + (data.error || 'Impossible de générer le code'));
            }
        } catch (error) {
            console.error(error);
            alert('Erreur de connexion serveur');
        } finally {
            setRequestingCode(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                <div>
                    <h1 className="text-xl font-bold text-white tracking-tight uppercase flex items-center gap-2">
                        Connexion WhatsApp
                        {status === 'connected' && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/30">ACTIF</span>}
                    </h1>
                    <p className="text-[#888] text-xs">Liez votre compte WhatsApp pour activer le Vendeur Augmenté.</p>
                </div>
                {status === 'connected' && (
                    <button
                        onClick={handleLogout}
                        className="bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg flex items-center transition-colors text-xs font-bold uppercase tracking-wide border border-red-500/20"
                    >
                        <LogOut size={14} className="mr-2" />
                        Déconnecter
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Status Card */}
                <div className="bg-[#111] rounded-xl border border-[#1a1a1a] p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-xl min-h-[400px] relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-[#00D97E]/40"></div>

                    {loading ? (
                        <div className="text-[#888] animate-pulse text-xs uppercase tracking-widest">Chargement du statut...</div>
                    ) : status === 'connected' ? (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 bg-[#00D97E] blur-xl opacity-10 animate-pulse"></div>
                                <div className="w-24 h-24 bg-[#111] rounded-full flex items-center justify-center text-[#00D97E] border-2 border-[#00D97E]/50 relative z-10 shadow-2xl">
                                    <CheckCircle size={48} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Cerveau Connecté !</h3>
                                <p className="text-[#888] mt-2 text-sm">Le bot gère désormais vos conversations.</p>
                            </div>
                        </>
                    ) : usePairingCode ? (
                        <div className="w-full max-w-xs space-y-4">
                            {!pairingCode ? (
                                <>
                                    <div className="text-center">
                                        <h3 className="text-white font-bold mb-2">Entrez votre numéro</h3>
                                        <p className="text-[#888] text-xs text-left">Entrez vos 10 chiffres (ex: 07 07...)</p>
                                    </div>
                                    <form onSubmit={handleRequestPairingCode} className="space-y-4">
                                        <div className="relative flex items-center">
                                            {/* COUNTRY SELECTOR */}
                                            <div className="absolute left-0 top-0 bottom-0 flex items-center border-r border-[#1a1a1a] bg-white/5 rounded-l-lg z-10 w-28">
                                                <select
                                                    className="w-full h-full bg-transparent text-white text-xs font-mono outline-none px-2 appearance-none cursor-pointer"
                                                    onChange={() => {
                                                        // Placeholder for future logic
                                                    }}
                                                    defaultValue="225"
                                                    name="countryCode"
                                                >
                                                    <optgroup label="Afrique de l'Ouest (Prioritaire)">
                                                        <option value="225">🇨🇮 +225</option>
                                                        <option value="221">🇸🇳 +221</option>
                                                        <option value="223">🇲🇱 +223</option>
                                                        <option value="226">🇧🇫 +226</option>
                                                        <option value="229">🇧🇯 +229</option>
                                                        <option value="228">🇹🇬 +228</option>
                                                        <option value="227">🇳🇪 +227</option>
                                                        <option value="224">🇬🇳 +224</option>
                                                        <option value="233">🇬🇭 +233</option>
                                                        <option value="234">🇳🇬 +234</option>
                                                    </optgroup>
                                                    <optgroup label="International">
                                                        <option value="33">🇫🇷 +33</option>
                                                        <option value="1">🇺🇸 +1</option>
                                                        <option value="44">🇬🇧 +44</option>
                                                        <option value="32">🇧🇪 +32</option>
                                                    </optgroup>
                                                </select>
                                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-[#888]">
                                                    <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                                                </div>
                                            </div>

                                            <input
                                                type="text"
                                                placeholder="07 07..."
                                                value={phoneNumber}
                                                onChange={e => setPhoneNumber(e.target.value)}
                                                className="w-full bg-white/5 border border-[#1a1a1a] rounded-lg pl-32 pr-4 py-3 text-white tracking-widest focus:outline-none focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] transition-all font-mono"
                                                required
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={requestingCode || phoneNumber.length < 10}
                                            className="w-full bg-[#00D97E] hover:bg-[#00D97E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black text-xs font-bold uppercase py-3 rounded-lg transition-colors"
                                        >
                                            {requestingCode ? 'Génération...' : 'Recevoir le Code'}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="space-y-6 animate-in zoom-in duration-300">
                                    <div className="text-center">
                                        <h3 className="text-[#888] text-xs uppercase tracking-widest mb-4">Code de Jumelage</h3>
                                        <div className="flex justify-center gap-2 font-mono font-bold text-3xl text-white tracking-wider">
                                            {pairingCode.split('').map((char, i) => (
                                                <span key={i} className="bg-white/10 p-2 rounded border border-[#1a1a1a] min-w-[40px] shadow-lg">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-[#00D97E]/10 border border-[#00D97E]/20 rounded-lg p-3 text-xs text-[#00D97E]/80 text-left">
                                        <p>1. Ouvrez WhatsApp &gt; <strong>Appareils connectés</strong></p>
                                        <p>2. Cliquez sur <strong>Connecter un appareil</strong></p>
                                        <p>3. Cliquez sur <strong>"Connecter avec un numéro de téléphone"</strong></p>
                                        <p>4. Entrez ce code.</p>
                                    </div>
                                    <button
                                        onClick={() => setPairingCode(null)}
                                        className="text-[#888] hover:text-white text-xs underline"
                                    >
                                        Essayer un autre numéro
                                    </button>
                                </div>
                            )}

                            {!pairingCode && (
                                <button
                                    onClick={() => setUsePairingCode(false)}
                                    className="text-[#888] hover:text-white text-xs flex items-center justify-center w-full mt-4"
                                >
                                    <RefreshCw size={12} className="mr-1" />
                                    Scanner un QR Code à la place
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="bg-white p-4 rounded-xl shadow-2xl shadow-black/20 border-4 border-[#1a1a1a] group-hover:border-[#00D97E]/30 transition-colors">
                                {qr ? (
                                    <QRCode value={qr} size={180} />
                                ) : (
                                    <div className="w-48 h-48 flex items-center justify-center bg-zinc-100 rounded-lg text-[#888]">
                                        <div className="flex flex-col items-center">
                                            <RefreshCw className="animate-spin mb-2 text-[#00D97E]" size={24} />
                                            <span className="text-xs font-mono text-[#888]">Génération QR...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-white">Scannez pour lier</h3>
                                    <p className="text-[#888] text-[10px] uppercase tracking-wide">
                                        WhatsApp &gt; Réglages &gt; Appareils connectés
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-[#1a1a1a]">
                                    <button
                                        onClick={() => setUsePairingCode(true)}
                                        className="text-[#00D97E] hover:text-[#00D97E]/80 text-xs font-bold uppercase tracking-wide flex items-center justify-center mx-auto transition-colors"
                                    >
                                        <Keyboard size={14} className="mr-2" />
                                        Lier avec numéro de téléphone
                                    </button>
                                    <p className="text-[#555] text-[10px] mt-1">(Si vous n'avez qu'un seul appareil)</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Instructions / Info */}
                <div className="space-y-6">
                    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Smartphone size={100} className="text-white" />
                        </div>
                        <div className="flex items-start space-x-4 relative z-10">
                            <div className="p-3 bg-[#00D97E]/10 rounded-lg text-[#00D97E] border border-[#00D97E]/20">
                                <Smartphone size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Pilotage Automatique</h3>
                                <p className="text-[#888] text-sm leading-relaxed">
                                    Vos clients discutent avec une IA entraînée pour vendre. Elle connaît votre stock, vos prix et négocie selon vos règles.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#111] border border-[#1a1a1a] rounded-xl p-6">
                        <h3 className="text-xs font-bold text-[#888] uppercase tracking-widest mb-4 border-b border-[#1a1a1a] pb-2">Procédure de connexion</h3>
                        <ol className="space-y-4 text-[#888] text-sm list-decimal list-inside marker:text-[#00D97E] marker:font-bold">
                            <li className="pl-2">Ouvrez <strong>WhatsApp</strong> sur votre mobile.</li>
                            <li className="pl-2">Menu <strong>⋮</strong> ou <strong>Réglages</strong> &gt; <strong>Appareils connectés</strong>.</li>
                            <li className="pl-2">Appuyez sur <span className="text-[#00D97E] font-bold">Connecter un appareil</span>.</li>
                            <li className="pl-2">
                                {usePairingCode ? (
                                    <>Choisissez <span className="text-[#00D97E]/80 font-bold">"Connecter avec un numéro"</span> en bas.</>
                                ) : (
                                    <>Scannez le QRCode affiché à l'écran.</>
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
