import admin from 'firebase-admin';
import { logger } from '../utils/logger';

/**
 * Firebase Admin SDK — used to verify Firebase ID tokens server-side.
 *
 * Used by /auth/signup and /auth/verify-phone-reset to verify that the client
 * actually completed a phone OTP challenge with Firebase. Without this check,
 * a malicious client could send `{ phoneVerified: true }` to bypass SMS
 * verification entirely.
 *
 * Configuration via env var FIREBASE_SERVICE_ACCOUNT_JSON containing the
 * stringified JSON of a Firebase service account key (see Firebase Console
 * → Project Settings → Service accounts → Generate new private key).
 *
 * Graceful degradation: if the env var is missing or malformed, the module
 * exports `isAdminConfigured = false` and `verifyPhoneToken` returns null.
 * Callers MUST handle this — typically by refusing phone-based signup.
 */

let _initialized = false;
let _isConfigured = false;

const initialize = () => {
    if (_initialized) return;
    _initialized = true;

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
        logger.warn('[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON not set — phone token verification disabled');
        return;
    }

    try {
        const serviceAccount = JSON.parse(raw);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
        _isConfigured = true;
        logger.info({ projectId: serviceAccount.project_id }, '[FirebaseAdmin] Initialized');
    } catch (error) {
        logger.error({ err: error }, '[FirebaseAdmin] Initialization failed — check FIREBASE_SERVICE_ACCOUNT_JSON format');
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
