import express from 'express';
import crypto from 'crypto';
import { authenticateTenant } from '../middleware/auth';
import paystackService from '../services/paystackService';
import { db } from '../services/dbService';

const router = express.Router();

// ============================================
// SUBSCRIPTION ROUTES (Protected)
// ============================================

/**
 * GET /api/paystack/plans
 * Get available subscription plans with prices
 */
router.get('/plans', (req, res) => {
    res.json({
        plans: [
            {
                id: 'starter',
                name: 'Starter',
                price: 5000,
                currency: 'XOF',
                features: [
                    'Bot IA WhatsApp',
                    'Gestion des produits',
                    '50 produits max',
                    'Support email'
                ]
            },
            {
                id: 'pro',
                name: 'Pro',
                price: 10000,
                currency: 'XOF',
                features: [
                    'Tout du Starter +',
                    'Produits illimités',
                    'IA Négociatrice avancée',
                    'Statistiques détaillées',
                    'Support prioritaire'
                ]
            },
            {
                id: 'business',
                name: 'Business',
                price: 15000,
                currency: 'XOF',
                features: [
                    'Tout du Pro +',
                    'Support VIP',
                    'Formation personnalisée',
                    'Configuration sur mesure'
                ]
            }
        ]
    });
});

/**
 * POST /api/paystack/subscribe
 * Initialize a subscription payment
 */
router.post('/subscribe', authenticateTenant, async (req, res) => {
    try {
        const { plan } = req.body;
        const tenantId = req.tenantId!;

        if (!['starter', 'pro', 'business'].includes(plan)) {
            return res.status(400).json({ error: 'Plan invalide' });
        }

        // Get tenant email
        const tenant = await db.getTenantById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Get user email (assuming we have it from the user table)
        // For now, we'll use a placeholder or require it in the request
        const email = req.body.email || 'customer@example.com';

        const result = await paystackService.initializeSubscription(
            tenantId,
            email,
            plan as 'starter' | 'pro' | 'business'
        );

        if (result.success) {
            res.json({
                success: true,
                paymentUrl: result.authorizationUrl,
                reference: result.reference
            });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error: any) {
        console.error('[API] Subscribe error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/paystack/verify/:reference
 * Verify a payment transaction
 */
router.get('/verify/:reference', authenticateTenant, async (req, res) => {
    try {
        const result = await paystackService.verifyTransaction(req.params.reference);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// VENDOR SUBACCOUNT ROUTES (Protected)
// ============================================

/**
 * GET /api/paystack/banks
 * List available banks for vendor setup
 */
router.get('/banks', authenticateTenant, async (req, res) => {
    try {
        const result = await paystackService.listBanks();
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/paystack/verify-account
 * Verify a bank account number
 */
router.post('/verify-account', authenticateTenant, async (req, res) => {
    try {
        const { accountNumber, bankCode } = req.body;

        if (!accountNumber || !bankCode) {
            return res.status(400).json({ error: 'accountNumber et bankCode requis' });
        }

        const result = await paystackService.verifyAccountNumber(accountNumber, bankCode);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/paystack/setup-vendor
 * Create a subaccount for the vendor to receive payments
 */
router.post('/setup-vendor', authenticateTenant, async (req, res) => {
    try {
        const { bankCode, settlement_bank, accountNumber, account_number, email, phone } = req.body;
        const tenantId = req.tenantId!;
        const finalBankCode = bankCode || settlement_bank;
        const finalAccountNumber = accountNumber || account_number;

        if (!finalBankCode || !finalAccountNumber) {
            return res.status(400).json({ error: 'Coordonnées bancaires requises (bankCode/settlement_bank et accountNumber)' });
        }

        // Get tenant info
        const tenant = await db.getTenantById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // Try to get user email if not provided
        let contactEmail = email;
        if (!contactEmail) {
            const user = await db.getUserById(req.userId!);
            contactEmail = user?.email || 'vendor@djassabot.com';
        }

        const result = await paystackService.createVendorSubaccount(
            tenantId,
            tenant.name,
            finalBankCode,
            finalAccountNumber,
            contactEmail,
            phone
        );

        if (result.success) {
            // TODO: Save subaccount code to tenant
            res.json({
                success: true,
                subaccountCode: result.subaccountCode,
                message: 'Compte vendeur configuré avec succès'
            });
        } else {
            res.status(400).json({ success: false, error: result.error });
        }
    } catch (error: any) {
        console.error('[API] Setup vendor error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/paystack/create-payment-link
 * Generate a payment link for a customer order
 */
router.post('/create-payment-link', authenticateTenant, async (req, res) => {
    try {
        const { orderId, amount, customerEmail, customerPhone, orderSummary } = req.body;
        const tenantId = req.tenantId!;

        // Get tenant's subaccount code
        const tenant = await db.getTenantById(tenantId);
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant non trouvé' });
        }

        // For now, check if subaccount exists (would be stored in tenant record)
        const subaccountCode = (tenant as any).paystackSubaccountCode;
        if (!subaccountCode) {
            return res.status(400).json({
                error: 'Veuillez d\'abord configurer votre compte de paiement dans les paramètres'
            });
        }

        const result = await paystackService.createOrderPaymentLink(
            tenantId,
            orderId,
            amount,
            customerEmail,
            customerPhone,
            subaccountCode,
            orderSummary
        );

        res.json(result);
    } catch (error: any) {
        console.error('[API] Create payment link error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// WEBHOOK ROUTE (Public - verified by signature)
// ============================================

/**
 * POST /api/paystack/webhook
 * Handle Paystack webhook events
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';

        // Verify webhook signature
        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET)
            .update(JSON.stringify(req.body))
            .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            console.warn('[Paystack Webhook] Invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = req.body;
        console.log(`[Paystack Webhook] Received: ${event.event}`);

        await paystackService.handlePaystackWebhook(event.event, event.data);

        res.status(200).json({ received: true });
    } catch (error: any) {
        console.error('[Paystack Webhook] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
