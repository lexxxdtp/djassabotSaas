import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken, authenticateTenant } from '../middleware/auth';
import { db } from '../services/dbService';

const router = express.Router();

/**
 * POST /api/auth/signup
 * Créer un nouveau tenant + utilisateur
 * Accepte email OU phone (+225XXXXXXXXXX)
 */
router.post('/signup', async (req: Request, res: Response) => {
    try {
        const { businessName, email, phone, password, businessType, fullName, birthDate } = req.body;

        // Validation - au moins email OU phone
        if (!businessName || !password) {
            res.status(400).json({
                error: 'Le nom du commerce et le mot de passe sont requis'
            });
            return;
        }

        if (!email && !phone) {
            res.status(400).json({
                error: 'Vous devez fournir un email ou un numéro de téléphone'
            });
            return;
        }

        // Validation du format téléphone ivoirien (+225XXXXXXXXXX = 10 chiffres)
        if (phone) {
            const phoneRegex = /^\+225[0-9]{10}$/;
            if (!phoneRegex.test(phone)) {
                res.status(400).json({
                    error: 'Format de téléphone invalide. Utilisez: +225XXXXXXXXXX (10 chiffres)'
                });
                return;
            }
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            res.status(400).json({
                error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre'
            });
            return;
        }

        // Vérifier si l'email/phone existe déjà
        const normalizedEmail = email ? email.toLowerCase().trim() : null;
        if (normalizedEmail) {
            const existingUser = await db.getUserByEmail(normalizedEmail);
            if (existingUser) {
                res.status(409).json({ error: 'Cet email est déjà utilisé' });
                return;
            }
        }

        if (phone) {
            const existingUser = await db.getUserByPhone(phone);
            if (existingUser) {
                res.status(409).json({ error: 'Ce numéro de téléphone est déjà utilisé' });
                return;
            }
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
            email: normalizedEmail,
            phone: phone || null,
            fullName: fullName || undefined,
            birthDate: birthDate || undefined,
            passwordHash,
            role: 'owner'
        });

        console.log(`[Signup] ✅ User créé: ${user.id} - ${email || phone}`);

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
            email: user.email || user.phone || ''
        });

        res.status(201).json({
            success: true,
            token,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                businessType: tenant.businessType,
                status: tenant.status,
                subscription_tier: tenant.subscriptionTier
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
 * Connexion d'un utilisateur (email OU téléphone)
 */
router.post('/login', async (req: Request, res: Response) => {
    try {
        const { identifier, password } = req.body; // identifier peut être email ou phone

        // Validation
        if (!identifier || !password) {
            res.status(400).json({
                error: 'Email/Téléphone et mot de passe requis'
            });
            return;
        }

        // 1. Détecter si c'est un email ou un téléphone
        const isPhone = identifier.startsWith('+225');
        let user = null;

        if (isPhone) {
            user = await db.getUserByPhone(identifier);
        } else {
            const normalizedIdentifier = identifier.toLowerCase().trim();
            user = await db.getUserByEmail(normalizedIdentifier);
        }

        if (!user) {
            res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
            return;
        }

        // 2. Vérifier le mot de passe
        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
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
            tenantId: tenant.id,
            userId: user.id,
            email: user.email || user.phone || ''
        });

        console.log(`[Login] ✅ ${user.email || user.phone} connecté (Tenant: ${tenant.name})`);

        res.json({
            success: true,
            token,
            tenant: {
                id: tenant.id,
                name: tenant.name,
                businessType: tenant.businessType,
                status: tenant.status,
                subscription_tier: tenant.subscriptionTier,
                whatsappConnected: tenant.whatsappConnected
            },
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
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
router.get('/me', authenticateTenant, async (req: Request, res: Response) => {
    try {
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
                phone: user.phone,
                full_name: user.full_name,
                birth_date: user.birth_date,
                role: user.role
            },
            tenant: {
                id: tenant.id,
                name: tenant.name,
                businessType: tenant.businessType,
                status: tenant.status,
                subscription_tier: tenant.subscriptionTier,
                whatsappConnected: tenant.whatsappConnected
            }
        });
    } catch (error: any) {
        console.error('[Me] Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/auth/me
 * Mettre à jour le profil utilisateur
 */
router.put('/me', authenticateTenant, async (req: Request, res: Response) => {
    try {
        console.log('[Update Me] 📝 Requête reçue:', {
            userId: req.userId,
            body: req.body
        });

        const { userId } = req;
        const { full_name, email, phone, birth_date } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'Non authentifié' });
            return;
        }

        const updates: any = {};
        if (full_name !== undefined) updates.full_name = full_name;
        if (email !== undefined) updates.email = email;
        if (phone !== undefined) updates.phone = phone;
        if (birth_date !== undefined) updates.birth_date = birth_date;

        const updatedUser = await db.updateUser(userId, updates);

        if (!updatedUser) {
            res.status(404).json({ error: 'Utilisateur introuvable' });
            return;
        }

        res.json({
            success: true,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                phone: updatedUser.phone,
                full_name: updatedUser.full_name,
                birth_date: updatedUser.birth_date,
                role: updatedUser.role
            }
        });
    } catch (error: any) {
        console.error('[Update Me] Erreur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

export default router;
