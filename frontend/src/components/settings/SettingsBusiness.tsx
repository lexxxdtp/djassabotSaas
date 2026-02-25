import { MapPin, Clock } from 'lucide-react';
import type { SettingsConfig } from '../../types';

interface SettingsBusinessProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
}

export default function SettingsBusiness({ config, setConfig }: SettingsBusinessProps) {
    return (
        <div className="space-y-6">
            {/* 1. Infos Boutique & Social */}
            <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Informations Boutique
                </h2>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Nom de la Boutique</label>
                        <input
                            type="text"
                            value={config.storeName}
                            onChange={e => setConfig({ ...config, storeName: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                            placeholder="Ma Boutique"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Numéro de Téléphone (Public)</label>
                        <input
                            type="text"
                            value={config.phone}
                            onChange={e => setConfig({ ...config, phone: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                            placeholder="+225 07..."
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Type d'Activité</label>
                        <input
                            type="text"
                            value={config.businessType || ''}
                            onChange={e => setConfig({ ...config, businessType: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                            placeholder="Ex: Vente de vêtements, Restaurant, Service..."
                        />
                    </div>
                </div>

                {/* Social Media */}
                <div className="mt-8 border-t border-white/5 pt-6">
                    <h3 className="text-sm font-bold text-zinc-400 mb-4 uppercase tracking-wide">Réseaux Sociaux</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Facebook URL</label>
                            <input
                                type="text"
                                value={config.socialMedia?.facebook || ''}
                                onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, facebook: e.target.value } })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                placeholder="facebook.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Instagram URL</label>
                            <input
                                type="text"
                                value={config.socialMedia?.instagram || ''}
                                onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, instagram: e.target.value } })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                placeholder="instagram.com/..."
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">Site Web</label>
                            <input
                                type="text"
                                value={config.socialMedia?.website || ''}
                                onChange={e => setConfig({ ...config, socialMedia: { ...config.socialMedia, website: e.target.value } })}
                                className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600"
                                placeholder="www.maboutique.com"
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
            </div>

            {/* 2. Localisation */}
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

            {/* 3. Horaires & Politique */}
            <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-wider text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span> Horaires & Politique
                </h2>
                <div className="space-y-6">
                    {/* Horaires par jour */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wide">
                            <Clock className="inline w-4 h-4 mr-1" /> Horaires d'Ouverture par Jour
                        </label>
                        <div className="space-y-2">
                            {(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const).map((day) => (
                                <div key={day} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                                    <span className="w-24 text-sm text-white capitalize font-medium">{day}</span>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!config.openingHours[day]?.closed}
                                            onChange={(e) => setConfig({
                                                ...config,
                                                openingHours: {
                                                    ...config.openingHours,
                                                    [day]: { ...config.openingHours[day], closed: !e.target.checked }
                                                }
                                            })}
                                            className="w-4 h-4 rounded accent-indigo-500"
                                        />
                                        <span className="text-xs text-zinc-400">Ouvert</span>
                                    </label>
                                    {!config.openingHours[day]?.closed && (
                                        <>
                                            <input
                                                type="time"
                                                value={config.openingHours[day]?.open || '08:00'}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    openingHours: {
                                                        ...config.openingHours,
                                                        [day]: { ...config.openingHours[day], open: e.target.value }
                                                    }
                                                })}
                                                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                            />
                                            <span className="text-zinc-500">à</span>
                                            <input
                                                type="time"
                                                value={config.openingHours[day]?.close || '20:00'}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    openingHours: {
                                                        ...config.openingHours,
                                                        [day]: { ...config.openingHours[day], close: e.target.value }
                                                    }
                                                })}
                                                className="bg-white/10 border border-white/10 rounded px-2 py-1 text-white text-sm"
                                            />
                                        </>
                                    )}
                                    {config.openingHours[day]?.closed && (
                                        <span className="text-red-400 text-sm">Fermé</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Politique et fonctionnement */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">
                            📋 Politique, Retours & Fonctionnement
                        </label>
                        <p className="text-[10px] text-zinc-500 mb-2">
                            Décrivez votre politique de retour, vos conditions de vente, comment fonctionne le paiement, etc. L'IA utilisera ces informations pour répondre aux clients.
                        </p>
                        <textarea
                            value={config.policyDescription || ''}
                            onChange={e => setConfig({ ...config, policyDescription: e.target.value })}
                            rows={6}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-white focus:border-indigo-500 outline-none placeholder:text-zinc-600 leading-relaxed text-sm"
                            placeholder="Ex: ✅ Satisfait ou remboursé sous 7 jours
🚚 Nous livrons partout à Abidjan sous 24h
💳 Paiement à la livraison via Wave ou Cash
📦 Pour l'intérieur du pays, paiement avant expédition
🔄 Échanges possibles sous 3 jours (article non porté)"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
