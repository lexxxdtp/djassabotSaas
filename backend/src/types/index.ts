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

export interface Order {
    id: string;
    tenantId?: string;
    userId: string;
    items: CartItem[];
    total: number;
    status: 'PENDING' | 'PAID' | 'DELIVERED';
    address: string;
    createdAt: Date;
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
    responseLength: string;
    trainingExamples: { question: string; answer: string }[];
    negotiationEnabled: boolean;
    negotiationFlexibility: number;
    voiceEnabled: boolean;
    systemInstructions: string;

    // Business
    storeName: string;
    address: string;
    phone: string;
    hours: string;
    returnPolicy: string;

    // Logistics
    deliveryAbidjanPrice: number;
    deliveryInteriorPrice: number;
    freeDeliveryThreshold: number;
    acceptedPayments: string[];
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
