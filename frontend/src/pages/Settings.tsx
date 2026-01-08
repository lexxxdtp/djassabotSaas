
import { useState, useEffect } from 'react';
import { Bot, Store, Truck, Clock, MapPin, QrCode, Trash2, PlusCircle, CheckCircle, User } from 'lucide-react';
import WhatsAppConnect from './WhatsAppConnect';
import AIPlayground from '../components/AIPlayground';
import { getApiUrl } from '../utils/apiConfig';

import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { token, user, login } = useAuth(); // Need login to update context on save
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'identity' | 'business' | 'logistics' | 'whatsapp' | 'simulation'>('identity');

    // User Profile Config
    const [userProfile, setUserProfile] = useState<{
        fullName: string;
        email: string;
        phone: string;
        birthDate: string;
    }>({
        fullName: '',
        email: '',
        phone: '',
        birthDate: ''
    });

    const [config, setConfig] = useState<{
        botName: string;
        language: string;
        persona: string;
        greeting: string;
        politeness: string;
        emojiLevel: string;
        responseLength: string;
        trainingExamples: { question: string; answer: string }[];
        negotiationFlexibility: number;
        voiceEnabled: boolean;
        systemInstructions: string;
        storeName: string;
        address: string;
        phone: string;
        hours: string;
        returnPolicy: string;
        deliveryAbidjanPrice: number;
        deliveryInteriorPrice: number;
        freeDeliveryThreshold: number;
        acceptedPayments: string[];
    }>({
        // Identity
        botName: 'Awa',
        language: 'fr',
        persona: 'friendly',
        greeting: 'Bonjour ! Je suis Awa, votre assistante virtuelle. Comment puis-je vous aider ?',
        // New Personality Fields
        politeness: 'informal',
        emojiLevel: 'medium',
        responseLength: 'medium',
        trainingExamples: [
            { question: '', answer: '' },
            { question: '', answer: '' }
        ],
        negotiationFlexibility: 5, // 0 (Strict) to 10 (Flexible)
        voiceEnabled: true,
        systemInstructions: '', // Instructions spécifiques du vendeur

        // Business
        storeName: 'Ma Boutique Mode',
        address: 'Cocody Riviera 2, Abidjan',
        phone: '+225 07 00 00 00 00',
        hours: '08:00 - 20:00',
        returnPolicy: 'satisfait_rembourse', // or 'ni_repris'

        // Logistics
        deliveryAbidjanPrice: 1500,
        deliveryInteriorPrice: 3000,
        freeDeliveryThreshold: 50000,
        acceptedPayments: ['wave', 'om', 'cash'],
    });

    const API_URL = getApiUrl();

    useEffect(() => {
        if (!token) return;

        // Fetch Business Settings
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/settings`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setConfig(prev => ({ ...prev, ...data }));
                }
            } catch (error) {
                console.error('Failed to fetch settings', error);
            }
        };

        // Fetch User Profile
        const fetchProfile = async () => {
            try {
                const res = await fetch(`${API_URL}/auth/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        setUserProfile({
                            fullName: data.user.full_name || '',
                            email: data.user.email || '',
                            phone: data.user.phone || '',
                            birthDate: data.user.birth_date ? new Date(data.user.birth_date).toISOString().split('T')[0] : ''
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to fetch profile', error);
            }
        };

        fetchSettings();
        fetchProfile();
    }, [token]);

    const handleSave = async () => {
        if (!token) {
            alert('Vous devez être connecté pour sauvegarder.');
            return;
        }

        setLoading(true);
        try {
            if (activeTab === 'profile') {
                // Save User Profile
                const res = await fetch(`${API_URL}/auth/me`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        full_name: userProfile.fullName,
                        email: userProfile.email,
                        phone: userProfile.phone,
                        birth_date: userProfile.birthDate
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    alert('Profil mis à jour avec succès !');
                } else {
                    const err = await res.json();
                    alert(err.error || 'Erreur lors de la mise à jour du profil.');
                }
            } else {
                // Save Settings
                const res = await fetch(`${API_URL}/settings`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(config)
                });

                if (res.ok) {
                    alert('Configuration sauvegardée !');
                } else {
                    alert('Erreur lors de la sauvegarde.');
                }
            }
        } catch (e) {
            console.error(e);
            alert('Erreur de connexion.');
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ id, label, icon: Icon }: any) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all text-sm border ${activeTab === id
                ? 'bg-orange-500 text-black border-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                }`}
        >
            <Icon size={16} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Configuration Neurons 🧠</h1>
                    <p className="text-zinc-500 text-sm">Paramétrez l'intelligence artificielle et votre profil.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all text-sm"
                >
                    {loading ? <span className="animate-spin">⏳</span> : <CheckCircle size={18} className="text-orange-600" />}
                    <span>{loading ? 'Sauvegarde...' : 'Appliquer les modifications'}</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-3 pb-2">
                <TabButton id="profile" label="Mon Profil" icon={User} />
                <TabButton id="identity" label="Identité & IA" icon={Bot} />
                <TabButton id="business" label="Infos Boutique" icon={Store} />
                <TabButton id="logistics" label="Logistique" icon={Truck} />
                <TabButton id="whatsapp" label="Connexion" icon={QrCode} />
                <TabButton id="simulation" label="Test & Simulation" icon={Bot} />
            </div>

            {/* Content */}
            <div className="grid gap-6">

                {/* --- TAB 0: MON PROFIL --- */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Mes Informations Personnelles
                            </h2>

                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Nom Complet</label>
                                    <input
                                        type="text"
                                        value={userProfile.fullName}
                                        onChange={e => setUserProfile({ ...userProfile, fullName: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-700"
                                        placeholder="Votre nom"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Date de Naissance</label>
                                    <input
                                        type="date"
                                        value={userProfile.birthDate}
                                        onChange={e => setUserProfile({ ...userProfile, birthDate: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Téléphone</label>
                                    <input
                                        type="text"
                                        value={userProfile.phone}
                                        onChange={e => setUserProfile({ ...userProfile, phone: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-700"
                                        placeholder="+225..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Email (Optionnel)</label>
                                    <input
                                        type="email"
                                        value={userProfile.email}
                                        onChange={e => setUserProfile({ ...userProfile, email: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-700"
                                        placeholder="email@exemple.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 1: IDENTITY --- */}
                {activeTab === 'identity' && (
                    <div className="space-y-6">
                        {/* Base Identity & Personality */}
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 backdrop-blur-sm">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Personnalité du Vendeur
                            </h2>

                            {/* Ligne 1 : Nom & Style Global */}
                            <div className="grid md:grid-cols-2 gap-8 mb-8">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Nom de l'Avatar</label>
                                    <input
                                        type="text"
                                        value={config.botName}
                                        onChange={e => setConfig({ ...config, botName: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all placeholder:text-zinc-700"
                                        placeholder="Ex: Awa"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Archétype</label>
                                    <select
                                        value={config.persona}
                                        onChange={e => setConfig({ ...config, persona: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="professional">🤵 Professionnel & Distingué</option>
                                        <option value="friendly">😊 Amical & Chaleureux</option>
                                        <option value="humorous">😂 Drôle & Ivoirien (Enjaillement)</option>
                                        <option value="assertive">🔥 Dynamique & Offensif</option>
                                    </select>
                                </div>
                            </div>

                            {/* Ligne 2 : Détails de Communication */}
                            <div className="grid md:grid-cols-3 gap-6 mb-8">
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Politesse</label>
                                    <select
                                        value={config.politeness || 'informal'}
                                        onChange={e => setConfig({ ...config, politeness: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none appearance-none"
                                    >
                                        <option value="formal">Vous (Vouvoiement)</option>
                                        <option value="informal">Tu (Tutoiement)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Emojis</label>
                                    <select
                                        value={config.emojiLevel || 'medium'}
                                        onChange={e => setConfig({ ...config, emojiLevel: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none appearance-none"
                                    >
                                        <option value="high">🌟 Beaucoup</option>
                                        <option value="medium">🙂 Modéré</option>
                                        <option value="low">😐 Rarement</option>
                                        <option value="none">🚫 Aucun</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Longueur Réponses</label>
                                    <select
                                        value={config.responseLength || 'medium'}
                                        onChange={e => setConfig({ ...config, responseLength: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none appearance-none"
                                    >
                                        <option value="short">⚡️ Concis</option>
                                        <option value="medium">📝 Équilibré</option>
                                        <option value="long">📖 Détaillé</option>
                                    </select>
                                </div>
                            </div>

                            {/* Instructions Spécifiques */}
                            <div className="mt-8">
                                <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">
                                    Prompt Système (Cerveau)
                                </label>
                                <textarea
                                    value={config.systemInstructions}
                                    onChange={e => setConfig({ ...config, systemInstructions: e.target.value })}
                                    placeholder="Décrivez ici la personnalité exacte, les phrases types, et les interdits..."
                                    rows={5}
                                    className="w-full bg-black border border-zinc-800 rounded-lg p-4 text-white focus:border-orange-500 outline-none placeholder:text-zinc-700 leading-relaxed font-mono text-sm"
                                />
                            </div>

                            {/* Exemples (Few-Shot) */}
                            <div className="mt-8 bg-black/40 p-6 rounded-lg border border-zinc-800">
                                <label className="block text-xs font-bold text-orange-500 mb-4 uppercase tracking-wide flex items-center gap-2">
                                    <CheckCircle size={14} /> Entraînement par l'exemple (Few-Shot)
                                </label>
                                <div className="grid gap-4">
                                    {(config.trainingExamples || []).map((example, index) => (
                                        <div key={index} className="group relative grid grid-cols-1 md:grid-cols-12 gap-2 items-center bg-zinc-900 p-3 rounded-lg border border-transparent hover:border-zinc-700 transition-all">
                                            <div className="md:col-span-5">
                                                <input
                                                    type="text"
                                                    placeholder={`Question type ${index + 1}`}
                                                    value={example.question}
                                                    onChange={(e) => {
                                                        const newExamples = [...(config.trainingExamples || [])];
                                                        newExamples[index] = { ...newExamples[index], question: e.target.value };
                                                        setConfig({ ...config, trainingExamples: newExamples });
                                                    }}
                                                    className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:border-orange-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="hidden md:flex md:col-span-1 justify-center text-zinc-600">➜</div>
                                            <div className="md:col-span-5">
                                                <input
                                                    type="text"
                                                    placeholder={`Réponse attendue ${index + 1}`}
                                                    value={example.answer}
                                                    onChange={(e) => {
                                                        const newExamples = [...(config.trainingExamples || [])];
                                                        newExamples[index] = { ...newExamples[index], answer: e.target.value };
                                                        setConfig({ ...config, trainingExamples: newExamples });
                                                    }}
                                                    className="w-full bg-black border border-zinc-800 rounded px-3 py-2 text-xs text-white placeholder:text-zinc-700 focus:border-orange-500 outline-none transition-all"
                                                />
                                            </div>
                                            <div className="md:col-span-1 flex justify-center">
                                                <button
                                                    onClick={() => {
                                                        const newExamples = config.trainingExamples.filter((_, i) => i !== index);
                                                        setConfig({ ...config, trainingExamples: newExamples });
                                                    }}
                                                    className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => {
                                        const newExamples = [...(config.trainingExamples || []), { question: '', answer: '' }];
                                        setConfig({ ...config, trainingExamples: newExamples });
                                    }}
                                    className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-orange-500 hover:text-orange-400 hover:bg-orange-950/30 px-4 py-3 rounded border border-dashed border-orange-900 hover:border-orange-500/50 transition-all w-full uppercase tracking-wide"
                                >
                                    <PlusCircle size={14} />
                                    Ajouter un exemple
                                </button>
                            </div>

                        </div>

                        {/* Negotiation Intelligence */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 backdrop-blur-sm">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-pink-500"></span> Négociation
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-2">
                                        <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Taux de Flexibilité</label>
                                        <span className="text-orange-500 font-bold font-mono">{config.negotiationFlexibility * 10}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0" max="10" step="1"
                                        value={config.negotiationFlexibility}
                                        onChange={e => setConfig({ ...config, negotiationFlexibility: parseInt(e.target.value) })}
                                        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-neutral-600 mt-2 uppercase font-bold tracking-widest">
                                        <span>Strict (0%)</span>
                                        <span>Open Bar (100%)</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Message d'accroche (First contact)</label>
                                    <textarea
                                        value={config.greeting}
                                        onChange={e => setConfig({ ...config, greeting: e.target.value })}
                                        rows={2}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none placeholder:text-neutral-700"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 2: BUSINESS --- */}
                {activeTab === 'business' && (
                    <div className="space-y-6">
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Point de Vente
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Adresse</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                                        <input
                                            type="text"
                                            value={config.address}
                                            onChange={e => setConfig({ ...config, address: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 rounded-lg p-3 pl-10 text-white focus:border-orange-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Horaires</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                                        <input
                                            type="text"
                                            value={config.hours}
                                            onChange={e => setConfig({ ...config, hours: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 rounded-lg p-3 pl-10 text-white focus:border-orange-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Politique Retour</label>
                                    <select
                                        value={config.returnPolicy}
                                        onChange={e => setConfig({ ...config, returnPolicy: e.target.value })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none appearance-none"
                                    >
                                        <option value="satisfait_rembourse">✅ Satisfait ou Remboursé</option>
                                        <option value="echange_only">🔄 Échange uniquement</option>
                                        <option value="ni_repris">❌ Vente finale</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 3: LOGISTICS --- */}
                {activeTab === 'logistics' && (
                    <div className="space-y-6">
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Expédition
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Livraison Abidjan</label>
                                    <input
                                        type="number"
                                        value={config.deliveryAbidjanPrice}
                                        onChange={e => setConfig({ ...config, deliveryAbidjanPrice: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Livraison Intérieur</label>
                                    <input
                                        type="number"
                                        value={config.deliveryInteriorPrice}
                                        onChange={e => setConfig({ ...config, deliveryInteriorPrice: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Seuil Livraison Gratuite</label>
                                    <input
                                        type="number"
                                        value={config.freeDeliveryThreshold}
                                        onChange={e => setConfig({ ...config, freeDeliveryThreshold: parseInt(e.target.value) })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-yellow-500"></span> Paiement
                            </h2>
                            <div className="flex flex-wrap gap-3">
                                {[
                                    { id: 'wave', label: 'Wave' },
                                    { id: 'om', label: 'Orange Money' },
                                    { id: 'mtn', label: 'MTN Money' },
                                    { id: 'cash', label: 'Espèces (Cash)' },
                                    { id: 'bank_transfer', label: 'Virement' }
                                ].map((method) => {
                                    const isChecked = config.acceptedPayments.includes(method.id);
                                    return (
                                        <label
                                            key={method.id}
                                            className={`flex items-center gap-2 bg-black border rounded-lg px-4 py-3 cursor-pointer select-none transition-all ${isChecked ? 'border-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.1)]' : 'border-neutral-800 hover:border-neutral-700'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isChecked ? 'border-orange-500 bg-orange-500' : 'border-neutral-600'}`}>
                                                {isChecked && <div className="w-1.5 h-1.5 bg-black rounded-full" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    const newPayments = isChecked
                                                        ? config.acceptedPayments.filter(p => p !== method.id)
                                                        : [...config.acceptedPayments, method.id];
                                                    setConfig({ ...config, acceptedPayments: newPayments });
                                                }}
                                                className="hidden"
                                            />
                                            <span className="text-sm font-medium text-white">{method.label}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'whatsapp' && (
                    <div className="space-y-6">
                        <WhatsAppConnect />
                    </div>
                )}

                {/* --- TAB 4: SIMULATION --- */}
                {activeTab === 'simulation' && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Left Col: Explainer */}
                            <div className="md:col-span-1 space-y-6">
                                <div className="bg-gradient-to-br from-emerald-900/30 to-black border border-emerald-900/50 rounded-xl p-6">
                                    <h3 className="text-white font-bold text-lg mb-2">Zone de Test</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Testez votre bot en temps réel. Les modifications faites dans "Identité" ou "Logistique" sont prises en compte immédiatement ici.
                                    </p>
                                    <ul className="mt-4 space-y-2 text-xs text-zinc-500">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                            Simulation d'achat
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                            Test de la personnalité
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                            Vérification des règles
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Right Col: Chat Interface */}
                            <div className="md:col-span-2">
                                <AIPlayground />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
