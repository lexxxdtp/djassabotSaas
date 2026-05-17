import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
// import webhookRoutes from './routes/webhookRoutes'; // DISABLED — DEFAULT_TENANT_ID bug, see CLAUDE_ROADMAP.md
import whatsappRoutes from './routes/whatsappRoutes';
import { startAllTenantInstances } from './services/baileysManager';
import authRoutes from './routes/authRoutes';
import aiRoutes from './routes/aiRoutes';
import variationTemplateRoutes from './routes/variationTemplateRoutes';
import paystackRoutes from './routes/paystackRoutes';
import chatRoutes from './routes/chatRoutes';
import './jobs/abandonedCart';
import { db } from './services/dbService';
import { authenticateTenant } from './middleware/auth';
import { logger } from './utils/logger';

dotenv.config();

process.on('uncaughtException', (err) => {
    logger.error({ err }, 'UNCAUGHT EXCEPTION');
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'UNHANDLED REJECTION');
});

const app = express();
const port = process.env.PORT || 3000;

// Trust the reverse proxy (nginx) — needed for correct client IP detection
// behind nginx for express-rate-limit and other middleware.
app.set('trust proxy', 1);

// CORS — restrict to known origins
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
}));

app.use(express.json());

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutes
    max: 5,
    message: { error: 'Trop de demandes de code. Réessayez dans 10 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Public Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth/send-otp', otpLimiter);
app.use('/api/auth/forgot-password', otpLimiter);
app.use('/api/auth', authRoutes);

// Protected Routes
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', variationTemplateRoutes);

// WhatsApp Cloud API webhook — DISABLED.
// The webhook controller uses a hardcoded DEFAULT_TENANT_ID which routes all incoming
// messages to a fictitious tenant. Baileys is the primary WhatsApp integration (per-tenant,
// proper isolation). Re-enable only after implementing a real phone-number → tenant mapping.
// app.use('/api/webhooks', webhookRoutes);

// Paystack Payment Routes
app.use('/api/paystack', paystackRoutes);

// Settings (Protected by JWT)
app.get('/api/settings', authenticateTenant, async (req, res) => {
    const settings = await db.getSettings(req.tenantId!);
    res.json(settings);
});

app.post('/api/settings', authenticateTenant, async (req, res) => {
    try {
        logger.info({ tenantId: req.tenantId }, 'Updating settings');
        const settings = await db.updateSettings(req.tenantId!, req.body);
        res.json(settings);
    } catch (e: any) {
        logger.error({ err: e, tenantId: req.tenantId }, 'Settings update error');
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// Orders (Protected by JWT)
app.get('/api/orders', authenticateTenant, async (req, res) => {
    const orders = await db.getOrders(req.tenantId!);
    res.json(orders);
});

app.put('/api/orders/:id/status', authenticateTenant, async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id as string;
    const updated = await db.updateOrderStatus(req.tenantId!, orderId, status);
    if (updated) res.json(updated);
    else res.status(400).json({ error: 'Failed to update status' });
});

// Dashboard
app.get('/api/dashboard/pulse', authenticateTenant, async (req, res) => {
    try {
        const logs = await db.getRecentActivity(req.tenantId!, 20);
        res.json(logs);
    } catch {
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

app.get('/api/dashboard/recent-orders', authenticateTenant, async (req, res) => {
    try {
        const orders = await db.getRecentOrders(req.tenantId!, 5);
        res.json(orders);
    } catch {
        res.status(500).json({ error: 'Failed to fetch recent orders' });
    }
});

// Products (Protected by JWT) — minPrice stripped from response
app.get('/api/products', authenticateTenant, async (req, res) => {
    const products = await db.getProducts(req.tenantId!);
    // Never expose minPrice to the frontend (used only by AI internally)
    const sanitized = products.map(({ minPrice: _mp, ...p }: any) => p);
    res.json(sanitized);
});

app.post('/api/products', authenticateTenant, async (req, res) => {
    try {
        const { name, price, stock } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Nom du produit requis' });
        }
        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
            return res.status(400).json({ error: 'Prix invalide' });
        }
        if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
            return res.status(400).json({ error: 'Stock invalide' });
        }
        const product = await db.createProduct(req.tenantId!, req.body);
        res.json(product);
    } catch (e: any) {
        logger.error({ err: e, tenantId: req.tenantId }, 'Create product error');
        res.status(500).json({ error: 'Failed to create product' });
    }
});

app.put('/api/products/:id', authenticateTenant, async (req, res) => {
    try {
        const productId = req.params.id as string;
        const { price, stock } = req.body;
        if (price !== undefined && (typeof price !== 'number' || price < 0)) {
            return res.status(400).json({ error: 'Prix invalide' });
        }
        if (stock !== undefined && (typeof stock !== 'number' || stock < 0)) {
            return res.status(400).json({ error: 'Stock invalide' });
        }
        const product = await db.updateProduct(req.tenantId!, productId, req.body);
        if (product) res.json(product);
        else res.status(404).json({ error: 'Product not found' });
    } catch (e: any) {
        logger.error({ err: e, tenantId: req.tenantId }, 'Update product error');
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.delete('/api/products/:id', authenticateTenant, async (req, res) => {
    try {
        const productId = req.params.id as string;
        const success = await db.deleteProduct(req.tenantId!, productId);
        res.json({ success });
    } catch (e: any) {
        logger.error({ err: e, tenantId: req.tenantId }, 'Delete product error');
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// Seed (Protected — debug only)
app.post('/api/debug/seed', authenticateTenant, async (req, res) => {
    const products = [
        { id: '1', name: 'Bazin Riche', price: 15000 },
        { id: '2', name: 'Mèche Humaine', price: 45000 },
        { id: '3', name: 'Perruque Lisse', price: 25000 },
        { id: '4', name: 'Tissage Brésilien', price: 30000 },
        { id: '5', name: 'Chaussure Talon', price: 14000 }
    ];

    for (let i = 0; i < 40; i++) {
        const p = products[Math.floor(Math.random() * products.length)];
        const qty = Math.floor(Math.random() * 3) + 1;
        const date = new Date();
        date.setDate(date.getDate() - Math.floor(Math.random() * 7));
        await db.createOrder(
            req.tenantId!,
            '22507000000',
            [{ productId: p.id, quantity: qty, productName: p.name, price: p.price }],
            p.price * qty,
            'Abidjan',
            date
        );
    }
    logger.info({ tenantId: req.tenantId }, 'Seeded 40 orders');
    res.json({ success: true, count: 40 });
});

app.get('/', (_req: Request, res: Response) => {
    res.send('WhatsApp Commerce Bot Backend is running');
});

app.listen(port, async () => {
    logger.info({ port }, 'Server started');
    await startAllTenantInstances();
});
