import admin from 'firebase-admin';
import fs from 'fs';
import { logger } from '../utils/logger';

/**
 * Firebase Admin SDK — used to verify Firebase ID tokens server-side.
 *
 * Used by /auth/signup and /auth/verify-phone-reset to verify that the client
 * actually completed a phone OTP challenge with Firebase. Without this check,
 * a malicious client could send `{ phoneVerified: true }` to bypass SMS
 * verification entirely.
 *
 * Configuration — TWO methods supported, checked in this order:
 *
 *   1. FIREBASE_SERVICE_ACCOUNT_PATH (recommended on VPS)
 *      Absolute path to the service account JSON file on disk.
 *      Example: /home/alex/djassabotSaas/backend/firebase-admin-key.json
 *      The file should be chmod 600, owned by the service user.
 *
 *   2. FIREBASE_SERVICE_ACCOUNT_JSON (recommended on Railway/Vercel/Heroku)
 *      Stringified JSON inline. Easier on PaaS, harder to read raw secret.
 *
 * Graceful degradation: if neither is set or both are malformed, the module
 * exports `isAdminConfigured = false` and `verifyPhoneToken` returns null.
 * Callers MUST handle this — typically by refusing phone-based signup.
 */

let _initialized = false;
let _isConfigured = false;

const loadCredentials = (): admin.ServiceAccount | null => {
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (path) {
        try {
            const raw = fs.readFileSync(path, 'utf-8');
            return JSON.parse(raw);
        } catch (error) {
            logger.error({ err: error, path }, '[FirebaseAdmin] Failed to read FIREBASE_SERVICE_ACCOUNT_PATH file');
            return null;
        }
    }

    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (inline) {
        try {
            return JSON.parse(inline);
        } catch (error) {
            logger.error({ err: error }, '[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON env var');
            return null;
        }
    }

    return null;
};

const initialize = () => {
    if (_initialized) return;
    _initialized = true;

    const serviceAccount = loadCredentials();
    if (!serviceAccount) {
        logger.warn('[FirebaseAdmin] No credentials provided (set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON) — phone token verification disabled');
        return;
    }

    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        _isConfigured = true;
        logger.info({ projectId: (serviceAccount as { project_id?: string }).project_id }, '[FirebaseAdmin] Initialized');
    } catch (error) {
        logger.error({ err: error }, '[FirebaseAdmin] Initialization failed');
    }
};

initialize();

export const isFirebaseAdminConfigured = (): boolean => _isConfigured;

/**
 * Verify a Firebase ID token and return the associated phone number if any.
 *
 * @param idToken - The Firebase ID token obtained on the client via
 *                  userCredential.user.getIdToken() after a successful
 *                  signInWithPhoneNumber + confirmationResult.confirm().
 * @returns The phone number (E.164 format) on the token, or null on failure.
 */
export const verifyPhoneToken = async (idToken: string): Promise<string | null> => {
    if (!_isConfigured) {
        logger.warn('[FirebaseAdmin] verifyPhoneToken called but admin not configured');
        return null;
    }
    try {
        const decoded = await admin.auth().verifyIdToken(idToken);
        return decoded.phone_number || null;
    } catch (error) {
        logger.warn({ err: error }, '[FirebaseAdmin] Token verification failed');
        return null;
    }
};
