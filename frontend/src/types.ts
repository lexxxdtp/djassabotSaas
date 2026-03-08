export type DayHours = { open: string; close: string; closed: boolean };

export type OpeningHours = {
    lundi: DayHours;
    mardi: DayHours;
    mercredi: DayHours;
    jeudi: DayHours;
    vendredi: DayHours;
    samedi: DayHours;
    dimanche: DayHours;
};

export type DeliveryZone = { name: string; price: number };

export interface SocialMedia {
    facebook: string;
    instagram: string;
    tiktok: string;
    website: string;
}

export interface SettingsConfig {
    // Identity
    botName: string;
    language: string;
    persona: string;
    greeting: string;

    // Personality
    politeness: string;
    emojiLevel: string;
    humorLevel: string;
    slangLevel: string;
    responseLength: string;
    trainingExamples: { question: string; answer: string }[];

    // Options
    negotiationEnabled: boolean;
    negotiationFlexibility: number;
    negotiationMargin?: number;
    voiceEnabled: boolean;
    systemInstructions: string;

    // Business
    storeName: string;
    businessType: string;
    address: string;
    locationUrl: string;
    gpsCoordinates: string;
    phone: string;
    socialMedia: SocialMedia;
    openingHours: OpeningHours;
    policyDescription: string;
    notificationPhone?: string;

    // Logistics
    deliveryEnabled: boolean;
    deliveryZones: DeliveryZone[];
    freeDeliveryThreshold: number;
    acceptedPayments: string[];

    // Vendor Payment
    settlementBank?: string;
    settlementAccount?: string;
}

// PRODUCT TYPES

export interface VariationOption {
    value: string;
    stock?: number;
    priceModifier?: number;
    images?: string[];
}

export interface ProductVariation {
    name: string;
    options: VariationOption[];
    isCustom?: boolean; // UI flag for custom name input
}

export interface Product {
    id: string;
    name: string;
    price: number;
    stock: number;
    description?: string;
    images: string[];
    minPrice?: number;
    variations?: ProductVariation[];
    aiInstructions?: string;
    manageStock?: boolean;
}

export interface VariationTemplate {
    name: string;
    default_options: { value: string; priceModifier: number }[];
    isSystem: boolean;
}
