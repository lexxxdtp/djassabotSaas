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

if (ENABLE_SUPABASE) {
    // Fallback for Railway if env vars are missing but we want to hardcode for test
    const finalUrl = supabaseUrl || 'https://dnglgyviycbpoerywanc.supabase.co';
    const finalKey = supabaseKey || process.env.VITE_SUPABASE_KEY; // Try to grab from anywhere

    if (finalUrl && finalKey) {
        try {
            supabaseInstance = createClient(finalUrl, finalKey);
            isConfigured = true;
            console.log(`[Config] ✅ Supabase Client Initialized with URL: ${finalUrl}`);
        } catch (error) {
            console.warn('[Config] ⚠️ Supabase initialization failed:', error);
        }
    } else {
        console.warn('[Config] ❌ Supabase keys missing. URL:', finalUrl ? 'SET' : 'MISSING', 'Key:', finalKey ? 'SET' : 'MISSING');
    }
}

if (!isConfigured) {
    console.log('[Config] ℹ️ Running in Local Fallback Mode (Supabase disabled or missing keys)');
}

export const supabase = supabaseInstance;
export const isSupabaseEnabled = isConfigured;
