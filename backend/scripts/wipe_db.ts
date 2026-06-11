import { supabase } from '../src/config/supabase';

async function wipeDatabase() {
    // ⛔ GARDE-FOU : ce script EFFACE TOUTE LA BASE (tous les tenants, toutes
    // les commandes, tous les comptes). Il ne s'exécute que si on le demande
    // explicitement : WIPE_CONFIRM=OUI_TOUT_EFFACER npx ts-node scripts/wipe_db.ts
    if (process.env.WIPE_CONFIRM !== 'OUI_TOUT_EFFACER') {
        console.error('⛔ REFUSÉ. Ce script efface TOUTE la base de données (production incluse).');
        console.error('   Pour exécuter volontairement :');
        console.error('   WIPE_CONFIRM=OUI_TOUT_EFFACER npx ts-node scripts/wipe_db.ts');
        process.exit(1);
    }

    if (!supabase) {
        console.error("❌ Supabase client is not initialized.");
        return;
    }
    console.log("⚠️ Starting database wipe...");

    const tables = [
        'activity_logs',
        'sessions',
        'orders',
        'carts',
        'variation_templates',
        'products',
        'settings',
        'subscriptions',
        'users',
        'customers',
        'auth_tokens',
        'tenants'
    ];

    for (const table of tables) {
        console.log(`Clearing table: ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) {
            console.error(`❌ Error clearing table ${table}:`, error.message);
        } else {
            console.log(`✅ Table ${table} cleared successfully.`);
        }
    }

    console.log("🎉 Database wipe completed!");
}

wipeDatabase();
