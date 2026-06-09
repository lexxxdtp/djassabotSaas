import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { generateToken } from '../middleware/auth';
import { db } from '../services/dbService';
import { sendOtpEmail, sendPasswordResetEmail } from '../services/resendService';
import { verifyPhoneToken, isFirebaseAdminConfigured } from '../services/firebaseAdminService';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

export const signup = async (req: Request, res: Response) => {
    try {
        const { businessName, email, phone, password, businessType, fullName, birthDate, phoneIdToken, emailVerified } = req.body;

        if (!businessName || !password) {
            res.status(400).json({ error: 'Le nom du commerce et le mot de passe sont requis' });
            return;
        }

        if (!email && !phone) {
            res.status(400).json({ error: 'Vous devez fournir un email ou un numéro de téléphone' });
            return;
        }

        if (phone) {
            const phoneRegex = /^\+225[0-9]{10}$/;
            if (!phoneRegex.test(phone)) {
                res.status(400).json({ error: 'Format de téléphone invalide. Utilisez: +225XXXXXXXXXX (10 chiffres)' });
                return;
            }
        }

        // Phone verification will be done after signup on the verification page.

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
            return;
        }

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

        const tenant = await db.createTenant({
            name: businessName,
            businessType: businessType || 'boutique'
        });

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await db.createUser({
            tenantId: tenant.id,
            email: normalizedEmail,
            phone: phone || null,
            fullName: fullName || undefined,
            birthDate: birthDate || undefined,
            passwordHash,
            role: 'owner'
        });

        // Account created. Email and Phone will be verified after signup.

        await db.createDefaultSettings(tenant.id, businessName);

        await db.createSubscription({
            tenantId: tenant.id,
            plan: 'starter',
            status: 'trial',
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });

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
                role: user.role,
                phoneVerified: user.phoneVerified || false,
                emailVerified: user.emailVerified || false,
                message: normalizedEmail ? "Rendez-vous dans vos emails pour valider votre compte." : undefined
            }
        });

    } catch (error: any) {
        logger.error({ err: error }, 'Signup error');
        res.status(500).json({ error: 'Erreur lors de la création du compte' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { identifier, password } = req.body;

        if (!identifier || !password) {
            res.status(400).json({ error: 'Email/Téléphone et mot de passe requis' });
            return;
        }

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

        const validPassword = await bcrypt.compare(password, user.passwordHash);

        if (!validPassword) {
            res.status(401).json({ error: 'Identifiant ou mot de passe incorrect' });
            return;
        }

        const tenant = await db.getTenantById(user.tenantId);

        if (!tenant) {
            res.status(404).json({ error: 'Compte introuvable' });
            return;
        }

        if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
            res.status(403).json({ error: `Compte ${tenant.status === 'suspended' ? 'suspendu' : 'annulé'}. Contactez le support.` });
            return;
        }

        const token = generateToken({
            tenantId: tenant.id,
            userId: user.id,
            email: user.email || user.phone || ''
        });

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
                role: user.role,
                phoneVerified: user.phoneVerified || false,
                emailVerified: user.emailVerified || false
            }
        });

    } catch (error: any) {
        logger.error({ err: error }, 'Login error');
        res.status(500).json({ error: 'Erreur lors de la connexion' });
    }
};

export const getMe = async (req: Request, res: Response) => {
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
                role: user.role,
                phoneVerified: user.phoneVerified || false,
                emailVerified: user.emailVerified || false
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
        logger.error({ err: error }, 'GetMe error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const updateMe = async (req: Request, res: Response) => {
    try {
        const { userId } = req;
        const { full_name, email, phone, birth_date } = req.body;

        if (!userId) {
            res.status(401).json({ error: 'Non authentifié' });
            return;
        }

        const updates: Record<string, string> = {};

        if (full_name !== undefined) {
            if (typeof full_name !== 'string' || full_name.trim().length === 0 || full_name.length > 100) {
                res.status(400).json({ error: 'Nom invalide (1-100 caractères)' });
                return;
            }
            updates.full_name = full_name.trim();
        }

        if (email !== undefined) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                res.status(400).json({ error: 'Format email invalide' });
                return;
            }
            updates.email = email.toLowerCase().trim();
        }

        if (phone !== undefined) {
            const phoneRegex = /^\+225[0-9]{10}$/;
            if (!phoneRegex.test(phone)) {
                res.status(400).json({ error: 'Format de téléphone invalide. Utilisez: +225XXXXXXXXXX' });
                return;
            }
            updates.phone = phone;
        }

        if (birth_date !== undefined) {
            const date = new Date(birth_date);
            if (isNaN(date.getTime())) {
                res.status(400).json({ error: 'Date de naissance invalide' });
                return;
            }
            updates.birth_date = birth_date;
        }

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
        logger.error({ err: error }, 'UpdateMe error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

/**
 * Mot de passe oublié via numéro de téléphone
 * - Si l'utilisateur a un email → envoie un lien de reset par email
 * - Si OTP Firebase vérifié (otpVerified=true) ET pas d'email → retourne un resetToken directement
 * - Si aucun email et pas d'OTP → retourne hasEmail:false
 */
export const forgotPasswordPhone = async (req: Request, res: Response) => {
    try {
        const { phone, phoneIdToken } = req.body;
        if (!phone) {
            res.status(400).json({ error: 'Numéro de téléphone requis' });
            return;
        }

        const user = await db.getUserByPhone(phone);

        // Ne jamais révéler si le numéro existe ou non
        if (!user) {
            res.json({ success: true, hasEmail: false });
            return;
        }

        // Si l'utilisateur a un email, on envoie un lien de reset par email (pas besoin d'OTP)
        if (user.email) {
            const resetToken = uuidv4();
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
            await db.storeAuthToken(user.id, 'PASSWORD_RESET', resetToken, expiresAt);
            await sendPasswordResetEmail(user.email, resetToken);
            res.json({ success: true, hasEmail: true });
            return;
        }

        // Pas d'email : verifier OBLIGATOIREMENT l'OTP Firebase server-side
        if (phoneIdToken) {
            if (!isFirebaseAdminConfigured()) {
                logger.error('[forgotPasswordPhone] Firebase Admin not configured');
                res.status(503).json({ error: 'Service de vérification téléphone indisponible.' });
                return;
            }
            const verifiedPhone = await verifyPhoneToken(phoneIdToken);
            if (!verifiedPhone || verifiedPhone !== phone) {
                logger.warn({ phone, verifiedPhone }, '[forgotPasswordPhone] Phone token mismatch');
                res.status(401).json({ error: 'Code de vérification invalide.' });
                return;
            }
            const resetToken = uuidv4();
            const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
            await db.storeAuthToken(user.id, 'PASSWORD_RESET', resetToken, expiresAt);
            res.json({ success: true, hasEmail: false, resetToken });
            return;
        }

        // Pas d'email, pas d'OTP → dire à l'utilisateur de contacter le support
        res.json({ success: true, hasEmail: false });
    } catch (error: any) {
        logger.error({ err: error }, 'ForgotPasswordPhone error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const checkPhone = async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            res.status(400).json({ error: 'Numéro de téléphone requis' });
            return;
        }
        const existingUser = await db.getUserByPhone(phone);
        res.json({ exists: !!existingUser });
    } catch (error: any) {
        logger.error({ err: error }, 'CheckPhone error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const sendEmailOtp = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email requis' });
            return;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const existingUser = await db.getUserByEmail(normalizedEmail);

        if (existingUser && existingUser.emailVerified) {
            res.status(409).json({ error: 'Cet email est déjà utilisé' });
            return;
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await db.storeAuthToken(normalizedEmail, 'EMAIL_OTP', code, expiresAt);
        const result = await sendOtpEmail(normalizedEmail, code);

        if (!result.success) {
            res.status(500).json({ error: "Erreur lors de l'envoi de l'email" });
            return;
        }

        res.json({ success: true, message: 'Code envoyé par email' });
    } catch (error: any) {
        logger.error({ err: error }, 'Email OTP error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const verifyEmailOtp = async (req: Request, res: Response) => {
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({ error: 'Email et code requis' });
            return;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const { valid } = await db.verifyAuthToken(normalizedEmail, 'EMAIL_OTP', code);

        if (!valid) {
            res.status(400).json({ error: 'Code incorrect ou expiré. Veuillez redemander un code.' });
            return;
        }

        await db.deleteAuthToken(normalizedEmail, 'EMAIL_OTP');

        const user = await db.getUserByEmail(normalizedEmail);
        if (user) {
            await db.updateUser(user.id, { emailVerified: true });
        }

        res.json({ success: true, verified: true });
    } catch (error: any) {
        logger.error({ err: error }, 'Verify email OTP error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            res.status(400).json({ error: 'Email requis' });
            return;
        }

        const normalizedEmail = email.toLowerCase().trim();
        const user = await db.getUserByEmail(normalizedEmail);

        if (!user) {
            res.json({ success: true, message: 'Un lien de réinitialisation a été envoyé si l\'adresse existe.' });
            return;
        }

        const resetToken = uuidv4();
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await db.storeAuthToken(user.id, 'PASSWORD_RESET', resetToken, expiresAt);
        const result = await sendPasswordResetEmail(normalizedEmail, resetToken);

        if (!result.success) {
            logger.error('Forgot password: email send failed');
        }

        res.json({ success: true, message: 'Un lien de réinitialisation a été envoyé.' });
    } catch (error: any) {
        logger.error({ err: error }, 'Forgot password error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const verifyPhoneReset = async (req: Request, res: Response) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            res.status(400).json({ error: 'Numéro de téléphone requis' });
            return;
        }

        const user = await db.getUserByPhone(phone);
        // Return the same response whether the user exists or not (prevents enumeration)
        if (!user) {
            res.json({ success: true, message: 'Si ce numéro est enregistré, vous recevrez un code.' });
            return;
        }

        const resetToken = uuidv4();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        await db.storeAuthToken(user.id, 'PASSWORD_RESET', resetToken, expiresAt);

        // Token must be delivered out-of-band (SMS), never returned directly in the response
        logger.info({ userId: user.id }, 'Phone reset token generated');
        res.json({ success: true, message: 'Si ce numéro est enregistré, vous recevrez un code.' });
    } catch (error: any) {
        logger.error({ err: error }, 'Verify phone reset error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
            return;
        }

        const { valid, identifier: userId } = await db.verifyAuthToken(token, 'PASSWORD_RESET');

        if (!valid || !userId) {
            res.status(400).json({ error: 'Lien invalide ou expiré.' });
            return;
        }

        const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
        if (!passwordRegex.test(password)) {
            res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères, une majuscule et un chiffre' });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        await db.updateUser(userId, { passwordHash });

        await db.deleteAuthToken(token, 'PASSWORD_RESET');

        res.json({ success: true, message: 'Mot de passe réinitialisé.' });
    } catch (error: any) {
        logger.error({ err: error }, 'Reset password error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};

export const verifyPhoneOtp = async (req: Request, res: Response) => {
    try {
        const { phone, phoneIdToken } = req.body;
        if (!phone || !phoneIdToken) {
            res.status(400).json({ error: 'Numéro de téléphone et token de vérification requis' });
            return;
        }

        const phoneRegex = /^\+225[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            res.status(400).json({ error: 'Format de téléphone invalide. Utilisez: +225XXXXXXXXXX' });
            return;
        }

        if (!isFirebaseAdminConfigured()) {
            logger.error('[verifyPhoneOtp] Firebase Admin not configured — cannot verify phone token');
            res.status(503).json({ error: 'Service de vérification téléphone indisponible.' });
            return;
        }

        const verifiedPhone = await verifyPhoneToken(phoneIdToken);
        if (!verifiedPhone || verifiedPhone !== phone) {
            logger.warn({ phone, verifiedPhone }, '[verifyPhoneOtp] Phone token mismatch or invalid');
            res.status(401).json({ error: 'Le code de vérification est invalide ou expiré.' });
            return;
        }

        const user = await db.getUserByPhone(phone);
        if (user) {
            await db.updateUser(user.id, { phoneVerified: true });
        } else {
            res.status(404).json({ error: 'Utilisateur introuvable.' });
            return;
        }

        res.json({ success: true, verified: true });
    } catch (error: any) {
        logger.error({ err: error }, 'Verify phone OTP error');
        res.status(500).json({ error: 'Erreur serveur' });
    }
};
