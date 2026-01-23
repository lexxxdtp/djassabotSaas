import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import dotenv from 'dotenv';
import axios from 'axios';
import { Settings } from '../types';

dotenv.config();

// Lazy initialization to ensure env is loaded before API key is read
let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

const getModel = (): GenerativeModel | null => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey.length < 20) {
        console.warn('[AI] No valid GEMINI_API_KEY found in environment');
        return null;
    }

    if (!model) {
        console.log('[AI] Initializing Gemini with key:', apiKey.substring(0, 10) + '...');
        genAI = new GoogleGenerativeAI(apiKey);
        // Using Gemini 2.5 Flash (available for this account)
        model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    }

    return model;
};

// Interface for Discount Rules
export interface DiscountRule {
    description: string; // e.g. "Buy 2 get 10% off"
    condition: string;   // e.g. "quantity >= 2"
    action: string;      // e.g. "apply 10% discount"
}

// Default rules (Fallback)
const DEFAULT_RULES: DiscountRule[] = [
    { description: "Réduction de bienvnue", condition: "First time customer", action: "Give 5% off max" }
];

const BASE_SYSTEM_INSTRUCTION = `
You are a smart, helpful, and "Ivorian-style" sales assistant for a WhatsApp commerce bot in Ivory Coast (Abidjan).
Your goal is to CLOSE SALES while following specific merchant rules.

TONE & STYLE:
- Professional but warm. Use "Vous" primarily, but can match user's energy.
- Use local Ivorian French slang occasionally but stay professional (e.g., "Bonjour chef", "On gère ça", "T'inquiète").
- Be concise. WhatsApp messages should be short.
- If the user sends an image, analyze it and see if it matches our inventory (simulated).
- If the user asks for a discount, you can negotiate slightly (max 10% off).
- Avoid long paragraphs. Use emojis 🛍️📦✨.

NEGOTIATION ENGINE:
- You are authorized to negotiate strictly based on the provided RULES.
- If a user asks for a discount that is NOT in the rules, politely decline/explain.
- Example: If rule says "Buy 2 for 10% off", and user buys 1, say "Si vous en prenez un 2ème, je vous fais 10% de réduction !".
- NEVER go below the authorized limit.

PAYMENT:
- Payment is done via Wave Link (generated automatically later).
`;

const mockNegotiationLogic = (userText: string, context: any) => {
    const text = userText.toLowerCase();

    // Extract numbers from user text (potential offers)
    const offerMatch = text.match(/(\d+)\s*(?:k|mille|000)/) || text.match(/(\d+)/);
    const offer = offerMatch ? parseInt(offerMatch[1].replace(/\./g, '')) : 0;
    const effectiveOffer = offer < 1000 ? offer * 1000 : offer; // Handle "10k" or "10"

    // Parse Min Prices from Context
    // Context string looks like: "- Bazin: Public Price 15000 FCFA (Min: 13000)"
    const lines = (context.inventoryContext || "").split('\n');
    let productFound = null;

    // Simple heuristic: match product name in user text with inventory
    for (const line of lines) {
        if (line.includes("Min:")) {
            const nameMatch = line.match(/- (.*?):/);
            const name = nameMatch ? nameMatch[1].toLowerCase() : "";
            if (name && text.includes(name) || text.includes('bazin')) { // Hardcoded 'bazin' fallback for test
                const minMatch = line.match(/Min:\s*(\d+)/);
                const publicMatch = line.match(/Public Price\s*(\d+)/);
                if (minMatch) {
                    productFound = {
                        name,
                        min: parseInt(minMatch[1]),
                        public: publicMatch ? parseInt(publicMatch[1]) : 0
                    };
                    break;
                }
            }
        }
    }

    if (text.includes("combien")) {
        return "C'est un produit de qualité ! Le prix est affiché. (Mock: Price Inquiry)";
    }

    const greetings = ['bonjour', 'salut', 'hello', 'coucou', 'yo'];
    if (greetings.some(g => text.includes(g))) {
        return "[SIMULATED AI] Bonjour ! 👋 Je suis l'assistant virtuel (Mode Test). Comment puis-je vous aider ? (Ajoutez une clé API pour que je sois plus intelligent !)";
    }

    if (productFound && effectiveOffer > 0) {
        if (effectiveOffer < productFound.min) {
            return `[SIMULATED AI] Désolé chef, ${effectiveOffer} c'est trop peu. Le patron va me tuer. (Refus < ${productFound.min})`;
        } else {
            return `[SIMULATED AI] Allez, ça marche pour ${effectiveOffer} FCFA ! On fait affaire. (Accept >= ${productFound.min})`;
        }
    }

    return "[SIMULATED AI] Je suis en mode test (pas de clé API). Je réponds basiquement aux 'Bonjour', 'Combien', et aux offres chiffrées sur les produits du contexte.";
};

export const generateAIResponse = async (userText: string, context: { rules?: DiscountRule[], inventoryContext?: string, history?: any[], settings?: Settings } = {}) => {
    // Get model with lazy initialization
    const currentModel = getModel();

    if (!currentModel) {
        console.warn('[AI] No Valid API Key found. Using Mock Logic.');
        return mockNegotiationLogic(userText, context);
    }

    try {
        const rules = context.rules || DEFAULT_RULES;
        const rulesText = rules.map(r => `- Condition: ${r.condition} -> Offre: ${r.action} (${r.description})`).join('\n');
        const settings = context.settings;

        // Custom System Instruction builder
        const botName = settings?.botName || 'Awa';
        const persona = settings?.persona || 'friendly';
        const politeness = settings?.politeness || 'informal'; // Default to Tu
        const emojiLevel = settings?.emojiLevel || 'medium';
        const length = settings?.responseLength || 'medium';

        const politenessInstruction = politeness === 'auto'
            ? "ADAPTIVE: Analyze the user's input. If they use 'tu', use 'tu'. If they use 'vous', use 'vous'. If unsure, default to 'vous' initially."
            : politeness === 'formal' ? "Use VOUS (Vouvoiement) strictly." : "Use TU (Tutoiement) naturally like a friend.";

        const emojiInstruction = emojiLevel === 'auto'
            ? "ADAPTIVE: Mirror the user's emoji usage. If they use emojis, match their frequency. If none, use very few."
            : emojiLevel === 'high' ? "Use MANY emojis (🛍️🔥✨) in every sentence." : emojiLevel === 'none' ? "Use NO emojis." : "Use emojis moderately.";

        const lengthInstruction = length === 'auto'
            ? "ADAPTIVE: Match the user's verbosity. If they write short messages, be concise. If they ask detailed questions, provide detailed answers."
            : length === 'short' ? "Be very concise and direct." : length === 'long' ? "Be descriptive and chatty." : "Keep it balanced (2-3 sentences max).";

        const personaInstruction = persona === 'auto'
            ? "ADAPTIVE CHAMELEON: Analyze the user's tone. If they are formal, be 'Professional & Courteous'. If they are casual, warm, or use slang (Nouchi), switch to 'Authentic & Local' mode. Always close the sale."
            : `Your persona is fixed to: ${persona}.`;

        // Build accepted payments list (with safety check for non-array values)
        const paymentsArray = Array.isArray(settings?.acceptedPayments) ? settings.acceptedPayments : [];
        const paymentMethods = paymentsArray.length > 0
            ? paymentsArray.map((p: string) => {
                switch (p) {
                    case 'wave': return 'Wave';
                    case 'om': return 'Orange Money';
                    case 'mtn': return 'MTN Money';
                    case 'cash': return 'Espèces';
                    case 'bank_transfer': return 'Virement bancaire';
                    default: return p;
                }
            }).join(', ')
            : 'Espèces';

        const storeContext = `
        STORE IDENTITY (Your Business):
        - Name: ${settings?.storeName}
        - Activity: ${settings?.businessType || 'General Retail'}
        - Location: ${settings?.address}
        - Google Maps: ${settings?.locationUrl || 'N/A'}
        - GPS: ${settings?.gpsCoordinates || 'N/A'}
        - Hours: ${settings?.hours}
        - Contact: ${settings?.phone}
        - Social Media: ${settings?.socialMedia ? Object.entries(settings.socialMedia).filter(([_, v]) => v).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A' : 'N/A'}
        - Return Policy: ${settings?.returnPolicy === 'satisfait_rembourse' ? 'Satisfied or Refunded' : settings?.returnPolicy === 'echange_only' ? 'Exchange Only (No refund)' : 'Final Sale (No return)'}
        - Detailed Policy/Rules: "${settings?.policyDescription || 'Standard rules.'}"
        
        DELIVERY INFO:
        - Abidjan: ${settings?.deliveryAbidjanPrice || 1500} FCFA
        - Hors Abidjan (Intérieur): ${settings?.deliveryInteriorPrice || 3000} FCFA
        - Livraison GRATUITE à partir de: ${settings?.freeDeliveryThreshold || 50000} FCFA
        
        ACCEPTED PAYMENTS: ${paymentMethods}
        `;

        // Sanitize user instructions to prevent prompt injection
        const rawInstructions = settings?.systemInstructions || 'No specific instructions.';
        const sanitizedInstructions = rawInstructions.replace(/[{}]/g, '').substring(0, 1000); // Remove braces and limit length

        let systemInstruction = `
        You are ${botName}, a smart sales assistant for ${settings?.storeName} in Abidjan.
        
        ${storeContext}
        
        PERSONALITY OVERRIDE:
        ${personaInstruction}
        
        COMMUNICATION STYLE:
        - Politeness: ${politenessInstruction}
        - Emojis: ${emojiInstruction}
        - Length: ${lengthInstruction}
        - Language: Use French. Adapt strictly to the user's language level (Formal vs Nouchi/Slang).

        SPECIFIC INSTRUCTIONS FROM SELLER:
        "${sanitizedInstructions}"

        GOAL:
        Sell products while STRICTLY respecting inventory limits.

        CRITICAL INVENTORY RULES (MUST FOLLOW):
        1. CHECK STOCK FIRST: The context defines available stock as "[Stock: X]".
        2. IF Stock is "Illimité" or "Flexible" -> YOU CAN SELL ANY QUANTITY.
        3. IF Stock is a Number (e.g., 5) AND DEMAND > STOCK:
           - You MUST REFUSE the order for the excess quantity.
           - Explain clearly: "Désolé, il ne me reste que X unités en stock (pour cette variante)."
           - Propose the available quantity instead.
        3. VARIATIONS: Pay attention to specific variation stock (e.g. if "Chocolat" has 10 and "Vanille" has 12, do NOT sell 20 Chocolat).
        4. NEVER invent prices or stock. Stick rigorously to the provided context.
        
        INTELLIGENT MATCHING (World Knowledge):
        - You are smart. Use your general knowledge to bridge gaps.
        - Synonyms: If user asks for "Tennis" and you have "Baskets", say YES.
        - Alternatives: If a requested product is missing, propose a RELEVANT alternative available in stock.
        
        STRICT FACTUALITY RULES (NO HALLUCINATIONS):
        - Do NOT assume context that does not exist. (e.g. Do NOT say "Avec votre café ?" if the user never ordered coffee).
        - Stick strictly to the discussion. Do not invent products or services not in the context.
        - Do not be superfluous. Be direct and helpful.
        - CROSS-SELLING: You may suggest complementary items ONLY if they make logical sense with what the user is CURRENTLY discussing or buying.
        `;

        // Add Few-Shot Training Examples if they exist
        let fewShotHistory: any[] = [];
        if (settings?.trainingExamples) {
            settings.trainingExamples.forEach((ex: any) => {
                if (ex.question && ex.answer) {
                    fewShotHistory.push({ role: 'user', parts: [{ text: ex.question }] });
                    fewShotHistory.push({ role: 'model', parts: [{ text: ex.answer }] });
                }
            });
        }

        const dynamicSystemPrompt = `
      ${systemInstruction}

      CURRENT ACTIVE PROMO RULES (Apply these logic strictly):
      ${rulesText}

      INVENTORY CONTEXT (What we have - INTERNAL ONLY):
      ${context.inventoryContext || "General store inquiry."}
      
      Note on Prices:
      ${settings?.negotiationEnabled
                ? `NEGOTIATION ENABLED (Flexibility: ${(settings?.negotiationFlexibility || 5) * 10}%)
      - Some products have a HIDDEN 'minPrice'.
      - Displayed Price: The public price to attempt selling FIRST.
      - Min Price: The absolute lowest floor you can accept.
      - Your flexibility level is ${(settings?.negotiationFlexibility || 5) * 10}%. At 0%, barely negotiate. At 100%, go to minPrice easily.
      - NEVER reveal the minPrice to the customer.
      - If user offers < minPrice, refuse politely (e.g. "Désolé chef, ça arrange pas").
      - If user offers >= minPrice, accept or counter-offer slightly above.
      - If no minPrice is specified, the public price is fixed for that product.`
                : `PRICES ARE FIXED AND FINAL.
      - Do NOT negotiate under any circumstances.
      - If a user asks for a discount, politely explain that prices are already optimized and fixed.
      - Ignore any minPrice values in the context.`}

      Note on Images:
      - The Inventory Context contains tags like [IMAGES_AVAILABLE: url1, url2] for each product.
      - When the user asks to SEE a SPECIFIC product (e.g. "Je peux voir les croissants?", "Montre-moi le Bazin"), you MUST:
        1. Find the SPECIFIC product they asked about in the inventory
        2. Include ONLY that product's image using the tag "[IMAGE: productUrl]" at the very end of your response
        3. NEVER show images of products they didn't ask about
      - If they ask to see the whole catalog or "all products", you may include up to 4 images from different products.
      - Use ONLY the URLs provided in the [IMAGES_AVAILABLE] tags. Do not invent URLs.
      - Only include 1-2 image tags per message maximum.
      - Example: If user says "Je veux voir vos croissants" and Croissant has [IMAGES_AVAILABLE: https://img1.jpg], respond with text about the croissant + [IMAGE: https://img1.jpg]

      🎯 CRITICAL: Product-Specific Instructions (CONSIGNES SPÉCIALES):
      - Some products have special instructions marked with "📋 CONSIGNES SPÉCIALES" in the inventory context.
      - YOU MUST FOLLOW THESE INSTRUCTIONS STRICTLY - they are rules set by the store owner.
      - Examples of what these instructions might say:
        * "Si le client prend 3 brownies, propose 5 avec 10% de réduction" → ALWAYS propose the upsell BEFORE confirming the order!
        * "À partir de 10 articles, offrir la livraison gratuite" → Apply this rule automatically.
        * "Suggérer l'accessoire X pour chaque achat" → Mention the accessory.
      - NEVER skip these consignes. They are MANDATORY business rules.
      - When a user wants to buy a quantity, CHECK if there's a consigne that applies, and PROPOSE IT FIRST before adding to cart.
    `;

        const chat = currentModel.startChat({
            history: [
                {
                    role: 'user',
                    parts: [{ text: "System Instruction: " + dynamicSystemPrompt }],
                },
                {
                    role: 'model',
                    parts: [{ text: "C'est compris chef. Je suis prêt à vendre avec ce style spécifique !" }],
                },
                ...fewShotHistory, // Inject training examples here
                ...(context.history || [])
            ],
        });

        const result = await chat.sendMessage(userText);
        const response = await result.response;
        return response.text();
    } catch (error: any) {
        console.error('Error generating AI response:', error);

        // Handle Quota/Rate Limits (429)
        if (error.message?.includes('429') || error.status === 429 || error.message?.includes('quota')) {
            return "⏳ (Quota IA) Je reçois trop de demandes ! Attendez quelques secondes svp.";
        }

        // Handle Safety Blocks
        if (error.message?.includes('safety') || error.message?.includes('blocked')) {
            return "⚠️ (Sécurité) Ma réponse a été bloquée par le filtre de sécurité.";
        }

        // Other Errors
        return `⚠️ Erreur IA: ${error.message?.substring(0, 100)}...`;
    }
};

export const analyzeImage = async (imageInput: string | Buffer, mimeType: string = 'image/jpeg', caption?: string, inventoryContext: string = '') => {
    // Get model with lazy initialization
    const currentModel = getModel();

    if (!currentModel) {
        console.warn('[AI] No Valid API Key found. Using Mock Image Analysis.');
        if (caption && caption.toLowerCase().includes('robe')) return "C'est une belle robe rouge. (Mock Analysis)";
        return "Je vois un produit de mode intéressant. (Mock Analysis)";
    }

    try {
        let imageData: string;
        if (Buffer.isBuffer(imageInput)) {
            imageData = imageInput.toString('base64');
        } else {
            // Fetch from URL
            const imageResp = await axios.get(imageInput, { responseType: 'arraybuffer' });
            imageData = Buffer.from(imageResp.data).toString('base64');
        }

        const prompt = `
        CONTEXT: The user sent an image to a store bot via WhatsApp.
        USER CAPTION: "${caption || 'No caption'}"
        
        STORE INVENTORY (What we have in stock):
        ${inventoryContext || "No specific inventory data provided."}

        TASK:
        1. Analyze the image visually (what product is it? color? type?).
        2. COMPARE it with the STORE INVENTORY above.
        3. Is this product (or something very similar) in our stock?
           - IF YES: Confirm we have it, mention the name and price from inventory.
           - IF NO: Say we don't have this specific model, but describe what we have that is closest.
           - IF IT'S A PAYMENT RECEIPT (Wave/OM/Money): Extract the amount and Transaction ID.
        
        Keep the response natural, helpful, and concise (WhatsApp style).
        `;

        const result = await currentModel.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageData,
                    mimeType: mimeType,
                },
            },
        ]);
        return result.response.text();
    } catch (error) {
        console.error('Error analyzing image:', error);
        return "J'ai bien reçu l'image mais je n'arrive pas à l'analyser pour l'instant.";
    }
};

export const transcribeAudio = async (audioBuffer: Buffer, mimeType: string = "audio/ogg"): Promise<string> => {
    const currentModel = getModel();
    if (!currentModel) {
        console.warn('[AI] No Valid API Key found. Cannot transcribe audio.');
        return "";
    }

    try {
        const audioData = audioBuffer.toString('base64');

        const prompt = "Transcris cet audio exactement tel qu'il est parlé, en français. Si c'est du nouchi (argot ivoirien), transcris-le tel quel. Ne réponds pas à la question, fais juste la transcription textuelle.";

        const result = await currentModel.generateContent([
            prompt,
            {
                inlineData: {
                    data: audioData,
                    mimeType: mimeType,
                },
            },
        ]);
        return result.response.text();
    } catch (error) {
        console.error('Error transcribing audio:', error);
        return ""; // Return empty string if failed, so we can ignore it or handle gracefully
    }
};

export const detectPurchaseIntent = async (userText: string, productContext: string) => {
    const currentModel = getModel();
    if (!currentModel) {
        return { intent: "CHAT" };
    }

    // Simple intent detection (can be upgraded to full Function Calling)
    const prompt = `
    Analyze this user message: "${userText}"
    Context of available products: "${productContext}"
    
    Determine if the user explicitly wants to BUY/ADD TO CART right now.
    
    STRICT RULES:
    - If the user says "I take X", "Add X", "I want to buy X", "Send me X", order is CONFIRMED -> Return intent "BUY".
    - If the user asks a question ("How much is X?", "Do you have X?", "And the croissants?"), default to "CHAT".
    - If the user mentions a product without a clear action verb ("The croissants"), default to "CHAT".
    - If ambiguity exists, default to "CHAT".
    
    If BUY, return strictly JSON:
    { "intent": "BUY", "productName": "extracted_product_name", "quantity": number }
    
    If CHAT, return:
    { "intent": "CHAT" }
    
    Do not add markdown formatting. Just the raw JSON string.
    `;

    try {
        const result = await currentModel.generateContent(prompt);
        const rawText = result.response.text();
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : rawText.trim().replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(jsonString);
    } catch (e: any) {
        console.error("Intent Detection Failed:", e.message);
        return { intent: "CHAT" };
    }
}

export const generateIdentitySummary = async (settings: Settings) => {
    const currentModel = getModel();
    if (!currentModel) return "Impossible de générer le résumé (Pas de clé API configurée).";

    const prompt = `
    Agis comme le bot défini par ces paramètres. Fais une courte présentation (introspective) de qui tu es, ta mission, ton ton, et tes règles principales.
    
    CONFIG:
    Nom: ${settings.botName}
    Boutique: ${settings.storeName} (${settings.businessType})
    Vendeur: ${settings.persona} (Politesse: ${settings.politeness}, Emojis: ${settings.emojiLevel})
    Politique: ${settings.policyDescription || 'Standard'}
    Instructions: ${settings.systemInstructions}
    
    Réponds à la première personne (Je).
    `;

    try {
        const result = await currentModel.generateContent(prompt);
        return result.response.text();
    } catch (e) {
        console.error("Error generating summary:", e);
        return "Erreur génération résumé.";
    }
};
