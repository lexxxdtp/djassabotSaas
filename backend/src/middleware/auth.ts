import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// Lazy getter to ensure dotenv.config() has been called before reading JWT_SECRET
let _jwtSecret: string | undefined;
const getJwtSecret = (): string => {
    if (!_jwtSecret) {
        _jwtSecret = process.env.JWT_SECRET;
        if (!_jwtSecret) {
            throw new Error('JWT_SECRET environment variable is required');
        }
    }
    return _jwtSecret;
};

// Extend Express Request to include tenant info
declare global {
    namespace Express {
        interface Request {
            tenantId?: string;
            userId?: string;
        }
    }
}

interface JWTPayload {
    tenantId: string;
    userId: string;
    email: string;
}

/**
 * Middleware d'authentification
 * Vérifie le JWT et injecte tenantId et userId dans req
 */
export const authenticateTenant = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        // Extraire le token du header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({ error: 'Token manquant. Veuillez vous connecter.' });
            return;
        }

        const token = authHeader.split(' ')[1]; // Format: "Bearer <token>"

        if (!token) {
            res.status(401).json({ error: 'Format de token invalide.' });
            return;
        }

        // Vérifier et décoder le JWT
        const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;

        req.tenantId = decoded.tenantId;
        req.userId = decoded.userId;

        logger.debug({ tenantId: decoded.tenantId }, 'Tenant authenticated');

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ error: 'Token expiré. Veuillez vous reconnecter.' });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ error: 'Token invalide.' });
            return;
        }

        res.status(500).json({ error: 'Erreur d\'authentification.' });
    }
};

/**
 * Générer un JWT pour un utilisateur
 */
export const generateToken = (payload: JWTPayload): string => {
    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: '7d'
    });
};

/**
 * Middleware optionnel (pour les routes publiques avec auth optionnelle)
 */
export const optionalAuth = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            next();
            return;
        }

        const token = authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, getJwtSecret()) as JWTPayload;
            req.tenantId = decoded.tenantId;
            req.userId = decoded.userId;
        }
    } catch (error) {
        // On ignore les erreurs pour les routes optionnelles
    }

    next();
};
