import express from 'express';
import crypto from 'crypto';
import { authenticateTenant } from '../middleware/auth';
import paystackService from '../services/paystackService';
import { db } from '../services/dbService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Une adresse utilisable pour un paiement : bien formée, et pas un bouche-trou.
 * « user@example.com » et « vendor@djassabot.com » circulaient et satisfaisaient
 * toute vérification de présence, tout en n'appartenant à personne.
 */
const PLACEHOLDER_EMAIL_DOMAINS = ['example.com', 'example.org', 'test.com', 'djassabot.com'];

function isUsablePaymentEmail(email: unknown): email is string {
    if (typeof email !== 'string') return false;
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(value)) return false;
    return !PLACEHOLDER_EMAIL_DOMAINS.some(domain => value.endsWith(`@${domain}`));
}

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

        // Paystack envoie le reçu à cette adresse : elle doit être RÉELLE.
        // Les comptes créés par téléphone n'en ont pas ; le client en demande
        // une plutôt que d'en inventer, sinon le vendeur paie sans jamais
        // recevoir la moindre preuve de paiement.
        let email = req.body.email;
        if (!email) {
            const user = await db.getUserById(req.userId!);
            email = user?.email;
        }
        if (!isUsablePaymentEmail(email)) {
            return res.status(400).json({
                error: 'Une adresse e-mail valide est nécessaire : c\'est là que Paystack envoie votre reçu.',
                code: 'PAYMENT_EMAIL_REQUIRED',
            });
        }

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
        res.status(500).json({ error: 'Impossible de démarrer le paiement. Réessayez dans un instant.' });
    }
});

/**
 * GET /api/paystack/verify/:reference
 * Verify a payment transaction
 */
router.get('/verify/:reference', authenticateTenant, async (req, res) => {
    try {
        const reference = req.params.reference as string;
        const result = await paystackService.verifyTransaction(reference);
        res.json(result);
    } catch (error: any) {
        console.error('[API] Verify transaction error:', error);
        res.status(500).json({ error: 'Impossible de vérifier ce paiement pour le moment.' });
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
        console.error('[API] List banks error:', error);
        res.status(500).json({ error: 'Liste des banques indisponible pour le moment.' });
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
        console.error('[API] Verify account error:', error);
        res.status(500).json({ error: 'Impossible de vérifier ce compte bancaire pour le moment.' });
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

        // Jamais d'adresse inventée : « vendor@djassabot.com » était la même
        // pour tous les vendeurs, sur un domaine qui n'existe pas. Les
        // notifications Paystack du sous-compte n'arrivaient donc à personne.
        let contactEmail = email;
        if (!contactEmail) {
            const user = await db.getUserById(req.userId!);
            contactEmail = user?.email;
        }
        if (!isUsablePaymentEmail(contactEmail)) {
            return res.status(400).json({
                error: 'Une adresse e-mail valide est nécessaire pour recevoir les notifications de paiement.',
                code: 'PAYMENT_EMAIL_REQUIRED',
            });
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
            // Subaccount code is saved inside createVendorSubaccount
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
        res.status(500).json({ error: 'Impossible de configurer le compte vendeur pour le moment.' });
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
        res.status(500).json({ error: 'Impossible de générer le lien de paiement pour le moment.' });
    }
});

// ============================================
// WEBHOOK ROUTE (Public - verified by signature)
// ============================================

/**
 * POST /api/paystack/webhook
 * Handle Paystack webhook events
 */
router.post('/webhook', async (req: any, res) => {
    try {
        const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
        // Sans secret configuré, on ne peut PAS authentifier le webhook → on refuse
        // (sinon un HMAC à clé vide laisserait passer des requêtes forgées).
        if (!PAYSTACK_SECRET) {
            logger.error('Paystack webhook: PAYSTACK_SECRET_KEY manquant — webhook refusé');
            return res.status(503).json({ error: 'Webhook non configuré' });
        }

        // rawBody est capturé dans index.ts (express.json verify). Le fallback
        // JSON.stringify ne reproduit pas l'octet exact signé par Paystack et
        // ferait échouer toutes les signatures — donc on l'exige.
        if (!req.rawBody) {
            logger.error('Paystack webhook: rawBody manquant — impossible de vérifier la signature');
            return res.status(400).json({ error: 'Corps de requête invalide' });
        }

        const hash = crypto
            .createHmac('sha512', PAYSTACK_SECRET)
            .update(req.rawBody)
            .digest('hex');

        const signature = req.headers['x-paystack-signature'];
        // Comparaison à temps constant pour éviter les attaques par timing.
        const expected = Buffer.from(hash, 'utf8');
        const received = Buffer.from(typeof signature === 'string' ? signature : '', 'utf8');
        if (
            expected.length !== received.length ||
            !crypto.timingSafeEqual(expected, received)
        ) {
            logger.warn('Paystack webhook: invalid signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        const event = req.body;
        logger.info({ event: event?.event }, 'Paystack webhook received');

        await paystackService.handlePaystackWebhook(event.event, event.data);

        res.status(200).json({ received: true });
    } catch (error: any) {
        logger.error({ err: error }, 'Paystack webhook error');
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

export default router;
