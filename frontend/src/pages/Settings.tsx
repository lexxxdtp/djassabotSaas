
import { useState, useEffect } from 'react';
import { Bot, Store, Clock, MapPin, QrCode, Trash2, PlusCircle, CheckCircle, User } from 'lucide-react';
import WhatsAppConnect from './WhatsAppConnect';
import AIPlayground from '../components/AIPlayground';
import { getApiUrl } from '../utils/apiConfig';

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

        // Logistics
        deliveryAbidjanPrice: 1500,
        deliveryInteriorPrice: 3000,
        freeDeliveryThreshold: 50000,
        acceptedPayments: ['wave', 'om', 'cash'],
    });

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
                }
            } catch (error) {
                console.error('Failed to fetch profile', error);
            }
        };

        fetchSettings();
        fetchProfile();
    }, [token, API_URL]);

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
        } catch (e: any) {
            console.error(e);
            alert('Erreur de connexion : ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    type TabId = 'profile' | 'business' | 'identity' | 'whatsapp' | 'simulation';

    const TabButton = ({ id, label, icon: Icon }: { id: TabId; label: string; icon: React.ElementType }) => (
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
                                        <option value="auto" className="font-bold text-orange-400">✨ Adaptatif (S'adapte au client)</option>
                                        <option value="professional">Formel & Courtois</option>
                                        <option value="friendly">Empathique & Accueillant</option>
                                        <option value="humorous">Authentique & Local</option>
                                        <option value="assertive">Commercial & Persuasif</option>
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
                                        <option value="auto" className="font-bold text-orange-400">✨ Adaptatif (Auto)</option>
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
                                        <option value="auto" className="font-bold text-orange-400">✨ Adaptatif (Auto)</option>
                                        <option value="high">Abondant</option>
                                        <option value="medium">Modéré</option>
                                        <option value="low">Minimal</option>
                                        <option value="none">Aucun</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wide">Longueur Réponses</label>
                                    <select
                                        value={config.responseLength || 'medium'}
                                        onChange={e => setConfig({ ...config, responseLength: e.target.value })}
                                        className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none appearance-none"
                                    >
                                        <option value="auto" className="font-bold text-orange-400">✨ Adaptatif (Auto)</option>
                                        <option value="short">Court & Direct</option>
                                        <option value="medium">Équilibré</option>
                                        <option value="long">Détaillé & Explicatif</option>
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

                                {/* Toggle Negotiation */}
                                <div className="flex items-center justify-between bg-black border border-neutral-800 p-4 rounded-lg">
                                    <div>
                                        <div className="text-sm font-bold text-white mb-1">Activer la Négociation</div>
                                        <div className="text-xs text-zinc-500">Si désactivé, l'IA refusera toute baisse de prix.</div>
                                    </div>
                                    <button
                                        onClick={() => setConfig({ ...config, negotiationEnabled: !config.negotiationEnabled })}
                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${config.negotiationEnabled ? 'bg-orange-500' : 'bg-zinc-700'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${config.negotiationEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                {config.negotiationEnabled && (
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
                                )}

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
                        {/* 1. Type d'Activité */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Type d'Activité
                            </h2>
                            <div>
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
                                            className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none appearance-none"
                                        >
                                            <option value="Mode & Vêtements">Mode & Vêtements (Fashion)</option>
                                            <option value="Chaussures & Sneakers">Chaussures & Sneakers</option>
                                            <option value="Beauté & Cosmétiques">Beauté & Cosmétiques</option>
                                            <option value="Électronique & Gadgets">Électronique & Gadgets</option>
                                            <option value="Restauration & Fast-Food">Restauration & Fast-Food</option>
                                            <option value="Épicerie & Supermarché">Épicerie & Supermarché</option>
                                            <option value="Immobilier & Location">Immobilier & Location</option>
                                            <option value="Services & Consulting">Services & Consulting</option>
                                            <option value="Automobile & Pièces">Automobile & Pièces</option>
                                            <option value="Bijouterie & Accessoires">Bijouterie & Accessoires</option>
                                            <option value="Autre">Autre (Personnalisé)</option>
                                        </select>

                                        {(!['Mode & Vêtements', 'Chaussures & Sneakers', 'Beauté & Cosmétiques', 'Électronique & Gadgets', 'Restauration & Fast-Food', 'Épicerie & Supermarché', 'Immobilier & Location', 'Services & Consulting', 'Automobile & Pièces', 'Bijouterie & Accessoires'].includes(config.businessType)) && (
                                            <input
                                                type="text"
                                                value={config.businessType}
                                                onChange={e => setConfig({ ...config, businessType: e.target.value })}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-white focus:border-orange-500 outline-none placeholder:text-zinc-600 animate-in fade-in slide-in-from-top-2"
                                                placeholder="Précisez votre activité (ex: Boulangerie Artisanale)..."
                                                autoFocus
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. Coordonnées & Réseaux */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
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
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        placeholder="+225..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Site Web</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.website || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, website: e.target.value } })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Facebook URL</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.facebook || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, facebook: e.target.value } })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        placeholder="facebook.com/page..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Instagram URL</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.instagram || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, instagram: e.target.value } })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        placeholder="instagram.com/user..."
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">TikTok URL</label>
                                    <input
                                        type="text"
                                        value={config.socialMedia?.tiktok || ''}
                                        onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, tiktok: e.target.value } })}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
                                        placeholder="tiktok.com/@user..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 3. Localisation */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Localisation
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Adresse Physique</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                                        <input
                                            type="text"
                                            value={config.address}
                                            onChange={e => setConfig({ ...config, address: e.target.value })}
                                            className="w-full bg-black border border-neutral-800 rounded-lg p-3 pl-10 text-white focus:border-orange-500 outline-none"
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
                                            className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
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
                                                    className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-white focus:border-orange-500 outline-none"
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
                                                    className="bg-zinc-800 hover:bg-zinc-700 text-white p-3 rounded-lg transition-colors"
                                                    title="Me géolocaliser"
                                                >
                                                    <MapPin size={20} className="text-orange-500" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Politique & Fonctionnement */}
                        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span> Politique & Fonctionnement
                            </h2>
                            <div className="space-y-6">
                                <div className="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Horaires d'Ouverture</label>
                                        <div className="relative">
                                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                                            <input
                                                type="text"
                                                value={config.hours}
                                                onChange={e => setConfig({ ...config, hours: e.target.value })}
                                                className="w-full bg-black border border-neutral-800 rounded-lg p-3 pl-10 text-white focus:border-orange-500 outline-none"
                                                placeholder="Lun-Sam: 08h-20h"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Politique Retour (Simple)</label>
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
                                <div>
                                    <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Fonctionnement Détaillé (Politique)</label>
                                    <p className="text-[10px] text-zinc-500 mb-2">Décrivez ici comment ça marche : paiement à la livraison ou avant ? expédition jour même ? échanges sous 3 jours ? Ceci aidera l'IA à répondre précisément.</p>
                                    <textarea
                                        value={config.policyDescription || ''}
                                        onChange={e => setConfig({ ...config, policyDescription: e.target.value })}
                                        rows={6}
                                        className="w-full bg-black border border-neutral-800 rounded-lg p-4 text-white focus:border-orange-500 outline-none placeholder:text-zinc-700 leading-relaxed text-sm"
                                        placeholder="Ex: Nous livrons partout à Abidjan sous 24h. Le paiement se fait à la livraison via Wave ou Cash. Pour l'intérieur du pays, paiement avant expédition..."
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 5. Paiement */}
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
                {/* --- TAB 4: SIMULATION --- */}
                {activeTab === 'simulation' && (
                    <div className="space-y-6">
                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Left Col: Explainer & Summary */}
                            <div className="md:col-span-1 space-y-6">
                                {/* Zone d'Explication */}
                                <div className="bg-gradient-to-br from-emerald-900/30 to-black border border-emerald-900/50 rounded-xl p-6">
                                    <h3 className="text-white font-bold text-lg mb-2">Zone de Test</h3>
                                    <p className="text-zinc-400 text-sm leading-relaxed">
                                        Testez votre bot en temps réel.
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
                                    </ul>
                                </div>

                                {/* Résumé IA Auto-Généré */}
                                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                            <Bot size={16} className="text-purple-500" /> Synthèse IA
                                        </h3>
                                        {aiSummary && (
                                            <button
                                                onClick={() => {
                                                    setSummarizing(true);
                                                    setTimeout(() => { // Mock call
                                                        // Call API here
                                                        setSummarizing(false);
                                                    }, 1000);
                                                }}
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
                                                onClick={async () => {
                                                    setSummarizing(true);
                                                    try {
                                                        const res = await fetch(`${API_URL}/ai/summarize-identity`, {
                                                            method: 'POST',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify(config) // Send current draft config
                                                        });
                                                        const data = await res.json();
                                                        if (data.summary) setAiSummary(data.summary);
                                                    } catch (e) {
                                                        console.error(e);
                                                    } finally {
                                                        setSummarizing(false);
                                                    }
                                                }}
                                                disabled={summarizing}
                                                className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-600/50 px-4 py-2 rounded-lg text-xs font-bold transition-all w-full flex items-center justify-center gap-2"
                                            >
                                                {summarizing ? <span className="animate-spin">⏳</span> : <Bot size={14} />}
                                                {summarizing ? 'Analyse...' : 'Générer le Résumé'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-black/50 p-4 rounded-lg border border-zinc-800">
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
