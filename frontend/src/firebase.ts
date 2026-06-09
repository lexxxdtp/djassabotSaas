// Firebase Auth — used only for phone-based SMS OTP verification (signup/forgot password).
// Initialization is lazy and safe: if Firebase env vars are missing, `auth` is null and
// phone OTP features are simply disabled. Email-based signup/login works without Firebase.
import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth, type RecaptchaVerifier } from "firebase/auth";

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
        grecaptcha: { reset: (widgetId?: number) => void };
    }
}

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured =
    !!firebaseConfig.apiKey && firebaseConfig.apiKey.length > 10;

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

if (isFirebaseConfigured) {
    try {
        _app = initializeApp(firebaseConfig);
        _auth = getAuth(_app);
    } catch (error) {
        console.error("[Firebase] Initialization failed:", error);
        _auth = null;
    }
} else {
    console.warn("[Firebase] Not configured — phone OTP features disabled");
}

/**
 * Firebase Auth instance. Will be `null` if Firebase env vars are missing.
 * Callers MUST check before use: `if (auth) { ... }`
 */
export const auth = _auth;
