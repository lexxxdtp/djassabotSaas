
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Charger le .env depuis la racine du backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const runTest = async () => {
    console.log("🔍 LISTING DES MODÈLES DISPONIBLES");
    console.log("==================================");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ ERREUR: Aucune clé GEMINI_API_KEY trouvée");
        return;
    }

    try {
        // Test simple avec une requête REST directe pour lister les modèles
        // car le SDK masque parfois les détails
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.models) {
            console.log("✅ Modèles accessibles pour votre clé :");
            data.models.forEach((m: any) => {
                if (m.supportedGenerationMethods?.includes('generateContent')) {
                    console.log(`   - ${m.name.replace('models/', '')} (${m.displayName})`);
                }
            });
        } else {
            console.log("❌ Impossible de lister les modèles via l'API REST.");
            console.log("Réponse:", JSON.stringify(data, null, 2));
        }

    } catch (error: any) {
        console.error("❌ Erreur lors du listing :", error);
    }
};

runTest();
