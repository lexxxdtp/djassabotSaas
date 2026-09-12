import axios from 'axios';
import { db } from './dbService';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://djassabot-saas.vercel.app';
const API_URL = process.env.API_URL || 'https://djassabot-saas-production.up.railway.app';

// Plan codes from Paystack Dashboard
const PLAN_CODES: Record<string, string> = {
    starter: process.env.PAYSTACK_PLAN_STARTER || '',
    pro: process.env.PAYSTACK_PLAN_PRO || '',
    business: process.env.PAYSTACK_PLAN_BUSINESS || ''
};

// Plan prices in FCFA
const PLAN_PRICES: Record<string, number> = {
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
        // Map common names to codes if necessary
        let finalBankCode = bankCode;
        if (bankCode === 'MTN') finalBankCode = 'MTN';
        if (bankCode === 'Orange Money') finalBankCode = 'ORM';
        if (bankCode === 'Wave') finalBankCode = 'WAVE';

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
            transaction_charge: commission * 100,
            bearer: 'subaccount',
            // Redirect user to FRONTEND success page
            callback_url: `${FRONTEND_URL}/order-confirmation?orderId=${orderId}`,
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

/**
 * Traite un événement Paystack.
 *
 * Deux règles tiennent tout le reste :
 * - Une écriture ratée LÈVE. La route répond alors 500 et Paystack retente.
 *   Acquitter un événement qu'on n'a pas su enregistrer, c'est encaisser un
 *   paiement sans livrer l'abonnement, sans jamais le revoir passer.
 * - La métadonnée ne fait pas foi sur le montant. Elle dit quel plan le client
 *   a choisi ; seul le montant réellement payé décide de ce qu'il reçoit.
 */
export const handlePaystackWebhook = async (event: string, data: any) => {
    console.log(`[Paystack Webhook] Event: ${event}`);

    if (event !== 'charge.success') {
        console.log(`[Paystack] Événement sans effet ici : ${event}`);
        return { received: true };
    }

    const metadata = data?.metadata;
    const reference: string | undefined = data?.reference;
    const tenantId: string | undefined = metadata?.tenantId;

    if (!tenantId || !reference) {
        console.warn('[Paystack] charge.success sans tenantId ou référence — ignoré');
        return { received: true };
    }

    // Le registre SQL fait une prise atomique de la référence. Une recherche puis
    // une insertion dans activity_logs laisserait passer deux webhooks simultanés.
    const claim = await db.claimPaystackEvent(tenantId, reference, event, {
        type: metadata.type,
        plan: metadata.plan,
        orderId: metadata.orderId,
        amount: data.amount,
        currency: data.currency,
    });
    if (claim === 'completed') {
        console.log(`[Paystack] Référence ${reference} déjà traitée — ignorée`);
        return { received: true };
    }
    if (claim === 'processing') {
        // Ne pas acquitter pendant qu'un autre worker travaille : si celui-ci
        // tombe, Paystack doit représenter l'événement.
        throw new Error(`Référence Paystack ${reference} déjà en cours de traitement`);
    }

    try {
        if (metadata.type === 'subscription') {
            const plan = metadata.plan;
            const expectedAmount = PLAN_PRICES[plan];

            // Le montant payé décide, pas la métadonnée : un paiement de 100 FCFA
            // annoncé « business » ne doit pas ouvrir un abonnement à 15 000.
            if (!expectedAmount) {
                console.error(`[Paystack] Plan inconnu « ${plan} » pour ${tenantId} — abonnement NON activé`);
                await db.logActivity(tenantId, 'warning', `Paiement reçu pour un plan inconnu (${plan}). Abonnement non activé, contactez le support.`, { paystackReference: reference, plan });
                await db.completePaystackEvent(tenantId, reference);
                return { received: true };
            }
            if (data.currency !== 'XOF' || data.amount !== expectedAmount * 100) {
                console.error(`[Paystack] Montant inattendu pour ${tenantId} : ${data.amount} ${data.currency} au lieu de ${expectedAmount * 100} XOF`);
                await db.logActivity(tenantId, 'warning', `Paiement d'un montant inattendu (${data.amount} ${data.currency}). Abonnement non activé, contactez le support.`, { paystackReference: reference, plan, amount: data.amount, currency: data.currency });
                await db.completePaystackEvent(tenantId, reference);
                return { received: true };
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);
            await db.createSubscription({ tenantId, plan, status: 'active', expiresAt, paymentReference: reference });
            await db.completePaystackEvent(tenantId, reference);
            await db.logActivity(tenantId, 'action', `Abonnement ${plan} activé pour 30 jours`, { paystackReference: reference, plan });
            console.log(`[Paystack] ✅ Tenant ${tenantId} subscription activated.`);
            return { received: true };
        }

        if (metadata.type === 'order') {
            const order = await db.getOrderById(tenantId, metadata.orderId);
            if (!order) {
                // Un paiement réel sans commande exige une reprise ou une intervention.
                // L'acquitter le ferait disparaître définitivement des tentatives.
                throw new Error(`Commande ${metadata.orderId} introuvable pour le paiement ${reference}`);
            }
            // Un sous-paiement ne vaut pas commande payée.
            if (data.currency !== 'XOF' || data.amount < order.total * 100) {
                console.error(`[Paystack] Paiement insuffisant sur ${order.id} : ${data.amount} ${data.currency} pour ${order.total * 100} XOF attendus`);
                await db.logActivity(tenantId, 'warning', `Paiement insuffisant sur la commande ${String(order.id).split('-')[1] ?? order.id}. Statut inchangé.`, { paystackReference: reference, orderId: order.id, amount: data.amount, expected: order.total * 100 });
                await db.completePaystackEvent(tenantId, reference);
                return { received: true };
            }

            const updated = await db.updateOrderStatus(tenantId, order.id, 'PAID');
            if (!updated) throw new Error(`Commande ${order.id} non marquée payée`);
            await db.completePaystackEvent(tenantId, reference);
            await db.logActivity(tenantId, 'action', `Commande ${String(order.id).split('-')[1] ?? order.id} payée par Paystack`, { paystackReference: reference, orderId: order.id });
            return { received: true };
        }

        console.warn(`[Paystack] Type de métadonnée inconnu : ${metadata.type}`);
        await db.completePaystackEvent(tenantId, reference);
        return { received: true };
    } catch (error) {
        try {
            await db.failPaystackEvent(tenantId, reference, error instanceof Error ? error.message : String(error));
        } catch (ledgerError) {
            console.error('[Paystack] Impossible de marquer le webhook en échec', ledgerError);
        }
        throw error;
    }
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
