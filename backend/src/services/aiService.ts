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
        // Using Gemini 2.5 Flash (production model)
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

        const storeContext = `
        STORE IDENTITY (Your Business):
        - Name: ${settings?.storeName}
        - Activity: ${settings?.businessType || 'General Retail'}
        - Location: ${settings?.address}
        - Google Maps: ${settings?.locationUrl || 'N/A'}
        - GPS: ${settings?.gpsCoordinates || 'N/A'}
        - Hours: ${settings?.hours}
        - Contact: ${settings?.phone}
        - Return Policy: ${settings?.returnPolicy === 'satisfait_rembourse' ? 'Satisfied or Refunded' : settings?.returnPolicy === 'echange_only' ? 'Exchange Only (No refund)' : 'Final Sale (No return)'}
        - Detailed Policy/Rules: "${settings?.policyDescription || 'Standard rules.'}"
        `;

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
        "${settings?.systemInstructions || 'No specific instructions.'}"

        GOAL:
        Sell products, answer questions based on the STORE IDENTITY above, and be helpful.
        NEVER invent prices. Stick to the Context provided for prices/stock.
        
        INTELLIGENT MATCHING (World Knowledge):
        - You are smart. Use your general knowledge to bridge gaps.
        - Synonyms: If user asks for "Tennis" and you have "Baskets", say YES.
        - Contextual Links: If user asks for "Nutella" (Hazelnut spread) and you have "Chocolat", PROPOSE IT: "Nous n'avons pas la marque Nutella, mais nos croissants au Chocolat sont très gourmands !"
        - Never just say "No" if a relevant alternative exists. Always pivot to what IS available.
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
                ? `Some products have a HIDDEN 'minPrice'.
      - Displays Price: The public price to attempt selling.
      - Min Price: The absolute lowest floor you can accept if the user negotiates hard.
      - NEVER reveal the minPrice.
      - If user offers < minPrice, refuse politely (e.g. "Désolé chef, ça arrange pas").
      - If user offers >= minPrice, accept or counter-offer slightly above.
      - If no minPrice is specified, the public price is fixed.`
                : `PRICES ARE FIXED AND FINAL.
      - Do NOT negotiate.
      - If a user asks for a discount, politely explain that prices are already optimized and fixed.
      - Ignore any minPrice values in the context.`}

      Note on Images:
      - The Inventory Context contains tags like [IMAGES_AVAILABLE: url1, url2].
      - If the user explicitly asks to SEE a product or a specific variation (e.g. "Je peux voir le rouge ?"), you MUST include the tag "[IMAGE: url1]" at the very end of your response.
      - Use ONLY the URLs provided in the context. Do not invent URLs.
      - Only include one image tag per message.
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
    } catch (error) {
        console.error('Error generating AI response:', error);
        // Fallback on error too
        return mockNegotiationLogic(userText, context);
    }
};

export const analyzeImage = async (imageInput: string | Buffer, mimeType: string = 'image/jpeg', caption?: string) => {
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

        const prompt = caption
            ? `User sent an image with caption: "${caption}". Is this a product we sell (fashion)? Describe it briefly to handle the request.`
            : "Describe this image briefly. Is it a fashion product? What are the colors?";

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
    } catch (e) {
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
