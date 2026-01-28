import { supabase } from '../src/config/supabase';

const TENANT_ID = '8c65713f-6d23-4cb4-818a-f535421e8eb8';

async function main() {
    if (!supabase) {
        console.error('❌ Supabase non configuré');
        process.exit(1);
    }

    console.log(`🔧 Correction des tarifs de livraison pour le tenant ${TENANT_ID}...`);

    // Corriger les valeurs de livraison
    const { data, error } = await supabase
        .from('settings')
        .update({
            delivery_abidjan_price: 1500,
            delivery_interior_price: 3000,
            free_delivery_threshold: 50000,
            updated_at: new Date().toISOString()
        })
        .eq('tenant_id', TENANT_ID)
        .select()
        .single();

    if (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }

    console.log('✅ Tarifs corrigés avec succès !');
    console.log('Nouvelles valeurs:');
    console.log(`  - Livraison Abidjan: ${data.delivery_abidjan_price} FCFA`);
    console.log(`  - Livraison Intérieur: ${data.delivery_interior_price} FCFA`);
    console.log(`  - Seuil Gratuit: ${data.free_delivery_threshold} FCFA`);
}

main();
