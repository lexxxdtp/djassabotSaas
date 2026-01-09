
import { db } from '../src/services/dbService';
import { generateAIResponse } from '../src/services/aiService';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

async function runTest() {
    console.log("🤖 Initialisation du Test de Négociation IA...\n");

    const tenantId = "test-tenant-id";

    // 1. CONFIGURATION (INPUTS)
    console.log("📝 1. Configuration des 'Inputs' (Règles & Personnalité)");
    const newSettings = {
        botName: "Moussa le Vendeur",
        persona: "humorous", // Nouchi mode
        negotiationFlexibility: 5, // Medium
        systemInstructions: "Tu es un vendeur au marché d'Adjamé. Tu parles fort, tu es drôle. Tu utilises l'argot ivoirien (Nouchi). Tu ne vends pas à perte.",
        storeName: "Tdjaasa Store",
    };

    // Update settings in the local DB
    await db.updateSettings(tenantId, newSettings);
    console.log("   ✅ Settings mis à jour :", newSettings.botName, "-", newSettings.persona);

    // Ensure we have a product to negotiate
    const products = await db.getProducts(tenantId);
    let bazin = products.find(p => p.name.toLowerCase().includes('bazin'));

    if (!bazin) {
        // Create if not exists
        bazin = await db.createProduct(tenantId, {
            name: "Grand Boubou Bazin",
            price: 20000,
            minPrice: 15000,
            stock: 5,
            description: "Super qualité",
            images: []
        });
    } else {
        // Update valid prices for the test
        await db.updateProduct(tenantId, bazin.id, { price: 20000, minPrice: 15000 });
    }

    console.log(`   ✅ Produit Test: ${bazin.name} / Prix Public: 20.000 / Min: 15.000\n`);


    // 2. SIMULATION (TEST)
    console.log("🗣️  2. Démarrage de la conversation simulée...");

    const scenarios = [
        {
            label: "Test 1: Demande de prix simple",
            input: "Bonsoir chef, c'est combien le Bazin ?"
        },
        {
            label: "Test 2: Négociation agressive (< Min Price)",
            input: "Ah c'est trop cher ! Je te donne 10.000 FCFA pour le Bazin, on conclut ?"
        },
        {
            label: "Test 3: Offre acceptable (>= Min Price)",
            input: "Ok pardon, je te donne 16.000 FCFA pour le Bazin alors. C'est bon ?"
        }
    ];

    // Mock History
    let history: any[] = [];

    for (const scenario of scenarios) {
        console.log(`\n🔹 ${scenario.label}`);
        console.log(`   👤 User: "${scenario.input}"`);

        // Prepare context dynamically like the real app does
        const currentProducts = await db.getProducts(tenantId);
        const inventoryContext = currentProducts.map(p =>
            `- ${p.name}: Public Price ${p.price} FCFA ${p.minPrice ? `(Min: ${p.minPrice})` : ''} | ${p.stock > 0 ? 'En stock' : 'Épuisé'}`
        ).join('\n');

        const settings = await db.getSettings(tenantId);

        const response = await generateAIResponse(scenario.input, {
            settings,
            inventoryContext,
            history
        });

        console.log(`   🤖 Bot: "${response}"`);

        // Update history for continuity
        history.push({ role: 'user', parts: [{ text: scenario.input }] });
        history.push({ role: 'model', parts: [{ text: response }] });

        // Small pause 
        await new Promise(r => setTimeout(r, 1500));
    }

    console.log("\n✅ Test terminé.");
}

runTest().catch(console.error);
