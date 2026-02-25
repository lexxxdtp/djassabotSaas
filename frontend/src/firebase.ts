// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBKV_B-fk5qXpUScymrbh2Am1xKsaRh018",
    authDomain: "gen-lang-client-0191931206.firebaseapp.com",
    projectId: "gen-lang-client-0191931206",
    storageBucket: "gen-lang-client-0191931206.firebasestorage.app",
    messagingSenderId: "699530305094",
    appId: "1:699530305094:web:54b857307688df7f2ff447",
    measurementId: "G-89BCD0B9XY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
