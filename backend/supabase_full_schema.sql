-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Tenants Table
create table if not exists tenants (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  business_type text default 'boutique',
  status text default 'trial' check (status in ('trial', 'active', 'suspended', 'cancelled')),
  subscription_tier text default 'starter' check (subscription_tier in ('starter', 'pro', 'business')),
  whatsapp_connected boolean default false,
  whatsapp_phone_number text,
  whatsapp_status text default 'disconnected',
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- 2. Users Table
create table if not exists users (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  email text,
  phone text,
  full_name text,
  birth_date date,
  password_hash text not null,
  role text default 'owner' check (role in ('owner', 'admin', 'staff')),
  email_verified boolean default false,
  phone_verified boolean default false,
  created_at timestamp with time zone default timezone('utc', now()),
  constraint users_email_unique unique (email),
  constraint users_phone_unique unique (phone)
);

-- 3. Products Table
create table if not exists products (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  name text not null,
  price numeric not null,
  stock integer default 0,
  description text,
  images text[] default '{}',
  min_price numeric,
  -- Variations/Déclinaisons (e.g., Size, Color, Flavor)
  -- Format: [{ "name": "Taille", "options": [{ "value": "S", "stock": 10, "priceModifier": 0 }] }]
  variations jsonb default '[]',
  -- Special AI instructions for this product (promotions, rules, etc.)
  -- Example: "Si le client prend 3+, proposer -10% sur le 5ème"
  ai_instructions text,
  -- Stock Management Mode (true = strict count, false = flexible/unlimited)
  manage_stock boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 4. Orders Table
create table if not exists orders (
  id text primary key, -- Custom ID format like ORD-12345
  tenant_id uuid references tenants(id) on delete cascade not null,
  user_id text not null, -- WhatsApp User ID (Phone number)
  items jsonb not null default '[]',
  total numeric not null,
  status text default 'PENDING' check (status in ('PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'PAID', 'CANCELLED')), -- Expanded statuses
  address text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 5. Activity Logs (The Pulse)
create table if not exists activity_logs (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  type text not null check (type in ('info', 'sale', 'warning', 'action')),
  message text not null,
  metadata jsonb default '{}', -- For extra data like 'order_id' or 'product_name'
  created_at timestamp with time zone default timezone('utc', now())
);

-- 6. Variation Templates (Réutilisables pour l'UX)
create table if not exists variation_templates (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  name text not null, -- e.g., "Taille", "Couleur Custom Vendeur"
  default_options jsonb default '[]', -- Format: [{ "value": "M", "stock": 0, "priceModifier": 0 }]
  usage_count integer default 0, -- Pour trier par popularité
  created_at timestamp with time zone default timezone('utc', now()),
  unique(tenant_id, name) -- Éviter les doublons par tenant
);

-- 7. Settings Table
create table if not exists settings (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null unique,
  
  -- Identity
  bot_name text default 'Awa',
  language text default 'fr',
  persona text default 'friendly',
  greeting text,
  
  -- Personality
  politeness text default 'informal',
  emoji_level text default 'medium',
  humor_level text default 'medium', -- Added
  slang_level text default 'low', -- Added (Nouchi/Argot)
  response_length text default 'medium',
  training_examples jsonb default '[]',
  negotiation_enabled boolean default true,
  negotiation_flexibility integer default 5,
  voice_enabled boolean default true,
  system_instructions text,
  
  -- Business
  store_name text,
  business_type text, -- Added
  address text,
  location_url text, -- Added (Google Maps Link)
  gps_coordinates text, -- Added
  phone text,
  social_media jsonb default '{}', -- Added { facebook, instagram, tiktok, website }
  hours text,
  return_policy text,
  policy_description text, -- Added (Long text)
  notification_phone text, -- Added for admin alerts
  
  -- Logistics
  delivery_enabled boolean default true,
  delivery_abidjan_price numeric default 1500,
  delivery_interior_price numeric default 3000,
  free_delivery_threshold numeric default 50000,
  accepted_payments jsonb default '["wave", "cash"]',
  delivery_zones jsonb default '[]',
  opening_hours jsonb,
  
  -- Vendor Payment (Split Payments)
  settlement_bank text,
  settlement_account text,
  
  -- AI Negotiation
  negotiation_margin integer default 10,  -- Percentage limit (0-100)
  
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- 8. Subscriptions Table
create table if not exists subscriptions (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  plan text default 'starter',
  status text default 'active',
  started_at timestamp with time zone default timezone('utc', now()),
  expires_at timestamp with time zone,
  auto_renew boolean default true,
  payment_method text,
  last_payment_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 9. Enable RLS (Row Level Security) - Optional but recommended
-- For MVP speed, we'll keep it simple but you SHOULD enable policies later
alter table tenants enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table activity_logs enable row level security;
alter table variation_templates enable row level security;
alter table settings enable row level security;
alter table subscriptions enable row level security;

-- 10. OPEN ACCESS POLICIES (FOR MVP ONLY - REMOVE IN PROD V2)
-- Allow anyone with the API Key/Service Role to do anything
create policy "Allow All Tenants" on tenants for all using (true) with check (true);
create policy "Allow All Users" on users for all using (true) with check (true);
create policy "Allow All Products" on products for all using (true) with check (true);
create policy "Allow All Orders" on orders for all using (true) with check (true);
create policy "Allow All Activity Logs" on activity_logs for all using (true) with check (true);
create policy "Allow All Variation Templates" on variation_templates for all using (true) with check (true);
create policy "Allow All Settings" on settings for all using (true) with check (true);
create policy "Allow All Subs" on subscriptions for all using (true) with check (true);

-- 11. Customers Table (CRM for Tenants)
create table if not exists customers (
  id uuid default uuid_generate_v4() primary key,
  tenant_id uuid references tenants(id) on delete cascade not null,
  phone text not null,
  name text,
  total_orders integer default 0,
  total_spent numeric default 0,
  last_order_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc', now()),
  unique(tenant_id, phone)
);

-- 12. Sessions Table (WhatsApp Context & State Persistence)
create table if not exists sessions (
  id text primary key, -- Format: "tenant_id:user_phone"
  tenant_id uuid references tenants(id) on delete cascade not null,
  user_phone text not null,
  state text default 'IDLE',
  history jsonb default '[]',
  temp_order jsonb,
  last_interaction timestamp with time zone default timezone('utc', now()),
  reminder_sent boolean default false,
  autopilot_enabled boolean default true,
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- Enable RLS for new tables
alter table customers enable row level security;
alter table sessions enable row level security;

-- Open Access Policies for new tables (match existing pattern)
create policy "Allow All Customers" on customers for all using (true) with check (true);
create policy "Allow All Sessions" on sessions for all using (true) with check (true);

-- MIGRATION: 2026-01-28 - Add Dynamic Settings Fields
-- Execute this block to update existing 'settings' table

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT TRUE;

-- Additional checks for columns that should exist
ALTER TABLE settings ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS policy_description TEXT DEFAULT '';
ALTER TABLE settings ADD COLUMN IF NOT EXISTS notification_phone TEXT DEFAULT '';

