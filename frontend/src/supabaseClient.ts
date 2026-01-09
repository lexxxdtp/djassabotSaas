import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Access environment variables directly if using Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
    console.error('[Supabase] ❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_KEY environment variables');
}

// Create client only if variables are present, otherwise create a dummy that will fail gracefully
export const supabase: SupabaseClient = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : createClient('https://placeholder.supabase.co', 'placeholder-key');
