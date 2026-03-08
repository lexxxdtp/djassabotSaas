/**
 * E2E Auth Flow Test Script
 * Run with: npx tsx test_auth_flow.ts
 */

const API_URL = 'http://localhost:3000/api';
import { db } from './src/services/dbService';
import { supabase, isSupabaseEnabled } from './src/config/supabase';
const testEmail = `test_${Date.now()}@example.com`;
const testPassword = 'Password123';

async function runTests() {
    console.log(`🚀 Starting Auth E2E Tests for ${testEmail}...\n`);

    try {
        // 1. Signup Flow
        console.log('1️⃣  Testing /api/auth/signup...');
        const signupRes = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                businessName: 'My Test Shop',
                email: testEmail,
                password: testPassword,
                businessType: 'Boutique',
                fullName: 'Test User'
            })
        });
        const signupData = await signupRes.json() as any;
        if (!signupRes.ok) throw new Error(`Signup failed: ${signupData.error}`);
        console.log('✅ Signup successful! Token received.');

        // 2. Login Flow
        console.log('\n2️⃣  Testing /api/auth/login...');
        const loginRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: testEmail,
                password: testPassword
            })
        });
        const loginData = await loginRes.json() as any;
        if (!loginRes.ok) throw new Error(`Login failed: ${loginData.error}`);
        const token = loginData.token;
        console.log('✅ Login successful! Validated password.');

        // 3. Update Me Flow
        console.log('\n3️⃣  Testing /api/auth/me (Update)...');
        const updateRes = await fetch(`${API_URL}/auth/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                full_name: 'Test User Updated'
            })
        });
        const updateData = await updateRes.json() as any;
        if (!updateRes.ok) throw new Error(`Update failed: ${updateData.error}`);
        if (updateData.user.full_name !== 'Test User Updated') throw new Error('Update did not persist.');
        console.log('✅ Update /me successful! Profile info persisted to database.');

        // 4. Forgot Password
        console.log('\n4️⃣  Testing /api/auth/forgot-password...');
        const forgotRes = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: testEmail })
        });
        if (!forgotRes.ok) throw new Error('Forgot password failed');
        console.log('✅ Forgot password successful! A reset token should be generated and stored in Supabase (or local JSON fallback).');

        // 5. Retrieve Token and Reset Password
        console.log('\n5️⃣  Retrieving Password Reset Token directly from DB...');
        // Wait a tiny bit to ensure DB writes are fully flushed if local
        await new Promise(r => setTimeout(r, 1000));

        let validToken = null;

        if (isSupabaseEnabled && supabase) {
            const { data, error } = await supabase.from('auth_tokens').select('*').eq('token_type', 'PASSWORD_RESET').order('created_at', { ascending: false }).limit(1);
            if (!error && data && data.length > 0) {
                validToken = data[0].token_value;
            }
        } else {
            // Need to parse local store if supabase is disabled, but Supabase is enabled here.
            throw new Error("Local fallback test not implemented. Supabase is expected.");
        }

        if (!validToken) throw new Error("Could not find the reset token in the DB.");
        console.log(`✅ Token retrieved successfully: ${validToken}`);

        // 6. Reset Password
        console.log('\n6️⃣  Testing /api/auth/reset-password...');
        const newPassword = 'NewPassword123#';
        const resetRes = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: validToken, password: newPassword })
        });
        const resetData = await resetRes.json() as any;
        if (!resetRes.ok) throw new Error(`Reset password failed: ${resetData.error}`);
        console.log('✅ Password reset successful!');

        // 7. Login with New Password
        console.log('\n7️⃣  Verifying login with the NEW password...');
        const loginNewRes = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: testEmail, password: newPassword })
        });
        if (!loginNewRes.ok) throw new Error('Login with new password failed');
        console.log('✅ Login with new password successful!');

        console.log('\n🎉 All API flow checks passed! The database seamlessly handles info and reacts to password updates.');

    } catch (err: any) {
        console.error('\n❌ Test failed: ', err.message);
        process.exit(1);
    }
}

runTests();
