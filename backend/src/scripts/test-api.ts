
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

// Charger le .env depuis la racine du backend
dotenv.config({ path: path.join(__dirname, '../../.env') });

const runTest = async () => {
    console.log("🔍 TEST DIAGNOSTIC API GEMINI");
    console.log("=============================");

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error("❌ ERREUR: Aucune clé GEMINI_API_KEY trouvée dans le fichier .env");
        console.log("   Vérifiez que vous avez bien créé le fichier backend/.env");
        return;
    }

    console.log(`🔑 Clé API détectée: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        console.log("📡 Tentative de connexion à Google Gemini...");
        const result = await model.generateContent("Réponds juste par le mot 'SUCCÈS' si tu me reçois.");
        const response = await result.response;
        const text = response.text();

        console.log(`✅ RÉPONSE REÇUE: "${text.trim()}"`);
        console.log("=============================");
        console.log("🎉 VOTRE CLÉ API FONCTIONNE PARFAITEMENT !");
        console.log("Si l'application ne marche pas, redémarrez le serveur backend.");

    } catch (error: any) {
        console.error("\n❌ ÉCHEC DU TEST API");
        console.error("====================");
        console.error("Message d'erreur complet :");
        console.error(error);

        if (error.message?.includes('API not enabled') || error.message?.includes('403')) {
            console.log("\n💡 SOLUTION PROBABLE :");
            console.log("   L'API 'Generative Language API' n'est pas activée sur votre projet Google Cloud.");
            console.log("   Allez ici: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com");
            console.log("   Et cliquez sur 'ACTIVER'.");
        }
    }
};

runTest();
