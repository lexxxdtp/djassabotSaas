import { useState, useEffect } from 'react';
import { Bot, Store, Save, User, QrCode, PlayCircle, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';

import WhatsAppConnect from './WhatsAppConnect';
import Subscription from './Subscription';
import AIPlayground from '../components/AIPlayground';
import { useAuth } from '../context/AuthContext';
import { apiClient } from '../utils/apiClient';
import type { SettingsConfig } from '../types';

// Components
import SettingsIdentity from '../components/settings/SettingsIdentity';
import SettingsPersonality from '../components/settings/SettingsPersonality';
import SettingsToggles from '../components/settings/SettingsToggles';
import SettingsAdvanced from '../components/settings/SettingsAdvanced';
import SettingsBusiness from '../components/settings/SettingsBusiness';
import SettingsLogistics from '../components/settings/SettingsLogistics';

type TabId = 'bot' | 'shop' | 'whatsapp' | 'account';

export default function Settings() {
    const { token, tenant } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingVendor, setLoadingVendor] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('bot');
    const [showTestPanel, setShowTestPanel] = useState(false);

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



    const [config, setConfig] = useState<SettingsConfig>({
        botName: 'Awa',
        language: 'fr',
        persona: 'friendly',
        greeting: 'Bonjour ! Je suis Awa, votre assistante virtuelle. Comment puis-je vous aider ?',
        politeness: 'informal',
        emojiLevel: 'medium',
        humorLevel: 'medium',
        slangLevel: 'low',
        responseLength: 'medium',
        trainingExamples: [
            { question: "C'est combien ?", answer: "5000 FCFA" },
            { question: "Vous livrez à Cocody ?", answer: "Oui, 1500 FCFA pour la livraison." },
            { question: "Vous avez d'autres couleurs ?", answer: "Oui, nous avons du bleu et du rouge." }
        ],
        negotiationEnabled: true,
        negotiationFlexibility: 5,
        voiceEnabled: true,
        systemInstructions: '',
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
        deliveryEnabled: true,
        deliveryZones: [
            { name: 'Abidjan', price: 1500 },
            { name: 'Intérieur du pays', price: 3000 }
        ],
        freeDeliveryThreshold: 50000,
        acceptedPayments: ['wave', 'om', 'cash'],
        settlementBank: '',
        settlementAccount: '',
    });

    useEffect(() => {
        if (!token) return;

        const fetchSettings = async () => {
            try {
                const res = await apiClient('/settings');
                if (res.ok) {
                    const data = await res.json();
                    setConfig(prev => ({
                        ...prev,
                        ...data,
                        openingHours: { ...prev.openingHours, ...(data.openingHours || {}) },
                        socialMedia: { ...prev.socialMedia, ...(data.socialMedia || {}) },
                        deliveryZones: data.deliveryZones || prev.deliveryZones || [],
                        acceptedPayments: data.acceptedPayments || prev.acceptedPayments || [],
                        trainingExamples: (data.trainingExamples && data.trainingExamples.length > 0) ? data.trainingExamples : prev.trainingExamples,
                        humorLevel: data.humorLevel || prev.humorLevel || 'medium',
                        slangLevel: data.slangLevel || prev.slangLevel || 'low',
                    }));
                }
            } catch (error) {
                console.error('Failed to fetch settings', error);
            }
        };

        const fetchProfile = async () => {
            try {
                const res = await apiClient('/auth/me');
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
    }, [token]);

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
            if (activeTab === 'account') {
                const res = await apiClient('/auth/me', {
                    method: 'PUT',
                    body: JSON.stringify({
                        full_name: userProfile.fullName,
                        email: userProfile.email,
                        phone: userProfile.phone,
                        birth_date: userProfile.birthDate
                    })
                });
                if (res.ok) toast.success('Profil mis à jour !');
                else {
                    const err = await res.json();
                    toast.error(err.error || 'Erreur lors de la mise à jour.');
                }
            } else {
                const res = await apiClient('/settings', {
                    method: 'POST',
                    body: JSON.stringify(config)
                });
                if (res.ok) {
                    toast.success('Paramètres sauvegardés !');
                    localStorage.removeItem('aiSummary');
                    setAiSummary('');
                } else toast.error('Erreur lors de la sauvegarde');
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
            const res = await apiClient('/ai/summarize-identity', {
                method: 'POST',
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
            await handleSave();
            const res = await apiClient('/paystack/create-subaccount', {
                method: 'POST',
                body: JSON.stringify({
                    settlement_bank: config.settlementBank,
                    account_number: config.settlementAccount,
                    percentage_charge: 5
                })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success('Compte de paiement configuré !');
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

    const tabs: { id: TabId; label: string; icon: React.ElementType; desc: string }[] = [
        { id: 'bot', label: 'Mon Bot', icon: Bot, desc: 'Personnalité, instructions, comportement' },
        { id: 'shop', label: 'Ma Boutique', icon: Store, desc: 'Identité, horaires, livraison' },
        { id: 'whatsapp', label: 'WhatsApp', icon: QrCode, desc: 'Connexion du numéro WhatsApp' },
        { id: 'account', label: 'Compte', icon: User, desc: 'Profil et abonnement' },
    ];

    const activeTabConfig = tabs.find(t => t.id === activeTab);
    const showSaveButton = activeTab === 'bot' || activeTab === 'shop' || activeTab === 'account';

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* HEADER */}
            <div className="border-b border-[#1a1a1a] pb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Réglages</h1>
                <p className="text-[#888] text-xs md:text-sm mt-1">{activeTabConfig?.desc}</p>
            </div>

            {/* TABS — segmented control */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-1.5 grid grid-cols-4 gap-1">
                {tabs.map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 px-2 md:px-4 py-2.5 rounded-xl text-xs font-medium transition-all ${isActive
                                ? 'bg-[#00D97E] text-black shadow-lg'
                                : 'text-[#888] hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <tab.icon className="w-4 h-4 shrink-0" />
                            <span className="hidden sm:inline">{tab.label}</span>
                            <span className="sm:hidden text-[10px]">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB CONTENT */}
            <div className="space-y-6">

                {/* MON BOT */}
                {activeTab === 'bot' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <SettingsIdentity config={config} setConfig={setConfig} />
                        <SettingsPersonality config={config} setConfig={setConfig} />
                        <SettingsToggles config={config} setConfig={setConfig} />
                        <SettingsAdvanced config={config} setConfig={setConfig} />

                        {/* Test panel — collapsible */}
                        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setShowTestPanel(s => !s)}
                                className="w-full flex items-center justify-between p-5 hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-[#00D97E]/10 text-[#00D97E]">
                                        <PlayCircle className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-white font-bold text-sm">Tester votre bot</h3>
                                        <p className="text-[#888] text-xs mt-0.5">Discutez avec votre IA pour valider la personnalité</p>
                                    </div>
                                </div>
                                <ChevronDown className={`w-5 h-5 text-[#888] transition-transform ${showTestPanel ? 'rotate-180' : ''}`} />
                            </button>
                            {showTestPanel && (
                                <div className="border-t border-[#1a1a1a] p-4 md:p-6">
                                    <div className="grid lg:grid-cols-3 gap-6">
                                        <div className="lg:col-span-1">
                                            <div className="bg-black border border-[#1a1a1a] rounded-xl p-5">
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-white font-bold text-sm flex items-center gap-2">
                                                        <Bot size={16} className="text-[#00D97E]" /> Synthèse IA
                                                    </h3>
                                                    {aiSummary && (
                                                        <button onClick={handleGenerateSummary} className="text-[10px] text-[#888] hover:text-white">
                                                            Regénérer
                                                        </button>
                                                    )}
                                                </div>
                                                {!aiSummary ? (
                                                    <div className="text-center py-4">
                                                        <p className="text-xs text-[#888] mb-4">Générez une synthèse pour voir ce que l'IA a compris.</p>
                                                        <button
                                                            onClick={handleGenerateSummary}
                                                            disabled={summarizing}
                                                            className="bg-[#00D97E]/10 hover:bg-[#00D97E]/20 text-[#00D97E] border border-[#00D97E]/20 px-4 py-2 rounded-lg text-xs font-bold transition-all w-full flex items-center justify-center gap-2"
                                                        >
                                                            {summarizing ? <span className="animate-spin">⏳</span> : <Bot size={14} />}
                                                            {summarizing ? 'Analyse...' : 'Générer'}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="max-h-60 overflow-y-auto">
                                                        <p className="text-xs text-[#888] leading-relaxed whitespace-pre-line">{aiSummary}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="lg:col-span-2 h-[500px] flex flex-col">
                                            <AIPlayground />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* MA BOUTIQUE */}
                {activeTab === 'shop' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

                {/* WHATSAPP */}
                {activeTab === 'whatsapp' && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <WhatsAppConnect />
                    </div>
                )}

                {/* COMPTE — profile + subscription */}
                {activeTab === 'account' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Profil */}
                        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 md:p-8">
                            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-1 h-4 rounded-full bg-[#00D97E]" />
                                Informations personnelles
                            </h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Nom complet</label>
                                    <input
                                        type="text"
                                        value={userProfile.fullName}
                                        onChange={e => setUserProfile({ ...userProfile, fullName: e.target.value })}
                                        className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl p-3 text-white focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] outline-none transition-all placeholder:text-[#555]"
                                        placeholder="Votre nom"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Date de naissance</label>
                                    <input
                                        type="date"
                                        value={userProfile.birthDate}
                                        onChange={e => setUserProfile({ ...userProfile, birthDate: e.target.value })}
                                        className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl p-3 text-white focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] outline-none transition-all [&::-webkit-calendar-picker-indicator]:invert"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Téléphone</label>
                                    <input
                                        type="text"
                                        value={userProfile.phone}
                                        onChange={e => setUserProfile({ ...userProfile, phone: e.target.value })}
                                        className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl p-3 text-white focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] outline-none transition-all placeholder:text-[#555]"
                                        placeholder="+225..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-[#888] mb-2">Email (optionnel)</label>
                                    <input
                                        type="email"
                                        value={userProfile.email}
                                        onChange={e => setUserProfile({ ...userProfile, email: e.target.value })}
                                        className="w-full bg-white/5 border border-[#1a1a1a] rounded-xl p-3 text-white focus:border-[#00D97E] focus:ring-1 focus:ring-[#00D97E] outline-none transition-all placeholder:text-[#555]"
                                        placeholder="email@exemple.com"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Plan actuel — petit récap */}
                        <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6 md:p-8">
                            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                                <span className="w-1 h-4 rounded-full bg-[#00D97E]" />
                                Abonnement
                            </h2>

                            <div className="flex items-center justify-between p-4 bg-black border border-[#1a1a1a] rounded-xl mb-6">
                                <div>
                                    <p className="text-[10px] uppercase font-bold tracking-wider text-[#888]">Plan actuel</p>
                                    <p className="text-xl font-bold text-white mt-1">
                                        {tenant?.subscription_tier ? tenant.subscription_tier.charAt(0).toUpperCase() + tenant.subscription_tier.slice(1) : 'Starter'}
                                    </p>
                                </div>
                                <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider ${tenant?.status === 'active' || tenant?.status === 'trial'
                                    ? 'bg-[#00D97E]/10 text-[#00D97E] border border-[#00D97E]/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                    }`}>
                                    {tenant?.status === 'trial' ? 'Essai' : tenant?.status === 'active' ? 'Actif' : tenant?.status || 'Actif'}
                                </span>
                            </div>

                            {/* Plans embed */}
                            <Subscription />
                        </div>
                    </div>
                )}
            </div>

            {/* SAVE BUTTON — fixed mobile, inline desktop */}
            {showSaveButton && (
                <div className="fixed bottom-20 md:bottom-6 right-4 md:right-8 z-40">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="bg-[#00D97E] hover:bg-[#00D97E]/90 disabled:opacity-50 disabled:cursor-not-allowed text-black px-5 md:px-6 py-3 rounded-xl font-bold shadow-2xl shadow-[#00D97E]/20 flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
                    >
                        {loading ? <span className="animate-spin">⏳</span> : <Save size={18} />}
                        <span className="text-sm">{loading ? 'Sauvegarde…' : 'Sauvegarder'}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
