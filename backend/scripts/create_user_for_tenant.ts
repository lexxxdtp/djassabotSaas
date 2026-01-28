import { supabase } from '../src/config/supabase';
import bcrypt from 'bcryptjs';

const TENANT_ID = '8c65713f-6d23-4cb4-818a-f535421e8eb8';

async function main() {
    if (!supabase) {
        console.error('❌ Supabase non configuré');
        process.exit(1);
    }

    console.log(`🔧 Création d'un utilisateur pour le tenant ${TENANT_ID}...`);

    // Vérifier si un utilisateur existe déjà pour ce tenant
    const { data: existingUsers } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', TENANT_ID);

    if (existingUsers && existingUsers.length > 0) {
        console.log('✅ Un utilisateur existe déjà pour ce tenant:');
        console.log(existingUsers[0]);
        process.exit(0);
    }

    // Créer un nouvel utilisateur
    const passwordHash = await bcrypt.hash('Test1234!', 10);

    const { data, error } = await supabase
        .from('users')
        .insert({
            tenant_id: TENANT_ID,
            email: 'test@example.com',
            phone: '+2250700000000',
            full_name: 'Utilisateur Test',
            password_hash: passwordHash,
            role: 'owner',
            email_verified: false,
            phone_verified: false,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Erreur:', error.message);
        process.exit(1);
    }

    console.log('✅ Utilisateur créé avec succès !');
    console.log(data);
    console.log('\n📝 Identifiants de connexion:');
    console.log('   Email: test@example.com');
    console.log('   Mot de passe: Test1234!');
}

main();
