
import { useState, useEffect } from 'react';
import { Bot, Store, Clock, MapPin, QrCode, Trash2, PlusCircle, CheckCircle, User, Sparkles } from 'lucide-react';
import WhatsAppConnect from './WhatsAppConnect';
import AIPlayground from '../components/AIPlayground';
import { getApiUrl } from '../utils/apiConfig';

// Communication Styles with presets - Each style auto-configures all personality parameters
const COMMUNICATION_STYLES = [
    {
        id: 'professional',
        icon: '🎩',
        name: 'Professionnel',
        description: 'Vouvoiement, formel, sans emojis',
        presets: { politeness: 'formal', emojiLevel: 'none', slangLevel: 'none', humorLevel: 'low' }
    },
    {
        id: 'friendly',
        icon: '😊',
        name: 'Amical',
        description: 'Tutoiement, emojis modérés, chaleureux',
        recommended: true,
        presets: { politeness: 'informal', emojiLevel: 'medium', slangLevel: 'low', humorLevel: 'medium' }
    },
    {
        id: 'commercial',
        icon: '📣',
        name: 'Commercial',
        description: 'Direct, persuasif, focus vente',
        presets: { politeness: 'informal', emojiLevel: 'high', slangLevel: 'low', humorLevel: 'low' }
    },
    {
        id: 'local',
        icon: '🗣️',
        name: 'Local / Ivoirien',
        description: 'Expressions locales, très décontracté',
        presets: { politeness: 'informal', emojiLevel: 'high', slangLevel: 'high', humorLevel: 'high' }
    }
];

import { useAuth } from '../context/AuthContext';

export default function Settings() {
    const { token } = useAuth(); // Need login to update context on save
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'identity' | 'business' | 'whatsapp' | 'simulation'>('identity');

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
        humorLevel: string; // New
        slangLevel: string; // New
        responseLength: string;
        trainingExamples: { question: string; answer: string }[];
        negotiationEnabled: boolean;
        negotiationFlexibility: number;
        voiceEnabled: boolean;
        systemInstructions: string;
        storeName: string;
        businessType: string;
        address: string;
        locationUrl: string;
        gpsCoordinates: string;
        phone: string;
        socialMedia: {
            facebook: string;
            instagram: string;
            tiktok: string;
            website: string;
        };
        hours: string;
        returnPolicy: string;
        policyDescription: string;
        deliveryAbidjanPrice: number;
        deliveryInteriorPrice: number;
        freeDeliveryThreshold: number;
        acceptedPayments: string[];
        settlementBank?: string;
        settlementAccount?: string;
        notificationPhone?: string;
    }>({
        // Identity
        botName: 'Awa',
        language: 'fr',
        persona: 'friendly',
        greeting: 'Bonjour ! Je suis Awa, votre assistante virtuelle. Comment puis-je vous aider ?',
        // New Personality Fields
        politeness: 'informal',
        emojiLevel: 'medium',
        humorLevel: 'medium',
        slangLevel: 'low',
        responseLength: 'medium',
        trainingExamples: [
            { question: '', answer: '' },
            { question: '', answer: '' }
        ],
        negotiationEnabled: true,
        negotiationFlexibility: 5, // 0 (Strict) to 10 (Flexible)
        voiceEnabled: true,
        systemInstructions: '', // Instructions spécifiques du vendeur

        // Business
        storeName: 'Ma Boutique Mode',
        businessType: 'Mode & Vêtements', // New
        address: 'Cocody Riviera 2, Abidjan',
        locationUrl: '', // New: Google Maps URL
        gpsCoordinates: '', // New
        phone: '+225 07 00 00 00 00',
        socialMedia: { // New
            facebook: '',
            instagram: '',
            tiktok: '',
            website: ''
        },
        hours: '08:00 - 20:00',
        returnPolicy: 'satisfait_rembourse',
        policyDescription: '', // New: Long text description
        notificationPhone: '', // New

        // Logistics
        deliveryAbidjanPrice: 1500,
        deliveryInteriorPrice: 3000,
        freeDeliveryThreshold: 50000,
        acceptedPayments: ['wave', 'om', 'cash'],
        // Vendor Payment
        settlementBank: '',
        settlementAccount: '',
    });

    const [paystackSubaccountCode, setPaystackSubaccountCode] = useState<string | null>(null);

    const [aiSummary, setAiSummary] = useState('');
    const [summarizing, setSummarizing] = useState(false);

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
                    if (data.tenant && data.tenant.paystackSubaccountCode) {
                        setPaystackSubaccountCode(data.tenant.paystackSubaccountCode);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch profile', error);
            }
        };

        fetchSettings();
        fetchProfile();
    }, [token, API_URL]);

    // Load cached summary on mount to save API quota
    useEffect(() => {
        const saved = localStorage.getItem('aiSummary');
        if (saved) setAiSummary(saved);
    }, []);

    const handleGenerateSummary = async () => {
        if (!token) return;
        setSummarizing(true);
        try {
            const res = await fetch(`${API_URL}/ai/summarize-identity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(config)
            });
            const data = await res.json();
            if (data.summary) {
                setAiSummary(data.summary);
                localStorage.setItem('aiSummary', data.summary);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSummarizing(false);
        }
    };

    const handleSetupVendor = async () => {
        if (!token) return;
        if (!config.settlementBank || !config.settlementAccount) {
            alert('Veuillez renseigner votre banque et numéro de compte.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/paystack/setup-vendor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    settlement_bank: config.settlementBank,
                    account_number: config.settlementAccount,
                    percentage_charge: 2 // 2% commission par défaut
                })
            });

            const data = await res.json();
            if (res.ok) {
                setPaystackSubaccountCode(data.subaccount_code);
                alert('Compte vendeur configuré avec succès ! Vos futurs paiements seront automatisés.');
            } else {
                throw new Error(data.error || 'Erreur inconnue');
            }
        } catch (e: unknown) {
            console.error(e);
            if (e instanceof Error) {
                alert('Erreur: ' + e.message);
            } else {
                alert('Erreur inconnue');
            }
        } finally {
            setLoading(false);
        }
    };

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
                    await res.json();
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
                    const errorData = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
                    alert(`Erreur lors de la sauvegarde : ${errorData.error || 'Problème serveur'}\n${errorData.details || ''}`);
                }
            }
        } catch (e) {
            const error = e instanceof Error ? e : new Error('Unknown error');
            console.error(error);
            alert('Erreur de connexion : ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    type TabId = 'profile' | 'business' | 'identity' | 'whatsapp' | 'simulation';

    const TabButton = ({ id, label, icon: Icon }: { id: TabId; label: string; icon: React.ElementType }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all text-sm border ${activeTab === id
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : 'bg-white/5 text-zinc-400 border-white/5 hover:bg-white/10 hover:text-white'
                }`}
        >
            <Icon size={16} />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Configuration Neurons 🧠</h1>
                    <p className="text-zinc-400 text-sm">Paramétrez l'intelligence artificielle et votre profil.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition-all text-sm shadow-lg shadow-white/10"
                >
                    {loading ? <span className="animate-spin">⏳</span> : <CheckCircle size={18} className="text-indigo-600" />}
                    <span>{loading ? 'Sauvegarde...' : 'Appliquer les modifications'}</span>
                </button>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-3 pb-2">
                <TabButton id="profile" label="Mon Profil" icon={User} />
                <TabButton id="identity" label="Identité & IA" icon={Bot} />
                <TabButton id="business" label="Infos Boutique" icon={Store} />
                <TabButton id="whatsapp" label="Connexion" icon={QrCode} />
                <TabButton id="simulation" label="Test & Simulation" icon={Bot} />
            </div>

            {/* Content */}
            <div className="grid gap-6">

                {/* --- TAB 0: MON PROFIL --- */}
                {activeTab === 'profile' && (
                    <div className="space-y-6">
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8 backdrop-blur-sm">
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
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                                        placeholder="Votre nom"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Date de Naissance</label>
                                    <input
                                        type="date"
                                        value={userProfile.birthDate}
                                        onChange={e => setUserProfile({ ...userProfile, birthDate: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Téléphone</label>
                                    <input
                                        type="text"
                                        value={userProfile.phone}
                                        onChange={e => setUserProfile({ ...userProfile, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                                        placeholder="+225..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Email (Optionnel)</label>
                                    <input
                                        type="email"
                                        value={userProfile.email}
                                        onChange={e => setUserProfile({ ...userProfile, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                                        placeholder="email@exemple.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB 1: IDENTITY (Simplified Design) --- */}
                {activeTab === 'identity' && (
                    <div className="space-y-6">

                        {/* 1. Identité de Base */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Identité de l'Assistant
                            </h2>

                            <div className="flex items-start gap-6">
                                {/* Avatar Preview */}
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg shrink-0">
                                    {config.botName.substring(0, 1) || 'A'}
                                </div>

                                {/* Name & Greeting */}
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Nom de l'Assistant</label>
                                        <input
                                            type="text"
                                            value={config.botName}
                                            onChange={e => setConfig({ ...config, botName: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-lg font-bold focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                                            placeholder="Ex: Awa, Koffi, Maya..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Message d'accueil</label>
                                        <input
                                            type="text"
                                            value={config.greeting}
                                            onChange={e => setConfig({ ...config, greeting: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-zinc-600"
                                            placeholder="Bonjour ! Comment puis-je vous aider ?"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Style de Communication */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span> Style de Communication
                            </h2>
                            <p className="text-zinc-500 text-sm mb-6">Choisissez comment votre assistant s'adresse aux clients.</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {COMMUNICATION_STYLES.map(style => {
                                    const isActive = config.persona === style.id;
                                    return (
                                        <button
                                            key={style.id}
                                            onClick={() => setConfig({
                                                ...config,
                                                persona: style.id,
                                                ...style.presets // Apply all presets at once
                                            })}
                                            className={`relative p-5 rounded-xl border text-left transition-all group ${isActive
                                                ? 'bg-indigo-500/10 border-indigo-500/50 ring-2 ring-indigo-500/30'
                                                : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                        >
                                            {/* Selection Indicator */}
                                            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isActive ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'
                                                }`}>
                                                {isActive && <CheckCircle size={12} className="text-white" />}
                                            </div>

                                            {/* Recommended Badge */}
                                            {'recommended' in style && style.recommended && (
                                                <div className="absolute top-4 left-4 text-[9px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                    Recommandé
                                                </div>
                                            )}

                                            {/* Content */}
                                            <div className="flex items-center gap-4 mt-2">
                                                <span className="text-3xl">{style.icon}</span>
                                                <div>
                                                    <div className="font-bold text-white text-base">{style.name}</div>
                                                    <div className="text-xs text-zinc-400 mt-1">{style.description}</div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Options Rapides (Toggles) */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-pink-500"></span> Options
                            </h2>

                            <div className="space-y-4">
                                {/* Negotiation Toggle */}
                                <div className="flex items-center justify-between bg-white/5 border border-white/5 p-4 rounded-lg">
                                    <div>
                                        <div className="text-sm font-bold text-white">Négociation des prix</div>
                                        <div className="text-xs text-zinc-500">L'IA peut accepter des baisses de prix raisonnables</div>
                                    </div>
                                    <button
                                        onClick={() => setConfig({ ...config, negotiationEnabled: !config.negotiationEnabled })}
                                        className={`w-14 h-7 rounded-full p-1 transition-colors ${config.negotiationEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${config.negotiationEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {/* Voice Toggle */}
                                <div className="flex items-center justify-between bg-white/5 border border-white/5 p-4 rounded-lg">
                                    <div>
                                        <div className="text-sm font-bold text-white">Réponses vocales</div>
                                        <div className="text-xs text-zinc-500">Envoyer des messages audio en plus du texte</div>
                                    </div>
                                    <button
                                        onClick={() => setConfig({ ...config, voiceEnabled: !config.voiceEnabled })}
                                        className={`w-14 h-7 rounded-full p-1 transition-colors ${config.voiceEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${config.voiceEnabled ? 'translate-x-7' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 4. Section Avancée (Collapsible) */}
                        <details className="group">
                            <summary className="bg-[#0a0c10] border border-white/5 rounded-xl p-6 cursor-pointer list-none flex items-center justify-between hover:bg-white/5 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="w-2 h-2 rounded-full bg-zinc-500"></span>
                                    <span className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Options Avancées</span>
                                </div>
                                <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
                            </summary>

                            <div className="mt-4 space-y-6">
                                {/* Instructions Personnalisées */}
                                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <Bot size={16} className="text-zinc-400" /> Instructions Personnalisées
                                    </h3>
                                    <p className="text-xs text-zinc-500 mb-4">Donnez des ordres spécifiques à l'IA (ex: "Ne jamais donner le prix sans demander la taille")</p>
                                    <textarea
                                        value={config.systemInstructions}
                                        onChange={e => setConfig({ ...config, systemInstructions: e.target.value })}
                                        placeholder="Ex: Toujours demander la couleur préférée avant de proposer un produit..."
                                        rows={4}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 leading-relaxed text-sm"
                                    />
                                </div>

                                {/* Exemples d'Entraînement */}
                                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                                    <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                        <Sparkles size={16} className="text-zinc-400" /> Exemples d'Entraînement
                                    </h3>
                                    <p className="text-xs text-zinc-500 mb-4">Montrez à l'IA comment répondre à certaines questions</p>

                                    <div className="space-y-3">
                                        {(config.trainingExamples || []).map((example, index) => (
                                            <div key={index} className="grid grid-cols-1 md:grid-cols-11 gap-2 items-center bg-white/5 p-3 rounded-lg">
                                                <div className="md:col-span-5">
                                                    <input
                                                        type="text"
                                                        placeholder="Client: ..."
                                                        value={example.question}
                                                        onChange={(e) => {
                                                            const newExamples = [...(config.trainingExamples || [])];
                                                            newExamples[index] = { ...newExamples[index], question: e.target.value };
                                                            setConfig({ ...config, trainingExamples: newExamples });
                                                        }}
                                                        className="w-full bg-black/30 border border-white/5 rounded px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="hidden md:flex md:col-span-1 justify-center text-zinc-600 text-lg">→</div>
                                                <div className="md:col-span-4">
                                                    <input
                                                        type="text"
                                                        placeholder="Réponse idéale..."
                                                        value={example.answer}
                                                        onChange={(e) => {
                                                            const newExamples = [...(config.trainingExamples || [])];
                                                            newExamples[index] = { ...newExamples[index], answer: e.target.value };
                                                            setConfig({ ...config, trainingExamples: newExamples });
                                                        }}
                                                        className="w-full bg-black/30 border border-white/5 rounded px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                                <div className="md:col-span-1 flex justify-center">
                                                    <button
                                                        onClick={() => {
                                                            const newExamples = config.trainingExamples.filter((_, i) => i !== index);
                                                            setConfig({ ...config, trainingExamples: newExamples });
                                                        }}
                                                        className="p-2 text-zinc-600 hover:text-red-500 transition-colors"
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
                                        className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-indigo-400 hover:text-indigo-300 px-4 py-3 rounded border border-dashed border-indigo-900/50 hover:border-indigo-500/50 transition-all w-full"
                                    >
                                        <PlusCircle size={14} />
                                        Ajouter un exemple
                                    </button>
                                </div>
                            </div>
                        </details>

                    </div>
                )}

                {/* --- TAB 2: BUSINESS --- */}
                {activeTab === 'business' && (
                    <div className="space-y-6">
                        {/* 1. Identité de la Boutique */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Identité de la Boutique
                            </h2>
                            <div className="space-y-6">
                                {/* Nom de la Boutique */}
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Nom de la Boutique</label>
                                    <input
                                        type="text"
                                        value={config.storeName}
                                        onChange={e => setConfig({ ...config, storeName: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-lg font-bold focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                        placeholder="Ex: Ma Boutique Mode, Chez Fatou..."
                                    />
                                    <p className="text-[10px] text-zinc-500 mt-1">Ce nom sera utilisé par l'IA pour se présenter aux clients.</p>
                                </div>

                                {/* Secteur d'Activité */}
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Secteur d'Activité</label>
                                    <div className="space-y-3">
                                        <select
                                            value={['Mode & Vêtements', 'Chaussures & Sneakers', 'Beauté & Cosmétiques', 'Électronique & Gadgets', 'Restauration & Fast-Food', 'Épicerie & Supermarché', 'Immobilier & Location', 'Services & Consulting', 'Automobile & Pièces', 'Bijouterie & Accessoires'].includes(config.businessType) ? config.businessType : 'Autre'}
                                            onChange={e => {
                                                if (e.target.value === 'Autre') {
                                                    setConfig({ ...config, businessType: '' });
                                                } else {
                                                    setConfig({ ...config, businessType: e.target.value });
                                                }
                                            }}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none appearance-none"
                                        >
                                            <option value="Mode & Vêtements" className="bg-zinc-900 text-white">Mode & Vêtements (Fashion)</option>
                                            <option value="Chaussures & Sneakers" className="bg-zinc-900 text-white">Chaussures & Sneakers</option>
                                            <option value="Beauté & Cosmétiques" className="bg-zinc-900 text-white">Beauté & Cosmétiques</option>
                                            <option value="Électronique & Gadgets" className="bg-zinc-900 text-white">Électronique & Gadgets</option>
                                            <option value="Restauration & Fast-Food" className="bg-zinc-900 text-white">Restauration & Fast-Food</option>
                                            <option value="Épicerie & Supermarché" className="bg-zinc-900 text-white">Épicerie & Supermarché</option>
                                            <option value="Immobilier & Location" className="bg-zinc-900 text-white">Immobilier & Location</option>
                                            <option value="Services & Consulting" className="bg-zinc-900 text-white">Services & Consulting</option>
                                            <option value="Automobile & Pièces" className="bg-zinc-900 text-white">Automobile & Pièces</option>
                                            <option value="Bijouterie & Accessoires" className="bg-zinc-900 text-white">Bijouterie & Accessoires</option>
                                            <option value="Autre" className="bg-zinc-900 text-white">Autre (Personnalisé)</option>
                                        </select>

                                        {(!['Mode & Vêtements', 'Chaussures & Sneakers', 'Beauté & Cosmétiques', 'Électronique & Gadgets', 'Restauration & Fast-Food', 'Épicerie & Supermarché', 'Immobilier & Location', 'Services & Consulting', 'Automobile & Pièces', 'Bijouterie & Accessoires'].includes(config.businessType)) && (
                                            <input
                                                type="text"
                                                value={config.businessType}
                                                onChange={e => setConfig({ ...config, businessType: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 animate-in fade-in slide-in-from-top-2"
                                                placeholder="Précisez votre activité (ex: Boulangerie Artisanale)..."
                                                autoFocus
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Coordonnées & Réseaux */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Contacts & Réseaux
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Téléphone Business</label>
                                    <input
                                        type="text"
                                        value={config.phone}
                                        onChange={e => setConfig({ ...config, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                        placeholder="+225..."
                                    />
                                </div>
                                <div className="md:col-span-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                                    <label className="block text-xs font-bold text-indigo-400 mb-2 uppercase tracking-wide">
                                        🔔 Numéro de Notification Admin / Livreur (Très Important)
                                    </label>
                                    <p className="text-[10px] text-indigo-300 mb-2">C'est sur ce numéro que vous recevrez les alertes de nouvelles commandes formatées pour les livreurs.</p>
                                    <input
                                        type="text"
                                        value={config.notificationPhone || ''}
                                        onChange={e => setConfig({ ...config, notificationPhone: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 font-mono"
                                        placeholder="Ex: 2250707..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Site Web</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.website || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, website: e.target.value } })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Facebook URL</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.facebook || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, facebook: e.target.value } })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                        placeholder="facebook.com/page..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Instagram URL</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.instagram || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, instagram: e.target.value } })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                        placeholder="instagram.com/user..."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">TikTok URL</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.tiktok || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, tiktok: e.target.value } })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                        placeholder="tiktok.com/@user..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Localisation */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Localisation
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Adresse Physique</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                                        <input
                                            type="text"
                                            value={config.address}
                                            onChange={e => setConfig({ ...config, address: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                            placeholder="Quartier, Ville, Commune..."
                                        />
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Lien Google Maps</label>
                                        <input
                                            type="text"
                                            value={config.locationUrl || ''}
                                            onChange={e => setConfig({ ...config, locationUrl: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                            placeholder="https://maps.google.com/..."
                                        />
                                    </div>
                                    <div>
                                        <div>
                                            <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Coordonnées GPS</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={config.gpsCoordinates || ''}
                                                    onChange={e => setConfig({ ...config, gpsCoordinates: e.target.value })}
                                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                                    placeholder="5.3600, -3.9000"
                                                />
                                                <button
                                                    onClick={() => {
                                                        if (navigator.geolocation) {
                                                            navigator.geolocation.getCurrentPosition(
                                                                (position) => {
                                                                    const coords = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
                                                                    setConfig({ ...config, gpsCoordinates: coords });
                                                                },
                                                                (error) => {
                                                                    alert('Erreur de géolocalisation: ' + error.message);
                                                                }
                                                            );
                                                        } else {
                                                            alert('La géolocalisation n\'est pas supportée par ce navigateur.');
                                                        }
                                                    }}
                                                    className="bg-white/5 hover:bg-white/10 text-white p-3 rounded-lg transition-colors border border-white/5"
                                                    title="Me géolocaliser"
                                                >
                                                    <MapPin size={20} className="text-indigo-500" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Politique & Fonctionnement */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Politique & Fonctionnement
                            </h2>
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Horaires d'Ouverture</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 w-4 h-4" />
                                            <input
                                                type="text"
                                                value={config.hours}
                                                onChange={e => setConfig({ ...config, hours: e.target.value })}
                                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                                placeholder="Lun-Sam: 08h-20h"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Politique Retour (Simple)</label>
                                        <select
                                            value={config.returnPolicy}
                                            onChange={e => setConfig({ ...config, returnPolicy: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none appearance-none"
                                        >
                                            <option value="satisfait_rembourse" className="bg-zinc-900 text-white">✅ Satisfait ou Remboursé</option>
                                            <option value="echange_only" className="bg-zinc-900 text-white">🔄 Échange uniquement</option>
                                            <option value="ni_repris" className="bg-zinc-900 text-white">❌ Vente finale</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Fonctionnement Détaillé (Politique)</label>
                                    <p className="text-[10px] text-zinc-500 mb-2">Décrivez ici comment ça marche : paiement à la livraison ou avant ? expédition jour même ? échanges sous 3 jours ? Ceci aidera l'IA à répondre précisément.</p>
                                    <textarea
                                        value={config.policyDescription || ''}
                                        onChange={e => setConfig({ ...config, policyDescription: e.target.value })}
                                        rows={6}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 leading-relaxed text-sm"
                                        placeholder="Ex: Nous livrons partout à Abidjan sous 24h. Le paiement se fait à la livraison via Wave ou Cash. Pour l'intérieur du pays, paiement avant expédition..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 5. Livraison & Frais */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span> Livraison & Frais
                            </h2>
                            <p className="text-[10px] text-zinc-500 mb-4">Ces tarifs seront utilisés par l'IA pour calculer le total des commandes.</p>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Livraison Abidjan</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={config.deliveryAbidjanPrice}
                                            onChange={e => setConfig({ ...config, deliveryAbidjanPrice: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pr-16 text-white focus:border-orange-500 outline-none"
                                            placeholder="1500"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">FCFA</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Livraison Intérieur</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={config.deliveryInteriorPrice}
                                            onChange={e => setConfig({ ...config, deliveryInteriorPrice: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pr-16 text-white focus:border-orange-500 outline-none"
                                            placeholder="3000"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">FCFA</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Seuil Livraison Gratuite</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={config.freeDeliveryThreshold}
                                            onChange={e => setConfig({ ...config, freeDeliveryThreshold: parseInt(e.target.value) || 0 })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pr-16 text-white focus:border-orange-500 outline-none"
                                            placeholder="50000"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">FCFA</span>
                                    </div>
                                    <p className="text-[10px] text-zinc-500 mt-1">Livraison offerte à partir de ce montant</p>
                                </div>
                            </div>
                        </div>

                        {/* 6. Paiement */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
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
                                            className={`flex items-center gap-2 bg-white/5 border rounded-lg px-4 py-3 cursor-pointer select-none transition-all ${isChecked ? 'border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isChecked ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-600'}`}>
                                                {isChecked && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
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

                        {/* 6. Coordonnées de Réception (Split Payments) */}
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8 relative overflow-hidden">
                            {/* Background Pattern */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs relative z-10">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Réception des Paiements
                            </h2>

                            <div className="relative z-10">
                                <p className="text-zinc-400 text-sm mb-6 max-w-2xl text-justify">
                                    Configurez votre compte money pour recevoir automatiquement vos gains.
                                    L'argent des ventes sera transféré sur ce compte (moins la commission de la plateforme).
                                </p>

                                <div className="grid md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Opérateur / Banque</label>
                                        <select
                                            value={config.settlementBank || ''}
                                            onChange={e => setConfig({ ...config, settlementBank: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none appearance-none"
                                            disabled={!!paystackSubaccountCode}
                                        >
                                            <option value="">Choisir un opérateur</option>
                                            <option value="MTN" className="bg-zinc-900 text-white">MTN Mobile Money</option>
                                            <option value="Orange Money" className="bg-zinc-900 text-white">Orange Money</option>
                                            <option value="Wave" className="bg-zinc-900 text-white">Wave</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Numéro de Compte / Téléphone</label>
                                        <input
                                            type="text"
                                            value={config.settlementAccount || ''}
                                            onChange={e => setConfig({ ...config, settlementAccount: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-emerald-500 outline-none font-mono tracking-wide placeholder:text-zinc-600"
                                            placeholder="Ex: 0504030201"
                                            disabled={!!paystackSubaccountCode}
                                        />
                                    </div>
                                </div>

                                {paystackSubaccountCode ? (
                                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                            <CheckCircle className="text-black w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-emerald-400 text-sm">Compte de paiement actif</div>
                                            <div className="text-xs text-emerald-500/70 font-mono">ID: {paystackSubaccountCode}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={handleSetupVendor}
                                        disabled={loading || !config.settlementBank || !config.settlementAccount}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                                    >
                                        {loading ? 'Configuration...' : 'Activer les Paiements Automatiques'}
                                    </button>
                                )}
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
                {/* --- TAB 4: SIMULATION --- */}
                {activeTab === 'simulation' && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Left Col: Explainer & Summary */}
                            <div className="md:col-span-1 space-y-6">
                                {/* Zone d'Explication */}
                                <div className="bg-gradient-to-br from-indigo-900/30 to-[#0a0c10] border border-indigo-500/20 rounded-xl p-6">
                                    <h3 className="text-white font-bold text-lg mb-2">Zone de Test</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Testez votre bot en temps réel.
                                    </p>
                                    <ul className="mt-4 space-y-2 text-xs text-zinc-500">
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                            Simulation d'achat
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                                            Test de la personnalité
                                        </li>
                                    </ul>
                                </div>

                                {/* Résumé IA Auto-Généré */}
                                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                            <Bot size={16} className="text-purple-500" /> Synthèse IA
                                        </h3>
                                        {aiSummary && (
                                            <button
                                                onClick={handleGenerateSummary}
                                                className="text-[10px] text-zinc-500 hover:text-white"
                                            >
                                                Regénérer
                                            </button>
                                        )}
                                    </div>

                                    {!aiSummary ? (
                                        <div className="text-center py-6">
                                            <p className="text-xs text-zinc-500 mb-4">
                                                Générez une synthèse pour voir ce que l'IA a compris de votre business.
                                            </p>
                                            <button
                                                onClick={handleGenerateSummary}
                                                disabled={summarizing}
                                                className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-600/50 px-4 py-2 rounded-lg text-xs font-bold transition-all w-full flex items-center justify-center gap-2"
                                            >
                                                {summarizing ? <span className="animate-spin">⏳</span> : <Bot size={14} />}
                                                {summarizing ? 'Analyse...' : 'Générer le Résumé'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-black/50 p-4 rounded-lg border border-white/5">
                                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap italic">
                                                "{aiSummary.replace(/\*\*/g, '')}"
                                            </p>
                                        </div>
                                    )}
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
