import { useState, useEffect } from 'react';
import { Bot, Store, PlayCircle, Save, User, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';

import WhatsAppConnect from './WhatsAppConnect';
import AIPlayground from '../components/AIPlayground';
import { getApiUrl } from '../utils/apiConfig';
import { useAuth } from '../context/AuthContext';
import type { SettingsConfig } from '../types';

// Components
import SettingsIdentity from '../components/settings/SettingsIdentity';
import SettingsPersonality from '../components/settings/SettingsPersonality';
import SettingsToggles from '../components/settings/SettingsToggles';
import SettingsAdvanced from '../components/settings/SettingsAdvanced';
import SettingsBusiness from '../components/settings/SettingsBusiness';
import SettingsLogistics from '../components/settings/SettingsLogistics';
import UserProfileModal from '../components/UserProfileModal';

export default function Settings() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingVendor, setLoadingVendor] = useState(false);
    const [activeTab, setActiveTab] = useState<'profile' | 'identity' | 'business' | 'whatsapp' | 'simulation'>('identity');
    const [showProfileModal, setShowProfileModal] = useState(false);

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

    const [paystackSubaccountCode, setPaystackSubaccountCode] = useState<string | null>(null);
    const [aiSummary, setAiSummary] = useState('');
    const [summarizing, setSummarizing] = useState(false);

    const API_URL = getApiUrl();

    // Initial Config State
    const [config, setConfig] = useState<SettingsConfig>({
        // Identity
        botName: 'Awa',
        language: 'fr',
        persona: 'friendly',
        greeting: 'Bonjour ! Je suis Awa, votre assistante virtuelle. Comment puis-je vous aider ?',
        // Personality
        politeness: 'informal',
        emojiLevel: 'medium',
        humorLevel: 'medium',
        slangLevel: 'low',
        responseLength: 'medium',
        trainingExamples: [
            { input: "C'est combien ?", output: "5000 FCFA" },
            { input: "Vous livrez à Cocody ?", output: "Oui, 1500 FCFA pour la livraison." },
            { input: "Vous avez d'autres couleurs ?", output: "Oui, nous avons du bleu et du rouge." }
        ],

        // Options
        negotiationEnabled: true,
        negotiationFlexibility: 5,
        voiceEnabled: true,
        systemInstructions: '',

        // Business
        storeName: 'Ma Boutique Mode',
        businessType: 'Mode & Vêtements',
        address: 'Cocody Riviera 2, Abidjan',
        locationUrl: '',
        gpsCoordinates: '',
        phone: '+225 07 00 00 00 00',
        socialMedia: {
            facebook: '',
            instagram: '',
            tiktok: '',
            website: ''
        },
        openingHours: {
            lundi: { open: '08:00', close: '20:00', closed: false },
            mardi: { open: '08:00', close: '20:00', closed: false },
            mercredi: { open: '08:00', close: '20:00', closed: false },
            jeudi: { open: '08:00', close: '20:00', closed: false },
            vendredi: { open: '08:00', close: '20:00', closed: false },
            samedi: { open: '09:00', close: '18:00', closed: false },
            dimanche: { open: '09:00', close: '14:00', closed: true },
        },
        policyDescription: '',
        notificationPhone: '',

        // Logistics
        deliveryEnabled: true,
        deliveryZones: [
            { name: 'Abidjan', price: 1500 },
            { name: 'Intérieur du pays', price: 3000 }
        ],
        freeDeliveryThreshold: 50000,
        acceptedPayments: ['wave', 'om', 'cash'],

        // Vendor Payment
        settlementBank: '',
        settlementAccount: '',
    });

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

                    // Defensive merge to prevent white screen crashes on partial data
                    setConfig(prev => ({
                        ...prev,
                        ...data,
                        // Deep merge for nested objects to preserve defaults if DB has empty/partial json
                        openingHours: {
                            ...prev.openingHours,
                            ...(data.openingHours || {})
                        },
                        socialMedia: {
                            ...prev.socialMedia,
                            ...(data.socialMedia || {})
                        },
                        // Ensure arrays are at least arrays
                        deliveryZones: data.deliveryZones || prev.deliveryZones || [],
                        acceptedPayments: data.acceptedPayments || prev.acceptedPayments || [],
                        trainingExamples: (data.trainingExamples && data.trainingExamples.length > 0) ? data.trainingExamples : [
                            { input: "C'est combien ?", output: "5000 FCFA" },
                            { input: "Vous livrez à Cocody ?", output: "Oui, 1500 FCFA pour la livraison." },
                            { input: "Vous avez d'autres couleurs ?", output: "Oui, nous avons du bleu et du rouge." }
                        ],
                        // Ensure new fields have fallbacks
                        humorLevel: data.humorLevel || prev.humorLevel || 'medium',
                        slangLevel: data.slangLevel || prev.slangLevel || 'low',
                    }));
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

    const handleSave = async () => {
        if (!token) {
            toast.error('Vous devez être connecté pour sauvegarder.');
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
                    toast.success('Profil mis à jour avec succès !');
                } else {
                    const err = await res.json();
                    toast.error(err.error || 'Erreur lors de la mise à jour du profil.');
                }
            } else {
                // Save Settings
                const res = await fetch(`${API_URL}/settings`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(config)
                });

                if (res.ok) {
                    toast.success('Paramètres sauvegardés avec succès !');
                    // Clear cached summary on save (since data changed)
                    localStorage.removeItem('aiSummary');
                    setAiSummary('');
                } else {
                    toast.error('Erreur lors de la sauvegarde');
                }
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Erreur de connexion');
        } finally {
            setLoading(false);
        }
    };

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
        if (!token || !config.settlementBank || !config.settlementAccount) {
            toast.error('Veuillez remplir les informations bancaires');
            return;
        }
        setLoadingVendor(true);
        try {
            // First save the bank details to settings
            await handleSave();

            const res = await fetch(`${API_URL}/paystack/create-subaccount`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    settlement_bank: config.settlementBank,
                    account_number: config.settlementAccount,
                    percentage_charge: 5 // Platform fee 5%
                })
            });

            const data = await res.json();
            if (res.ok) {
                toast.success('Compte de paiement configuré avec succès !');
                setPaystackSubaccountCode(data.subaccount_code);
            } else {
                toast.error('Erreur Paystack: ' + (data.message || 'Impossible de créer le sous-compte'));
            }
        } catch (error) {
            console.error('Vendor setup error:', error);
            toast.error('Erreur de connexion');
        } finally {
            setLoadingVendor(false);
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
        <div className="min-h-screen bg-[#05070a] text-zinc-100 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* En-tête avec bouton Sauvegarder Fixe en bas sur mobile ou en haut sur desktop */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white tracking-tight">Paramètres</h1>
                        <p className="text-zinc-500 mt-1">Configurez l'identité, le comportement et la logistique de votre bot.</p>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="fixed bottom-6 right-6 md:static z-50 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all"
                    >
                        {loading ? <span className="animate-spin">⏳</span> : <Save size={20} />}
                        {loading ? 'Sauvegarde...' : 'Sauvegarder les changements'}
                    </button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex flex-wrap gap-3 border-b border-white/5 pb-4">
                    <TabButton id="profile" label="Mon Profil" icon={User} />
                    <TabButton id="identity" label="Identité & IA" icon={Bot} />
                    <TabButton id="business" label="Infos Boutique" icon={Store} />
                    <TabButton id="whatsapp" label="Connexion" icon={QrCode} />
                    <TabButton id="simulation" label="Test & Simulation" icon={PlayCircle} />
                </div>

                <div className="grid md:grid-cols-4 gap-8">
                    {/* Main Content Area */}
                    <div className="md:col-span-3 space-y-8">

                        {/* --- TAB 0: MON PROFIL --- */}
                        {activeTab === 'profile' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
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

                        {/* --- TAB 1: IDENTITY & AI --- */}
                        {activeTab === 'identity' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <SettingsIdentity config={config} setConfig={setConfig} />
                                <SettingsPersonality config={config} setConfig={setConfig} />
                                <SettingsToggles config={config} setConfig={setConfig} />
                                <SettingsAdvanced config={config} setConfig={setConfig} />
                            </div>
                        )}

                        {/* --- TAB 2: BUSINESS & LOGISTICS --- */}
                        {activeTab === 'business' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <SettingsBusiness config={config} setConfig={setConfig} />
                                <SettingsLogistics
                                    config={config}
                                    setConfig={setConfig}
                                    paystackSubaccountCode={paystackSubaccountCode}
                                    handleSetupVendor={handleSetupVendor}
                                    loadingVendor={loadingVendor}
                                />
                            </div>
                        )}

                        {/* --- TAB 3: WHATSAPP --- */}
                        {activeTab === 'whatsapp' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <WhatsAppConnect />
                            </div>
                        )}

                        {/* --- TAB 4: SIMULATION --- */}
                        {activeTab === 'simulation' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="grid md:grid-cols-3 gap-6">
                                    {/* Left Col: Explainer & Summary */}
                                    <div className="md:col-span-1 space-y-6">
                                        {/* Zone d'Explication */}
                                        <div className="bg-gradient-to-br from-indigo-900/30 to-[#0a0c10] border border-indigo-500/20 rounded-xl p-6">
                                            <h3 className="text-white font-bold text-lg mb-2">Zone de Test</h3>
                                            <p className="text-zinc-400 text-sm leading-relaxed">
                                                Testez votre bot en temps réel. Les changements s'appliquent immédiatement ici.
                                            </p>
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
                                                        className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-400 border border-purple-600/50 px-4 py-2 rounded-lg text-xs font-bold transition-all w-full flex items-center justify-center gap-2 text-zinc-100"
                                                    >
                                                        {summarizing ? <span className="animate-spin">⏳</span> : <Bot size={14} />}
                                                        {summarizing ? 'Analyse...' : 'Générer le Résumé'}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="bg-white/5 rounded-lg p-3 max-h-60 overflow-y-auto custom-scrollbar">
                                                    <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                                                        {aiSummary}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right Col: Chat Interface */}
                                    <div className="md:col-span-2 h-[600px] flex flex-col">
                                        <AIPlayground />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar Profile Card */}
                    <div className="hidden md:block md:col-span-1 space-y-6">
                        <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-6 sticky top-8">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                                    {userProfile.fullName.charAt(0) || 'U'}
                                </div>
                                <div className="overflow-hidden">
                                    <h3 className="font-bold text-white truncate">{userProfile.fullName || 'Utilisateur'}</h3>
                                    <p className="text-xs text-zinc-500 truncate">{userProfile.email}</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setActiveTab('profile')}
                                className="w-full py-2 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-lg text-sm font-medium transition-colors mb-4"
                            >
                                Modifier mon profil
                            </button>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                <div>
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">Abonnement</div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-white font-medium">Plan Pro</span>
                                        <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full font-bold">ACTIF</span>
                                    </div>
                                    <button
                                        onClick={() => setShowProfileModal(true)}
                                        className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 w-full text-left"
                                    >
                                        Gérer l'abonnement
                                    </button>
                                </div>
                                <div>
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider font-bold mb-1">Quota IA</div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs text-zinc-400">12,450 / 50,000 tokens</span>
                                    </div>
                                    <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-indigo-500 h-full w-[25%] rounded-full"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Profile Edit Modal - ONLY FOR SUBSCRIPTION NOW */}
                {showProfileModal && (
                    <UserProfileModal
                        isOpen={showProfileModal}
                        onClose={() => setShowProfileModal(false)}
                    />
                )}
            </div>
        </div>
    );
}
