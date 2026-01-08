
import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { RefreshCw, CheckCircle, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiUrl } from '../utils/apiConfig';

const WhatsAppConnect: React.FC = () => {
    const { token } = useAuth();
    const { tenant } = useAuth();
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [qr, setQr] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const API_URL = getApiUrl();

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/whatsapp/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                return;
            }

            const data = await res.json();
            setStatus(data.status);
            setQr(data.qrCode || null);
        } catch (error) {
            console.error('Failed to fetch status', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token) return;

        fetchStatus();
        const interval = setInterval(fetchStatus, 3000);
        return () => clearInterval(interval);
    }, [token]);

    const handleLogout = async () => {
        if (!confirm('Voulez-vous vraiment déconnecter votre WhatsApp ?')) return;
        setLoading(true);
        try {
            await fetch(`${API_URL}/whatsapp/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            setStatus('disconnected');
            setQr(null);
            fetchStatus();
        } catch (error) {
            console.error('Logout failed', error);
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
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 flex flex-col items-center justify-center text-center space-y-6 shadow-xl h-96 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500 opacity-50"></div>

                    {loading ? (
                        <div className="text-zinc-500 animate-pulse text-xs uppercase tracking-widest">Chargement du statut...</div>
                    ) : status === 'connected' ? (
                        <>
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 animate-pulse"></div>
                                <div className="w-24 h-24 bg-zinc-950 rounded-full flex items-center justify-center text-emerald-500 border-2 border-emerald-500/50 relative z-10 shadow-2xl">
                                    <CheckCircle size={48} />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white tracking-tight">Cerveau Connecté !</h3>
                                <p className="text-zinc-500 mt-2 text-sm">Le bot gère désormais vos conversations.</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="bg-white p-4 rounded-xl shadow-2xl shadow-black/50 border-4 border-zinc-800 group-hover:border-orange-500/50 transition-colors">
                                {qr ? (
                                    <QRCode value={qr} size={180} />
                                ) : (
                                    <div className="w-48 h-48 flex items-center justify-center bg-zinc-100 rounded-lg text-zinc-400">
                                        <div className="flex flex-col items-center">
                                            <RefreshCw className="animate-spin mb-2 text-orange-500" size={24} />
                                            <span className="text-xs font-mono text-zinc-500">Génération QR...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-white">Scannez pour lier</h3>
                                <p className="text-zinc-500 text-[10px] uppercase tracking-wide">
                                    Menu &gt; Appareils connectés &gt; Connecter
                                </p>
                            </div>
                        </>
                    )}
                </div>

                {/* Instructions / Info */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Smartphone size={100} className="text-white" />
                        </div>
                        <div className="flex items-start space-x-4 relative z-10">
                            <div className="p-3 bg-orange-500/10 rounded-lg text-orange-500 border border-orange-500/20">
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

                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 border-b border-zinc-800 pb-2">Procédure de connexion</h3>
                        <ol className="space-y-4 text-zinc-300 text-sm list-decimal list-inside marker:text-orange-500 marker:font-bold">
                            <li className="pl-2">Ouvrez <strong>WhatsApp</strong> sur votre mobile.</li>
                            <li className="pl-2">Menu <strong>⋮</strong> ou <strong>Réglages</strong>.</li>
                            <li className="pl-2">Allez dans <strong>Appareils connectés</strong>.</li>
                            <li className="pl-2">Appuyez sur <span className="text-orange-500 font-bold">Connecter un appareil</span>.</li>
                            <li className="pl-2">Scannez le code affiché.</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WhatsAppConnect;
