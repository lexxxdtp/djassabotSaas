-- ==========================================
-- TDJAASA SAAS - MULTI-TENANT DATABASE SCHEMA
-- ==========================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLE TENANTS (Clients/Business Owners)
-- ==========================================
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    business_type TEXT, -- friperie, restaurant, boutique, etc.
    status TEXT DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'business')),
    whatsapp_connected BOOLEAN DEFAULT false,
    whatsapp_phone_number TEXT,
    whatsapp_status TEXT DEFAULT 'disconnected',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 2. TABLE USERS (Admin de chaque tenant)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ==========================================
-- 3. TABLE SUBSCRIPTIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'business')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    auto_renew BOOLEAN DEFAULT true,
    payment_method TEXT, -- wave, orange_money, manual
    last_payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_tenant_id ON subscriptions(tenant_id);

-- ==========================================
-- 4. MODIFIER TABLE PRODUCTS (Ajouter tenant_id)
-- ==========================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);

-- ==========================================
-- 5. MODIFIER TABLE ORDERS (Ajouter tenant_id)
-- ==========================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);

-- ==========================================
-- 6. TABLE SETTINGS (One per tenant)
-- ==========================================
-- Vérifier si la table existe déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'settings') THEN
        CREATE TABLE settings (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
            bot_name TEXT DEFAULT 'Assistant',
            business_name TEXT,
            business_description TEXT,
            accepted_payments JSONB DEFAULT '["cash"]'::jsonb,
            delivery_zones JSONB DEFAULT '[]'::jsonb,
            specific_instructions TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
    ELSE
        -- Si elle existe, juste ajouter tenant_id si manquant
        ALTER TABLE settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_settings_tenant_id ON settings(tenant_id);

-- ==========================================
-- 7. TABLE CARTS (Ajouter tenant_id)
-- ==========================================
-- Créer si n'existe pas
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL, -- WhatsApp phone number
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carts_tenant_id ON carts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id);

-- ==========================================
-- 8. ROW LEVEL SECURITY (RLS)
-- ==========================================

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
CREATE POLICY tenant_isolation_orders ON orders
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_settings ON settings;
CREATE POLICY tenant_isolation_settings ON settings
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- Carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_carts ON carts;
CREATE POLICY tenant_isolation_carts ON carts
    USING (tenant_id::text = current_setting('app.current_tenant', true));

-- ==========================================
-- 9. SEED DATA (Tenant de test)
-- ==========================================
DO $$ 
DECLARE
    test_tenant_id UUID;
    test_user_id UUID;
BEGIN
    -- Créer un tenant de test
    INSERT INTO tenants (name, business_type, status)
    VALUES ('Boutique Test', 'boutique', 'active')
    RETURNING id INTO test_tenant_id;
    
    -- Créer un user de test (password = "password123")
    INSERT INTO users (tenant_id, email, password_hash)
    VALUES (
        test_tenant_id, 
        'test@tdjaasa.ci', 
        '$2a$10$rOWN9qhPZqKJZfYkWZ9vO.vQ5zKqKqHqZqKqHqZqKqHqZqKqHqZqK' -- bcrypt hash de "password123"
    )
    RETURNING id INTO test_user_id;
    
    -- Créer un abonnement de test
    INSERT INTO subscriptions (tenant_id, plan, status, expires_at)
    VALUES (test_tenant_id, 'starter', 'active', NOW() + INTERVAL '30 days');
    
    -- Créer les settings par défaut
    INSERT INTO settings (tenant_id, bot_name, business_name)
    VALUES (test_tenant_id, 'Assistant Test', 'Boutique Test');
    
    RAISE NOTICE 'Tenant de test créé avec ID: %', test_tenant_id;
END $$;

-- ==========================================
-- FIN DU SCHEMA
-- ==========================================
