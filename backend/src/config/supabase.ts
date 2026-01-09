import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// CENTRALIZED CONFIG: Control Local vs Cloud mode here
// Set to 'true' to attempt connection, 'false' to force local mode
const ENABLE_SUPABASE = true; // ENABLED FOR PRODUCTION

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = false;

// CRITICAL FIX: Force connection check
if (ENABLE_SUPABASE) {
    // Fallback for Railway if env vars are missing but we want to hardcode for test
    const finalUrl = supabaseUrl || 'https://dnglgyviycbpoerywanc.supabase.co';
    const finalKey = supabaseKey || process.env.VITE_SUPABASE_KEY;

    if (finalUrl && finalKey) {
        try {
            console.log(`[Config] ⏳ Attempting connection to Supabase at ${finalUrl}...`);
            supabaseInstance = createClient(finalUrl, finalKey);
            isConfigured = true;
            console.log(`[Config] ✅ Supabase Client Initialized successfully.`);
        } catch (error) {
            console.error('[Config] ❌ FATAL: Supabase initialization failed:', error);
            // DO NOT FALLBACK IN PROD - THROW ERROR
            throw new Error('Supabase Connection Failed. Application cannot start without Database.');
        }
    } else {
        console.error('[Config] ❌ FATAL: Supabase keys missing!');
        console.error(`URL Present: ${!!finalUrl}, Key Present: ${!!finalKey}`);
        // DO NOT FALLBACK IN PROD - THROW ERROR
        if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT) {
            throw new Error('Supabase Configuration Missing in Production.');
        }
    }
}

if (!isConfigured) {
    console.warn('[Config] ⚠️ WARNING: Running in Local Fallback Mode (RAM ONLY). Data will be lost on restart.');
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Local Fallback Mode is NOT allowed in Production.');
    }
}

export const supabase = supabaseInstance;
export const isSupabaseEnabled = isConfigured;
