import { supabase } from '../src/config/supabase';

const TENANT_ID = '8c65713f-6d23-4cb4-818a-f535421e8eb8';

async function main() {
    if (!supabase) {
        console.error('❌ Supabase non configuré');
        process.exit(1);
    }

    console.log(`🔧 Restauration du tenant ${TENANT_ID}...`);

    // Vérifier si le tenant existe déjà
    const { data: existing } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', TENANT_ID)
        .maybeSingle();

    if (existing) {
        console.log('✅ Le tenant existe déjà !');
        process.exit(0);
    }

    // Créer le tenant
    const { data, error } = await supabase
        .from('tenants')
        .insert({
            id: TENANT_ID,
            name: 'Ma Boutique Mode',
            business_type: 'Mode & Vêtements',
            status: 'active',
            subscription_tier: 'starter',
            whatsapp_connected: false,
            whatsapp_status: 'disconnected',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }

    console.log('✅ Tenant restauré avec succès !');
    console.log(data);
}

main();
