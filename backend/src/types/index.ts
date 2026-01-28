// Core Business Types

// Option within a variation (e.g., "M" in Size, "Red" in Color)
export interface VariationOption {
    value: string;          // e.g., "M", "XL", "Rouge", "Nutella"
    stock?: number;         // Stock for this specific option (optional, uses product.stock if not set)
    priceModifier?: number; // Price adjustment: +500 for XL, -200 for S, 0 for M (default)
}

// Variation/Déclinaison type for flexible product options
export interface ProductVariation {
    name: string;               // e.g., "Taille", "Couleur", "Saveur"
    options: VariationOption[]; // Array of options with individual stock/price
}

export interface Product {
    id: string;
    tenantId?: string; // Optional for legacy compatibility
    name: string;
    price: number;        // Base price
    images: string[];
    description: string;
    stock: number;        // Base stock (used if no variation-specific stock)
    minPrice?: number;    // Lowest acceptable price for negotiation
    variations?: ProductVariation[]; // Optional variations/déclinaisons
    aiInstructions?: string; // Special instructions for AI (promotions, rules, etc.)
    manageStock?: boolean; // If false, allow unlimited sales (production on demand)
}

// Selected variation for cart/order
export interface SelectedVariation {
    name: string;   // "Taille"
    value: string;  // "XL"
}

export interface CartItem {
    productId: string;
    quantity: number;
    productName: string;
    price: number;  // Final price including variation modifiers
    selectedVariations?: SelectedVariation[]; // Which variations were selected
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Order {
    id: string;
    tenantId?: string;
    userId: string;
    items: CartItem[];
    total: number;
    status: OrderStatus;
    address: string;
    createdAt: Date;
    customerPhone?: string; // Phone number extracted from userId or contact
    deliveryNote?: string;  // Internal note for delivery
    paymentMethod?: string;
}

// Opening hours per day structure
export interface DayHours {
    open: string;   // e.g., "08:00"
    close: string;  // e.g., "20:00"
    closed: boolean;
}

export interface OpeningHours {
    lundi: DayHours;
    mardi: DayHours;
    mercredi: DayHours;
    jeudi: DayHours;
    vendredi: DayHours;
    samedi: DayHours;
    dimanche: DayHours;
}

// Delivery zone with pricing
export interface DeliveryZone {
    name: string;   // e.g., "Cocody", "Abidjan", "Intérieur"
    price: number;  // Price in FCFA
}

export interface Settings {
    // Identity
    botName: string;
    language: string;
    persona: string;
    greeting: string;
    // Personality
    politeness: string;
    emojiLevel: string;
    humorLevel?: string;
    slangLevel?: string;
    responseLength: string;
    trainingExamples: { question: string; answer: string }[];
    negotiationEnabled: boolean;
    negotiationFlexibility: number; // 0-1 (Abstract "Personality")
    negotiationMargin?: number;     // 0-100 (Real percentage limit, e.g., 10%)
    voiceEnabled: boolean;
    systemInstructions: string;

    // Business
    storeName: string;
    businessType?: string;
    address: string;
    locationUrl?: string;
    gpsCoordinates?: string;
    phone: string;  // PUBLIC - Business phone (can be shared by bot)
    socialMedia?: {
        facebook?: string;
        instagram?: string;
        tiktok?: string;
        website?: string;
    };
    openingHours?: OpeningHours;  // Horaires par jour
    policyDescription?: string;   // Policy, returns, how it works (free text)

    // Logistics
    deliveryEnabled: boolean;             // Toggle livraison on/off
    deliveryZones: DeliveryZone[];        // Dynamic delivery zones with prices
    freeDeliveryThreshold: number;        // Free delivery above this amount (0 = never free)
    acceptedPayments: string[];

    // Vendor Payment (Split)
    settlementBank?: string;
    settlementAccount?: string;
    notificationPhone?: string;  // PRIVATE - Admin notification phone (NEVER share with bot)
}

// Multi-Tenant Types

export interface Tenant {
    id: string;
    name: string;
    businessType?: string;
    status: 'trial' | 'active' | 'suspended' | 'cancelled';
    subscriptionTier: 'starter' | 'pro' | 'business';
    whatsappConnected: boolean;
    whatsappPhoneNumber?: string;
    whatsappStatus: string;
    paystackSubaccountCode?: string; // For receiving payments
    createdAt: Date;
    updatedAt: Date;
}

export interface User {
    id: string;
    tenantId: string;
    email?: string; // Optional now, can use phone instead
    phone?: string; // Format: +225XXXXXXXXXX
    full_name?: string;
    birth_date?: Date;
    passwordHash: string;
    role: 'owner' | 'admin' | 'staff';
    emailVerified: boolean;
    phoneVerified: boolean;
    createdAt: Date;
}

export interface Subscription {
    id: string;
    tenantId: string;
    plan: 'starter' | 'pro' | 'business';
    status: 'active' | 'expired' | 'cancelled' | 'trial';
    startedAt: Date;
    expiresAt: Date;
    autoRenew: boolean;
    paymentMethod?: string;
    lastPaymentDate?: Date;
}

export interface JWTPayload {
    tenantId: string;
    userId: string;
    email: string;
}
