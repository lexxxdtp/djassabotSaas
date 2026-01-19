import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import webhookRoutes from './routes/webhookRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import { startAllTenantInstances } from './services/baileysManager';
import authRoutes from './routes/authRoutes';
import aiRoutes from './routes/aiRoutes';
import variationTemplateRoutes from './routes/variationTemplateRoutes';
import paystackRoutes from './routes/paystackRoutes';
import './jobs/abandonedCart'; // Start Cron Jobs
import { db } from './services/dbService';
import { authenticateTenant } from './middleware/auth';

dotenv.config();

// Global Error Handlers
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION:', reason);
});

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for frontend development
app.use(express.json());

// Public Routes (No authentication required)
// IMPORTANT: Register specific routes BEFORE catch-all routes
app.use('/api/auth', authRoutes);

import chatRoutes from './routes/chatRoutes';

// ... (other imports)

// Protected Routes
app.use('/api/whatsapp', whatsappRoutes); // Auth handled inside router
app.use('/api/chats', chatRoutes); // Chat Management
app.use('/api/ai', aiRoutes); // New AI Simulation Routes
app.use('/api', variationTemplateRoutes); // Variation Templates

// Webhooks (Public but should be AFTER specific routes)
app.use('/api/webhooks', webhookRoutes);

// Paystack Payment Routes
app.use('/api/paystack', paystackRoutes);

// Settings (Protected by JWT)
app.get('/api/settings', authenticateTenant, async (req, res) => {
    const settings = await db.getSettings(req.tenantId!);
    res.json(settings);
});

app.post('/api/settings', authenticateTenant, async (req, res) => {
    try {
        console.log(`[API] Updating settings for tenant: ${req.tenantId}`);
        const settings = await db.updateSettings(req.tenantId!, req.body);
        res.json(settings);
    } catch (e: any) {
        console.error('[API] Settings Error Details:', e);
        res.status(500).json({
            error: e.message || 'Failed to update settings',
            details: e.toString()
        });
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

// Dashboard: Activity Feed (The Pulse)
app.get('/api/dashboard/pulse', authenticateTenant, async (req, res) => {
    try {
        const logs = await db.getRecentActivity(req.tenantId!, 20);
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch activity logs' });
    }
});

// Dashboard: Recent Orders (Widget)
app.get('/api/dashboard/recent-orders', authenticateTenant, async (req, res) => {
    try {
        const orders = await db.getRecentOrders(req.tenantId!, 5);
        res.json(orders);
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch recent orders' });
    }
});

// Products (Protected by JWT)
app.get('/api/products', authenticateTenant, async (req, res) => {
    const products = await db.getProducts(req.tenantId!);
    res.json(products);
});

app.post('/api/products', authenticateTenant, async (req, res) => {
    try {
        const product = await db.createProduct(req.tenantId!, req.body);
        res.json(product);
    } catch (e: any) {
        console.error('[API] Create Product Error:', e);
        res.status(500).json({ error: e.message || 'Failed to create product' });
    }
});

app.put('/api/products/:id', authenticateTenant, async (req, res) => {
    try {
        const productId = req.params.id as string;
        const product = await db.updateProduct(req.tenantId!, productId, req.body);
        if (product) res.json(product);
        else res.status(404).json({ error: 'Product not found' });
    } catch (e: any) {
        console.error('[API] Update Product Error:', e);
        res.status(500).json({ error: e.message || 'Failed' });
    }
});

app.delete('/api/products/:id', authenticateTenant, async (req, res) => {
    try {
        const productId = req.params.id as string;
        const success = await db.deleteProduct(req.tenantId!, productId);
        res.json({ success });
    } catch (e: any) {
        console.error('[API] Delete Product Error:', e);
        res.status(500).json({ error: e.message || 'Failed' });
    }
});

// Debug seed endpoint (Protected - only for authenticated users to seed THEIR data)
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
        date.setDate(date.getDate() - Math.floor(Math.random() * 7)); // Last 7 days

        await db.createOrder(
            req.tenantId!, // Use authenticated tenant ID
            '22507000000',
            [{ productId: p.id, quantity: qty, productName: p.name, price: p.price }],
            p.price * qty,
            'Abidjan',
            date
        );
    }
    console.log(`[Seed] ✅ Créé 40 commandes pour tenant ${req.tenantId}`);
    res.json({ success: true, count: 40 });
});

app.get('/', (req: Request, res: Response) => {
    res.send('WhatsApp Commerce Bot Backend is running');
});

app.listen(port, async () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);

    // Start all active tenant WhatsApp sessions
    await startAllTenantInstances();
});
