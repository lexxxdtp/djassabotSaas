import axios from 'axios';
import { db } from './dbService';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://djassabot-saas.vercel.app';
const API_URL = process.env.API_URL || 'https://djassabot-saas-production.up.railway.app';

// Plan codes from Paystack Dashboard
const PLAN_CODES = {
    starter: process.env.PAYSTACK_PLAN_STARTER || '',
    pro: process.env.PAYSTACK_PLAN_PRO || '',
    business: process.env.PAYSTACK_PLAN_BUSINESS || ''
};

// Plan prices in FCFA
const PLAN_PRICES = {
    starter: 5000,
    pro: 10000,
    business: 15000
};

const paystackApi = axios.create({
    baseURL: PAYSTACK_BASE_URL,
    headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

// ============================================
// SUBSCRIPTION PAYMENTS (TDJaasa receives money)
// ============================================

/**
 * Initialize a subscription payment for a tenant
 */
export const initializeSubscription = async (
    tenantId: string,
    email: string,
    plan: 'starter' | 'pro' | 'business'
) => {
    try {
        const planCode = PLAN_CODES[plan];

        if (!planCode) {
            throw new Error(`Plan code not configured for: ${plan}`);
        }

        const response = await paystackApi.post('/transaction/initialize', {
            email,
            amount: PLAN_PRICES[plan] * 100, // Convert to kobo/pesewas
            plan: planCode,
            callback_url: `${FRONTEND_URL}/dashboard/subscription/callback`,
            metadata: {
                tenantId,
                type: 'subscription',
                plan
            }
        });

        return {
            success: true,
            authorizationUrl: response.data.data.authorization_url,
            accessCode: response.data.data.access_code,
            reference: response.data.data.reference
        };
    } catch (error: any) {
        console.error('[Paystack] Subscription init error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

/**
 * Verify a transaction after payment
 */
export const verifyTransaction = async (reference: string) => {
    try {
        const response = await paystackApi.get(`/transaction/verify/${reference}`);
        return {
            success: response.data.data.status === 'success',
            data: response.data.data
        };
    } catch (error: any) {
        console.error('[Paystack] Verify error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
};

// ============================================
// MERCHANT PAYMENTS (Vendors receive money)
// ============================================

/**
 * Create a subaccount for a vendor (so they can receive payments)
 */
export const createVendorSubaccount = async (
    tenantId: string,
    businessName: string,
    bankCode: string,
    accountNumber: string,
    email: string,
    phone?: string
) => {
    try {
        // Map common names to codes if necessary (Basic mapping for CI)
        let finalBankCode = bankCode;
        if (bankCode === 'MTN') finalBankCode = 'MTN'; // Verify this code via listBanks if fails
        if (bankCode === 'Orange Money') finalBankCode = 'ORM'; // Verify this code
        if (bankCode === 'Wave') finalBankCode = 'WAVE'; // Verify this code

        // Better approach: Since we don't know the codes for sure without calling API, 
        // we should probably let the user select from a real list in the future.
        // For now, let's try to find the bank by name if the code looks like a name
        if (['MTN', 'Orange Money', 'Wave'].includes(bankCode)) {
            const banksRes = await listBanks('côte d\'ivoire');
            if (banksRes.success) {
                const found = banksRes.banks.find((b: any) => b.name.toLowerCase().includes(bankCode.toLowerCase()) || b.code === bankCode);
                if (found) finalBankCode = found.code;
            }
        }

        const response = await paystackApi.post('/subaccount', {
            business_name: businessName,
            settlement_bank: finalBankCode,
            account_number: accountNumber,
            percentage_charge: 2, // TDJaasa takes 2% commission on sales
            primary_contact_email: email,
            primary_contact_phone: phone
        });

        const subaccountCode = response.data.data.subaccount_code;

        // Save subaccount code to tenant record
        await db.updateTenant(tenantId, { paystackSubaccountCode: subaccountCode });

        console.log(`[Paystack] Created subaccount ${subaccountCode} for tenant ${tenantId}`);

        return {
            success: true,
            subaccountCode,
            data: response.data.data
        };
    } catch (error: any) {
        console.error('[Paystack] Create subaccount error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

/**
 * Generate a payment link for a customer order (Split Payment)
 * Money goes to vendor's subaccount with TDJaasa taking a commission
 */
export const createOrderPaymentLink = async (
    tenantId: string,
    orderId: string,
    amount: number,
    customerEmail: string,
    customerPhone: string,
    subaccountCode: string,
    orderSummary: string
) => {
    try {
        // Commission for TDJaasa (2% of total, minimum 100 FCFA)
        const commission = Math.max(Math.round(amount * 0.02), 100);

        const response = await paystackApi.post('/transaction/initialize', {
            email: customerEmail || `${customerPhone.replace(/\+/g, '')}@whatsapp.customer`,
            amount: amount * 100, // Convert to kobo
            subaccount: subaccountCode,
            transaction_charge: commission * 100, // TDJaasa's cut
            bearer: 'subaccount', // Vendor pays Paystack fees
            callback_url: `${API_URL}/api/webhooks/paystack/order`,
            metadata: {
                tenantId,
                orderId,
                type: 'order',
                customerPhone,
                orderSummary
            }
        });

        return {
            success: true,
            paymentUrl: response.data.data.authorization_url,
            reference: response.data.data.reference
        };
    } catch (error: any) {
        console.error('[Paystack] Payment link error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || error.message
        };
    }
};

/**
 * List available banks for subaccount creation
 */
export const listBanks = async (country: string = 'côte d\'ivoire') => {
    try {
        const response = await paystackApi.get('/bank', {
            params: { country, use_cursor: false, perPage: 100 }
        });

        return {
            success: true,
            banks: response.data.data.map((bank: any) => ({
                name: bank.name,
                code: bank.code,
                type: bank.type
            }))
        };
    } catch (error: any) {
        console.error('[Paystack] List banks error:', error.response?.data || error.message);
        return { success: false, banks: [] };
    }
};

/**
 * Verify bank account number
 */
export const verifyAccountNumber = async (accountNumber: string, bankCode: string) => {
    try {
        const response = await paystackApi.get('/bank/resolve', {
            params: { account_number: accountNumber, bank_code: bankCode }
        });

        return {
            success: true,
            accountName: response.data.data.account_name,
            accountNumber: response.data.data.account_number
        };
    } catch (error: any) {
        console.error('[Paystack] Verify account error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.message || 'Numéro de compte invalide'
        };
    }
};

// ============================================
// WEBHOOK HANDLERS
// ============================================

export const handlePaystackWebhook = async (event: string, data: any) => {
    console.log(`[Paystack Webhook] Event: ${event}`);

    switch (event) {
        case 'charge.success':
            const metadata = data.metadata;

            if (metadata?.type === 'subscription') {
                // Handle subscription payment success
                console.log(`[Paystack] Subscription payment successful for tenant ${metadata.tenantId}`);
                // Update tenant subscription status
                // await db.activateSubscription(metadata.tenantId, metadata.plan);
            } else if (metadata?.type === 'order') {
                // Handle order payment success
                console.log(`[Paystack] Order payment successful: ${metadata.orderId}`);
                // Update order status to PAID
                await db.updateOrderStatus(metadata.tenantId, metadata.orderId, 'PAID');
            }
            break;

        case 'subscription.create':
            console.log('[Paystack] New subscription created');
            break;

        case 'subscription.disable':
            console.log('[Paystack] Subscription disabled');
            break;

        case 'transfer.success':
            console.log('[Paystack] Transfer to vendor successful');
            break;

        default:
            console.log(`[Paystack] Unhandled event: ${event}`);
    }

    return { received: true };
};

export default {
    initializeSubscription,
    verifyTransaction,
    createVendorSubaccount,
    createOrderPaymentLink,
    listBanks,
    verifyAccountNumber,
    handlePaystackWebhook,
    PLAN_PRICES
};
