import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth';
import { db } from '../services/dbService';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Créer un nouveau tenant + utilisateur
 */
router.post('/signup', async (req: Request, res: Response) => {
    try {
        const { businessName, email, password, businessType } = req.body;

        // Validation
        if (!businessName || !email || !password) {
            res.status(400).json({
                error: 'Tous les champs sont requis (businessName, email, password)'
            });
            return;
        }

        if (password.length < 8) {
            res.status(400).json({
                error: 'Le mot de passe doit contenir au moins 8 caractères'
            });
            return;
        }

        // Vérifier si l'email existe déjà
        const existingUser = await db.getUserByEmail(email);
        if (existingUser) {
            res.status(409).json({ error: 'Cet email est déjà utilisé' });
            return;
        }

        // 1. Créer le tenant
        const tenant = await db.createTenant({
            name: businessName,
            businessType: businessType || 'boutique'
        });

        console.log(`[Signup] ✅ Tenant créé: ${tenant.id} - ${businessName}`);

        // 2. Hasher le mot de passe
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Créer l'utilisateur
        const user = await db.createUser({
            tenantId: tenant.id,
            email,
            passwordHash,
            role: 'owner'
        });

        console.log(`[Signup] ✅ User créé: ${user.id} - ${email}`);

        // 4. Créer les settings par défaut
        await db.createDefaultSettings(tenant.id, businessName);

        // 5. Créer l'abonnement trial (30 jours)
        await db.createSubscription({
            tenantId: tenant.id,
            plan: 'starter',
            status: 'trial',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
        });

        // 6. Générer le JWT
        const token = generateToken({
            tenantId: tenant.id,
            userId: user.id,
            email: user.email
        });

        res.status(201).json({
            success: true,
            token,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                businessType: tenant.businessType
            },
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error: any) {
        console.error('[Signup] Erreur:', error);
        res.status(500).json({
            error: 'Erreur lors de la création du compte',
            details: error.message
        });
    }
});

/**
 * POST /api/auth/login
 * Connexion d'un utilisateur
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            res.status(400).json({
                error: 'Email et mot de passe requis'
            });
            return;
        }

        // 1. Récupérer l'utilisateur
        const user = await db.getUserByEmail(email);

        if (!user) {
            res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            return;
        }

        // 2. Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            res.status(401).json({ error: 'Email ou mot de passe incorrect' });
            return;
        }

        // 3. Récupérer le tenant
        const tenant = await db.getTenantById(user.tenantId);

        if (!tenant) {
            res.status(404).json({ error: 'Compte introuvable' });
            return;
        }

        // 4. Vérifier le statut du tenant
        if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
            res.status(403).json({
                error: `Compte ${tenant.status === 'suspended' ? 'suspendu' : 'annulé'}. Contactez le support.`
            });
            return;
        }

        // 5. Générer le JWT
        const token = generateToken({
            tenantId: user.tenantId,
            userId: user.id,
            email: user.email
        });

        console.log(`[Login] ✅ ${email} connecté (Tenant: ${tenant.name})`);

        res.json({
            success: true,
            token,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                businessType: tenant.businessType,
                status: tenant.status,
                whatsappConnected: tenant.whatsappConnected
            },
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            }
        });

    } catch (error: any) {
        console.error('[Login] Erreur:', error);
        res.status(500).json({
            error: 'Erreur lors de la connexion',
            details: error.message
        });
    }
});

/**
 * GET /api/auth/me
 * Récupérer les infos du user connecté
 */
router.get('/me', async (req: Request, res: Response) => {
    try {
        // Note: Cette route doit être protégée par authenticateTenant middleware
        const { tenantId, userId } = req;

        if (!tenantId || !userId) {
            res.status(401).json({ error: 'Non authentifié' });
            return;
        }

        const user = await db.getUserById(userId);
        const tenant = await db.getTenantById(tenantId);

        if (!user || !tenant) {
            res.status(404).json({ error: 'Utilisateur ou tenant introuvable' });
            return;
        }

        res.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                businessType: tenant.businessType,
                status: tenant.status,
                whatsappConnected: tenant.whatsappConnected
            }
        });

    } catch (error: any) {
        console.error('[Me] Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
