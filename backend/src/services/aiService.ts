import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

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

// Update context interface
import { Settings } from './dbService';

export const generateAIResponse = async (userText: string, context: { rules?: DiscountRule[], inventoryContext?: string, history?: any[], settings?: Settings } = {}) => {
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

        let systemInstruction = `
        You are ${botName}, a sales assistant in Abidjan, Ivory Coast. 
        Your persona is: ${persona}.
        
        COMMUNICATION STYLE:
        - Politeness: ${politeness === 'formal' ? 'Use VOUS (Vouvoiement) strictly.' : 'Use TU (Tutoiement) naturally like a friend.'}
        - Emojis: ${emojiLevel === 'high' ? 'Use MANY emojis (🛍️🔥✨) in every sentence.' : emojiLevel === 'none' ? 'Use NO emojis.' : 'Use emojis moderately.'}
        - Length: ${length === 'short' ? 'Be very concise and direct.' : length === 'long' ? 'Be descriptive and chatty.' : 'Keep it balanced (2-3 sentences max).'}
        - Language: Use French mixed with occasional Ivorian slang (nouchi) if the persona matches 'humorous' or 'friendly'.

        SPECIFIC INSTRUCTIONS FROM SELLER:
        "${settings?.systemInstructions || 'No specific instructions.'}"

        GOAL:
        Sell products, answer questions, and be helpful.
        NEVER inventive prices. Stick to the Context provided.
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

        // Construct dynamic system prompt
        const dynamicSystemPrompt = `
      ${systemInstruction}

      CURRENT ACTIVE PROMO RULES (Apply these logic strictly):
      ${rulesText}

      INVENTORY CONTEXT (What we have):
      ${context.inventoryContext || "General store inquiry."}
    `;

        const chat = model.startChat({
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
        return "J'ai un petit souci de connexion. Je reviens vers vous tout de suite !";
    }
};

export const analyzeImage = async (imageUrl: string, caption?: string) => {
    try {
        // Fetch image as buffer
        const imageResp = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageData = Buffer.from(imageResp.data).toString('base64');

        const prompt = caption ? `User sent this image with caption: "${caption}". Is this a product we sell? (Assume we sell clothes, shoes, wigs). Describe it briefly.` : "Describe this product. Is it fashion related?";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: imageData,
                    mimeType: "image/jpeg",
                },
            },
        ]);
        return result.response.text();
    } catch (error) {
        console.error('Error analyzing image:', error);
        return "Je n'arrive pas à bien voir l'image. Peux-tu renvoyer ?";
    }
};

export const analyzeAudio = async (audioUrl: string) => {
    try {
        // Fetch audio as buffer
        const audioResp = await axios.get(audioUrl, { responseType: 'arraybuffer' });
        const audioData = Buffer.from(audioResp.data).toString('base64');

        const prompt = "Please transcribe this audio and answer it as a sales assistant. The audio is likely in French (maybe with Ivorian slang). If they are asking for a product, say we check our stock.";

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: audioData,
                    mimeType: "audio/ogg", // WhatsApp usually uses ogg/opus 
                },
            },
        ]);
        return result.response.text();
    } catch (error) {
        console.error('Error analyzing audio:', error);
        return "J'ai du mal à écouter la note vocale. Peux-tu l'écrire ou réessayer ?";
    }
};

export const detectPurchaseIntent = async (userText: string, productContext: string) => {
    // Simple intent detection (can be upgraded to full Function Calling)
    const prompt = `
    Analyze this user message: "${userText}"
    Context of available products: "${productContext}"
    
    Does the user definitively want to buy or add a product to cart?
    
    If YES, return strictly JSON in this format:
    { "intent": "BUY", "productName": "extracted_product_name", "quantity": number }
    
    If NO (just asking questions, saying hello, or negotiating), return:
    { "intent": "CHAT" }
    
    Do not add markdown formatting like \`\`\`json. Just the raw JSON string.
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');
        return JSON.parse(text);
    } catch (e) {
        return { intent: "CHAT" };
    }
}
