// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBKV_B-fk5qXpUScymrbh2Am1xKsaRh018",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0191931206.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0191931206",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0191931206.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "699530305094",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:699530305094:web:54b857307688df7f2ff447",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-89BCD0B9XY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
