// Firebase Auth — used only for phone-based SMS OTP verification (signup/forgot password).
// Initialization is lazy so the app does NOT crash at startup when Firebase env vars are missing.
// Email-based signup/login works without Firebase.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

export const isFirebaseConfigured = (): boolean => {
    return !!firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10;
};

/**
 * Lazy Firebase Auth getter. Returns null if Firebase isn't configured —
 * caller MUST check before using (e.g. for phone OTP features).
 */
export const getFirebaseAuth = (): Auth | null => {
    if (!isFirebaseConfigured()) {
        console.warn('[Firebase] Not configured — phone OTP features disabled');
        return null;
    }
    if (!_auth) {
        try {
            _app = initializeApp(firebaseConfig);
            _auth = getAuth(_app);
        } catch (error) {
            console.error('[Firebase] Initialization failed:', error);
            return null;
        }
    }
    return _auth;
};

/**
 * Proxy that initializes Firebase Auth lazily on first property access.
 * Backwards-compatible with `import { auth } from '../firebase'`.
 * Throws a friendly error if Firebase is not configured when actually used.
 */
export const auth = new Proxy({} as Auth, {
    get(_target, prop) {
        const realAuth = getFirebaseAuth();
        if (!realAuth) {
            throw new Error(
                "Firebase n'est pas configuré. La vérification par SMS est indisponible — utilisez l'inscription par email."
            );
        }
        return (realAuth as any)[prop];
    }
});
