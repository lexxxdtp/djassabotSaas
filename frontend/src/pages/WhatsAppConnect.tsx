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

        try {
            const res = await fetch(`${API_URL}/whatsapp/pair-code`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phoneNumber })
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
                    <p className="text-zinc-500 text-xs">Liez votre compte WhatsApp pour activer le Vendeur Augmenté.</p>
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
                <div className="bg-[#0a0c10] rounded-xl border border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-xl min-h-[400px] relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-50"></div>

                    {loading ? (
                        <div className="text-zinc-500 animate-pulse text-xs uppercase tracking-widest">Chargement du statut...</div>
                    ) : status === 'connected' ? (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse"></div>
                                <div className="w-24 h-24 bg-[#0a0c10] rounded-full flex items-center justify-center text-indigo-500 border-2 border-indigo-500/50 relative z-10 shadow-2xl">
                                    <CheckCircle size={48} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Cerveau Connecté !</h3>
                                <p className="text-zinc-500 mt-2 text-sm">Le bot gère désormais vos conversations.</p>
                            </div>
                        </>
                    ) : usePairingCode ? (
                        <div className="w-full max-w-xs space-y-4">
                            {!pairingCode ? (
                                <>
                                    <div className="text-center">
                                        <h3 className="text-white font-bold mb-2">Entrez votre numéro</h3>
                                        <p className="text-zinc-500 text-xs text-left">Ex: 2250700112233 (sans + ni espaces)</p>
                                    </div>
                                    <form onSubmit={handleRequestPairingCode} className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="2250700000000"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-center tracking-widest focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={requestingCode || phoneNumber.length < 10}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold uppercase py-3 rounded-lg transition-colors"
                                        >
                                            {requestingCode ? 'Génération...' : 'Recevoir le Code'}
                                        </button>
                                    </form>
                                </>
                            ) : (
                                <div className="space-y-6 animate-in zoom-in duration-300">
                                    <div className="text-center">
                                        <h3 className="text-zinc-400 text-xs uppercase tracking-widest mb-4">Code de Jumelage</h3>
                                        <div className="flex justify-center gap-2 font-mono font-bold text-3xl text-white tracking-wider">
                                            {pairingCode.split('').map((char, i) => (
                                                <span key={i} className="bg-white/10 p-2 rounded border border-white/5 min-w-[40px] shadow-lg">
                                                    {char}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 text-xs text-indigo-300 text-left">
                                        <p>1. Ouvrez WhatsApp &gt; <strong>Appareils connectés</strong></p>
                                        <p>2. Cliquez sur <strong>Connecter un appareil</strong></p>
                                        <p>3. Cliquez sur <strong>"Connecter avec un numéro de téléphone"</strong></p>
                                        <p>4. Entrez ce code.</p>
                                    </div>
                                    <button
                                        onClick={() => setPairingCode(null)}
                                        className="text-zinc-500 hover:text-white text-xs underline"
                                    >
                                        Essayer un autre numéro
                                    </button>
                                </div>
                            )}

                            {!pairingCode && (
                                <button
                                    onClick={() => setUsePairingCode(false)}
                                    className="text-zinc-500 hover:text-white text-xs flex items-center justify-center w-full mt-4"
                                >
                                    <RefreshCw size={12} className="mr-1" />
                                    Scanner un QR Code à la place
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="bg-white p-4 rounded-xl shadow-2xl shadow-indigo-500/10 border-4 border-white/5 group-hover:border-indigo-500/50 transition-colors">
                                {qr ? (
                                    <QRCode value={qr} size={180} />
                                ) : (
                                    <div className="w-48 h-48 flex items-center justify-center bg-zinc-100 rounded-lg text-zinc-400">
                                        <div className="flex flex-col items-center">
                                            <RefreshCw className="animate-spin mb-2 text-indigo-500" size={24} />
                                            <span className="text-xs font-mono text-zinc-500">Génération QR...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-white">Scannez pour lier</h3>
                                    <p className="text-zinc-500 text-[10px] uppercase tracking-wide">
                                        WhatsApp &gt; Réglages &gt; Appareils connectés
                                    </p>
                                </div>
                                <div className="pt-2 border-t border-white/5">
                                    <button
                                        onClick={() => setUsePairingCode(true)}
                                        className="text-indigo-400 hover:text-indigo-300 text-xs font-bold uppercase tracking-wide flex items-center justify-center mx-auto transition-colors"
                                    >
                                        <Keyboard size={14} className="mr-2" />
                                        Lier avec numéro de téléphone
                                    </button>
                                    <p className="text-zinc-600 text-[10px] mt-1">(Si vous n'avez qu'un seul appareil)</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Instructions / Info */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900/30 to-[#0a0c10] border border-white/5 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Smartphone size={100} className="text-white" />
                        </div>
                        <div className="flex items-start space-x-4 relative z-10">
                            <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-500 border border-indigo-500/20">
                                <Smartphone size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">Pilotage Automatique</h3>
                                <p className="text-zinc-400 text-sm leading-relaxed">
                                    Vos clients discutent avec une IA entraînée pour vendre. Elle connaît votre stock, vos prix et négocie selon vos règles.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-6">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">Procédure de connexion</h3>
                        <ol className="space-y-4 text-zinc-300 text-sm list-decimal list-inside marker:text-indigo-500 marker:font-bold">
                            <li className="pl-2">Ouvrez <strong>WhatsApp</strong> sur votre mobile.</li>
                            <li className="pl-2">Menu <strong>⋮</strong> ou <strong>Réglages</strong> &gt; <strong>Appareils connectés</strong>.</li>
                            <li className="pl-2">Appuyez sur <span className="text-indigo-500 font-bold">Connecter un appareil</span>.</li>
                            <li className="pl-2">
                                {usePairingCode ? (
                                    <>Choisissez <span className="text-indigo-300 font-bold">"Connecter avec un numéro"</span> en bas.</>
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
