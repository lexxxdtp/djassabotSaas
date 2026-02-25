import { Truck, Plus, X, CheckCircle } from 'lucide-react';
import type { SettingsConfig } from '../../types';

interface SettingsLogisticsProps {
    config: SettingsConfig;
    setConfig: (newConfig: SettingsConfig) => void;
    paystackSubaccountCode: string | null;
    handleSetupVendor: () => void;
    loadingVendor: boolean;
}

export default function SettingsLogistics({
    config,
    setConfig,
    paystackSubaccountCode,
    handleSetupVendor,
    loadingVendor
}: SettingsLogisticsProps) {
    return (
        <div className="space-y-6">
            {/* 1. Livraison & Frais */}
            <div className="bg-[#0a0c10] border border-white/5 rounded-xl p-8">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2 uppercase tracking-wider text-xs">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <Truck className="w-4 h-4" /> Livraison & Frais
                    </h2>
                    {/* Toggle Livraison */}
                    <label className="flex items-center gap-3 cursor-pointer">
                        <span className="text-sm text-zinc-400">
                            {config.deliveryEnabled ? 'Activée' : 'Désactivée'}
                        </span>
                        <div className="relative">
                            <input
                                type="checkbox"
                                checked={config.deliveryEnabled}
                                onChange={(e) => setConfig({ ...config, deliveryEnabled: e.target.checked })}
                                className="sr-only"
                            />
                            <div className={`w-11 h-6 rounded-full transition-colors ${config.deliveryEnabled ? 'bg-orange-500' : 'bg-zinc-700'}`}>
                                <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${config.deliveryEnabled ? 'translate-x-5' : ''}`}></div>
                            </div>
                        </div>
                    </label>
                </div>

                {config.deliveryEnabled ? (
                    <div className="space-y-4">
                        <p className="text-[10px] text-zinc-500">
                            Définissez vos zones de livraison et leurs tarifs. L'IA utilisera ces informations pour calculer le total des commandes.
                        </p>

                        {/* Dynamic Delivery Zones */}
                        <div className="space-y-3">
                            {(Array.isArray(config.deliveryZones) ? config.deliveryZones : []).map((zone, index) => (
                                <div key={index} className="flex items-center gap-3 bg-white/5 rounded-lg p-3">
                                    <input
                                        type="text"
                                        value={zone.name}
                                        onChange={(e) => {
                                            const newZones = [...(Array.isArray(config.deliveryZones) ? config.deliveryZones : [])];
                                            newZones[index].name = e.target.value;
                                            setConfig({ ...config, deliveryZones: newZones });
                                        }}
                                        className="flex-1 bg-white/10 border border-white/10 rounded-lg p-2 text-white text-sm placeholder:text-zinc-600"
                                        placeholder="Nom de la zone (ex: Cocody, Yopougon...)"
                                    />
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={zone.price}
                                            onChange={(e) => {
                                                const newZones = [...(Array.isArray(config.deliveryZones) ? config.deliveryZones : [])];
                                                newZones[index].price = parseInt(e.target.value) || 0;
                                                setConfig({ ...config, deliveryZones: newZones });
                                            }}
                                            className="w-28 bg-white/10 border border-white/10 rounded-lg p-2 pr-12 text-white text-sm"
                                            placeholder="1500"
                                        />
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">FCFA</span>
                                    </div>
                                    {(Array.isArray(config.deliveryZones) ? config.deliveryZones : []).length > 1 && (
                                        <button
                                            onClick={() => {
                                                const newZones = (Array.isArray(config.deliveryZones) ? config.deliveryZones : []).filter((_, i) => i !== index);
                                                setConfig({ ...config, deliveryZones: newZones });
                                            }}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Supprimer cette zone"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Add Zone Button */}
                        <button
                            onClick={() => setConfig({
                                ...config,
                                deliveryZones: [...(Array.isArray(config.deliveryZones) ? config.deliveryZones : []), { name: '', price: 0 }]
                            })}
                            className="flex items-center gap-2 text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Ajouter une zone de livraison
                        </button>

                        {/* Free Delivery Threshold */}
                        <div className="pt-4 border-t border-white/5">
                            <label className="block text-xs font-semibold text-neutral-400 mb-2 uppercase tracking-wide">
                                🎁 Seuil Livraison Gratuite
                            </label>
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1 max-w-xs">
                                    <input
                                        type="number"
                                        value={config.freeDeliveryThreshold}
                                        onChange={e => setConfig({ ...config, freeDeliveryThreshold: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 pr-16 text-white focus:border-orange-500 outline-none"
                                        placeholder="50000"
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">FCFA</span>
                                </div>
                                <p className="text-[10px] text-zinc-500">Livraison offerte à partir de ce montant (0 = jamais gratuit)</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8 text-zinc-500">
                        <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">La livraison est désactivée</p>
                        <p className="text-xs mt-1">Activez-la si vous gérez vous-même les frais de livraison</p>
                    </div>
                )}
            </div>

            {/* 2. Paiement */}
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
                        const safePayments = Array.isArray(config.acceptedPayments) ? config.acceptedPayments : [];
                        const isChecked = safePayments.includes(method.id);
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
                                            ? safePayments.filter(p => p !== method.id)
                                            : [...safePayments, method.id];
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

            {/* 3. Coordonnées de Réception (Split Payments) */}
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
                            disabled={loadingVendor || !config.settlementBank || !config.settlementAccount}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg shadow-emerald-900/20"
                        >
                            {loadingVendor ? 'Configuration...' : 'Activer les Paiements Automatiques'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
