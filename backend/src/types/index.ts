// Core Business Types

export interface Product {
    id: string;
    tenantId?: string; // Optional for legacy compatibility
    name: string;
    price: number;
    images: string[];
    description: string;
    stock: number;
    minPrice?: number; // Lowest acceptable price for negotiation
}

export interface CartItem {
    productId: string;
    quantity: number;
    productName: string;
    price: number;
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
