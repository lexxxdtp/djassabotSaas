import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// CENTRALIZED CONFIG: Control Local vs Cloud mode here
// Set to 'true' to attempt connection, 'false' to force local mode
const ENABLE_SUPABASE = false; // Currently forced to false for testing without tables

let supabaseInstance: SupabaseClient | null = null;
let isConfigured = false;

if (ENABLE_SUPABASE && supabaseUrl && supabaseKey) {
    try {
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
        isConfigured = true;
        console.log('[Config] ✅ Supabase Client Initialized');
    } catch (error) {
        console.warn('[Config] ⚠️ Supabase initialization failed:', error);
    }
} else {
    console.log('[Config] ℹ️ Running in Local Fallback Mode (Supabase disabled or missing keys)');
}

export const supabase = supabaseInstance;
export const isSupabaseEnabled = isConfigured;
