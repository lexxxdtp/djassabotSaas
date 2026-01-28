import { supabase } from '../src/config/supabase';

async function main() {
    if (!supabase) {
        console.error('❌ Supabase non configuré');
        process.exit(1);
    }

    console.log('🔍 Diagnostic des utilisateurs...\n');

    // Récupérer tous les utilisateurs
    const { data: users, error } = await supabase
        .from('users')
        .select('*');

    if (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }

    if (!users || users.length === 0) {
        console.log('⚠️ Aucun utilisateur trouvé dans la base.');
        process.exit(0);
    }

    console.log(`📊 ${users.length} utilisateur(s) trouvé(s):\n`);

    for (const user of users) {
        console.log(`👤 User ID: ${user.id}`);
        console.log(`   📧 Email: ${user.email || '(non défini)'}`);
        console.log(`   📱 Téléphone: ${user.phone || '(non défini)'}`);
        console.log(`   👤 Nom Complet: ${user.full_name || '(non défini)'}`);
        console.log(`   🎂 Date de Naissance: ${user.birth_date || '(non défini)'}`);
        console.log(`   🏢 Tenant ID: ${user.tenant_id}`);
        console.log(`   👑 Rôle: ${user.role}`);
        console.log('');
    }

    // Vérifier les tenants associés
    const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, status');

    console.log(`\n🏢 ${tenants?.length || 0} tenant(s) trouvé(s):`);
    tenants?.forEach(t => {
        console.log(`   - ${t.name} (${t.id}) - Status: ${t.status}`);
    });
}

main();
