import { useState, useEffect } from 'react';
import { 
    Bot, Store, User, QrCode, PlayCircle, 
    Sparkles, MapPin, ChevronRight, X 
} from 'lucide-react';
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

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    onSave?: () => void;
    saving?: boolean;
    children: React.ReactNode;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({ isOpen, onClose, title, onSave, saving, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#111] border-t md:border border-[#1a1a1a] rounded-t-3xl md:rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
                {/* Drag Indicator on Mobile */}
                <div className="w-12 h-1 bg-[#222] rounded-full mx-auto my-3 md:hidden shrink-0"></div>

                {/* Header */}
                <div className="px-6 pb-4 flex justify-between items-center border-b border-[#1a1a1a] pt-2 md:pt-6 shrink-0">
                    <div>
                        <h2 className="text-base font-bold text-white">{title}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {onSave && (
                            <button
                                onClick={onSave}
                                disabled={saving}
                                className="bg-[#00D97E] hover:bg-[#00D97E]/95 disabled:opacity-50 text-black px-3.5 py-1.5 rounded-xl text-xs font-bold transition-transform active:scale-95 flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                                {saving ? 'Sauvegarde…' : 'Enregistrer'}
                            </button>
                        )}
                        <button onClick={onClose} aria-label="Fermer" className="text-[#888] hover:text-white transition-colors bg-[#1a1a1a] p-1.5 rounded-full cursor-pointer">
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto pb-12">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default function Settings() {
    const { token, tenant } = useAuth();
    const [loading, setLoading] = useState(false);
    const [loadingVendor, setLoadingVendor] = useState(false);
    const [openDrawer, setOpenDrawer] = useState<string | null>(null);

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
            if (openDrawer === 'account') {
                const res = await apiClient('/auth/me', {
                    method: 'PUT',
                    body: JSON.stringify({
                        full_name: userProfile.fullName,
                        email: userProfile.email,
                        phone: userProfile.phone,
                        birth_date: userProfile.birthDate
                    })
                });
                if (res.ok) {
                    toast.success('Profil mis à jour !');
                    setOpenDrawer(null);
                } else {
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
                    setOpenDrawer(null);
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
            // Save settings first
            const saveRes = await apiClient('/settings', {
                method: 'POST',
                body: JSON.stringify(config)
            });
            if (!saveRes.ok) throw new Error('Impossible de sauvegarder les informations');

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

    const menuItems = [
        { id: 'identity', label: "Nom & Activation de l'IA", icon: Bot, desc: 'Identité du bot et activation globale' },
        { id: 'personality', label: 'Personnalité & Ton', icon: Sparkles, desc: 'Niveau de politesse, emojis, humour, nouchi' },
        { id: 'shop', label: 'Ma Boutique & Horaires', icon: Store, desc: 'Nom, adresse, numéro et heures d\'ouverture' },
        { id: 'delivery', label: 'Livraison & Règlements', icon: MapPin, desc: 'Frais de livraison, banque et compte Paystack' },
        { id: 'whatsapp', label: 'Connexion WhatsApp', icon: QrCode, desc: 'Lier votre numéro de téléphone via QR/Pairing code' },
        { id: 'account', label: 'Mon Compte & Abonnement', icon: User, desc: 'Informations personnelles, forfait et FAQ' },
        { id: 'test', label: 'Tester mon Bot', icon: PlayCircle, desc: 'Simuler une conversation avec le bot IA' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* HEADER */}
            <div className="border-b border-[#1a1a1a] pb-4">
                <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Réglages</h1>
                <p className="text-[#888] text-xs md:text-sm mt-1">Gérez votre profil, la personnalité du bot et les détails de livraison.</p>
            </div>

            {/* SETTINGS LIST MENU (iOS-like) */}
            <div className="bg-[#111] border border-[#1a1a1a] rounded-2xl overflow-hidden divide-y divide-[#1a1a1a]">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setOpenDrawer(item.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] active:bg-white/[0.04] transition-[background-color] text-left group cursor-pointer"
                        >
                            <div className="flex items-center gap-3.5 min-w-0">
                                <div className="p-2.5 rounded-xl bg-[#1a1a1a] text-[#888] group-hover:text-[#00D97E] group-hover:bg-[#00D97E]/10 transition-colors shrink-0">
                                    <Icon size={20} aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-white font-bold text-sm leading-none group-hover:text-[#00D97E] transition-colors">{item.label}</h3>
                                    <p className="text-[#555] text-xs mt-1 truncate">{item.desc}</p>
                                </div>
                            </div>
                            <ChevronRight size={16} aria-hidden="true" className="text-[#333] group-hover:text-[#555] transition-colors shrink-0" />
                        </button>
                    );
                })}
            </div>

            {/* DRAWER: IDENTITY */}
            <SettingsDrawer
                isOpen={openDrawer === 'identity'}
                onClose={() => setOpenDrawer(null)}
                title="Nom & Activation de l'IA"
                onSave={handleSave}
                saving={loading}
            >
                <div className="space-y-6">
                    <SettingsIdentity config={config} setConfig={setConfig} />
                    <SettingsToggles config={config} setConfig={setConfig} />
                    <SettingsAdvanced config={config} setConfig={setConfig} />
                </div>
            </SettingsDrawer>

            {/* DRAWER: PERSONALITY */}
            <SettingsDrawer
                isOpen={openDrawer === 'personality'}
                onClose={() => setOpenDrawer(null)}
                title="Personnalité & Ton"
                onSave={handleSave}
                saving={loading}
            >
                <SettingsPersonality config={config} setConfig={setConfig} />
            </SettingsDrawer>

            {/* DRAWER: SHOP */}
            <SettingsDrawer
                isOpen={openDrawer === 'shop'}
                onClose={() => setOpenDrawer(null)}
                title="Ma Boutique & Horaires"
                onSave={handleSave}
                saving={loading}
            >
                <SettingsBusiness config={config} setConfig={setConfig} />
            </SettingsDrawer>

            {/* DRAWER: DELIVERY */}
            <SettingsDrawer
                isOpen={openDrawer === 'delivery'}
                onClose={() => setOpenDrawer(null)}
                title="Livraison & Règlements"
                onSave={handleSave}
                saving={loading}
            >
                <SettingsLogistics
                    config={config}
                    setConfig={setConfig}
                    paystackSubaccountCode={paystackSubaccountCode}
                    handleSetupVendor={handleSetupVendor}
                    loadingVendor={loadingVendor}
                />
            </SettingsDrawer>

            {/* DRAWER: WHATSAPP */}
            <SettingsDrawer
                isOpen={openDrawer === 'whatsapp'}
                onClose={() => setOpenDrawer(null)}
                title="Connexion WhatsApp"
            >
                <WhatsAppConnect />
            </SettingsDrawer>

            {/* DRAWER: TEST */}
            <SettingsDrawer
                isOpen={openDrawer === 'test'}
                onClose={() => setOpenDrawer(null)}
                title="Tester mon Bot"
            >
                <div className="space-y-6">
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
                            <div className="max-h-40 overflow-y-auto">
                                <p className="text-xs text-[#888] leading-relaxed whitespace-pre-line">{aiSummary}</p>
                            </div>
                        )}
                    </div>
                    <div className="h-[400px] flex flex-col">
                        <AIPlayground />
                    </div>
                </div>
            </SettingsDrawer>

            {/* DRAWER: ACCOUNT */}
            <SettingsDrawer
                isOpen={openDrawer === 'account'}
                onClose={() => setOpenDrawer(null)}
                title="Mon Compte & Abonnement"
                onSave={handleSave}
                saving={loading}
            >
                <div className="space-y-6">
                    {/* Profil */}
                    <div className="bg-black border border-[#1a1a1a] rounded-2xl p-5">
                        <h2 className="text-xs font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                            <span className="w-1 h-4 rounded-full bg-[#00D97E]" />
                            Informations personnelles
                        </h2>

                        <div className="space-y-4">
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

                    {/* Abonnement */}
                    <div className="bg-black border border-[#1a1a1a] rounded-2xl p-5">
                        <h2 className="text-xs font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                            <span className="w-1 h-4 rounded-full bg-[#00D97E]" />
                            Abonnement
                        </h2>

                        <div className="flex items-center justify-between p-4 bg-white/5 border border-[#1a1a1a] rounded-xl mb-6">
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

                        <Subscription />
                    </div>

                    {/* Support */}
                    <div className="bg-black border border-[#1a1a1a] rounded-2xl p-5">
                        <h2 className="text-xs font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                            <span className="w-1 h-4 rounded-full bg-[#0EA5E9]" />
                            Aide & support
                        </h2>
                        <div className="space-y-4 text-sm">
                            {[
                                {
                                    q: 'Le bot ne répond pas à mes clients ?',
                                    a: 'Vérifiez 3 choses sur la page Aujourd\'hui : WhatsApp connecté (badge vert), au moins un produit ajouté, et le bot ACTIVÉ (pas en pause).'
                                },
                                {
                                    q: 'C\'est quoi la pause du bot ?',
                                    a: 'En pause, le bot lit les messages (vous les voyez dans Conversations) mais ne répond à personne. Pratique pour reprendre la main ou faire une pause. Activez/désactivez depuis la page Aujourd\'hui.'
                                },
                                {
                                    q: 'Comment marquer une commande payée ?',
                                    a: 'Si le client envoie son reçu Wave/OM dans WhatsApp, le bot valide tout seul. Sinon : Commandes → bouton "Marquer payée".'
                                },
                                {
                                    q: 'Comment changer mes prix ?',
                                    a: 'Produits → touchez le produit → modifiez le prix → Enregistrer. Le bot utilise le nouveau prix immédiatement. Le "prix plancher" est le minimum secret en dessous duquel le bot ne négociera jamais.'
                                },
                                {
                                    q: 'Mon WhatsApp risque-t-il quelque chose ?',
                                    a: 'Le bot se connecte comme WhatsApp Web. Règle d\'or : n\'envoyez jamais de campagnes à des numéros qui ne vous ont jamais écrit. Le bot espace automatiquement les envois pour protéger votre numéro.'
                                },
                            ].map(item => (
                                <details key={item.q} className="group bg-[#111] border border-[#1a1a1a] rounded-xl">
                                    <summary className="cursor-pointer list-none p-4 text-white font-medium flex items-center justify-between">
                                        {item.q}
                                        <span className="text-[#555] group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                                    </summary>
                                    <p className="px-4 pb-4 text-[#888] leading-relaxed">{item.a}</p>
                                </details>
                            ))}
                            <p className="text-[#888] pt-2">
                                Besoin d'aide ? Écrivez-nous : <a href="mailto:support@djassabot.com" className="text-[#00D97E] hover:underline">support@djassabot.com</a>
                            </p>
                        </div>
                    </div>
                </div>
            </SettingsDrawer>
        </div>
    );
}
