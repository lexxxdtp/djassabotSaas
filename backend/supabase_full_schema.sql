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
  created_at timestamp with time zone default timezone('utc', now())
);

-- 4. Orders Table
create table if not exists orders (
  id text primary key, -- Custom ID format like ORD-12345
  tenant_id uuid references tenants(id) on delete cascade not null,
  user_id text not null, -- WhatsApp User ID (Phone number)
  items jsonb not null default '[]',
  total numeric not null,
  status text default 'PENDING' check (status in ('PENDING', 'PAID', 'DELIVERED', 'CANCELLED')),
  address text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- 5. Settings Table
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
  response_length text default 'medium',
  training_examples jsonb default '[]',
  negotiation_enabled boolean default true,
  negotiation_flexibility integer default 5,
  voice_enabled boolean default true,
  system_instructions text,
  
  -- Business
  store_name text,
  address text,
  phone text,
  hours text,
  return_policy text,
  
  -- Logistics
  delivery_abidjan_price numeric default 1500,
  delivery_interior_price numeric default 3000,
  free_delivery_threshold numeric default 50000,
  accepted_payments jsonb default '["wave", "cash"]',
  delivery_zones jsonb default '[]',
  
  created_at timestamp with time zone default timezone('utc', now()),
  updated_at timestamp with time zone default timezone('utc', now())
);

-- 6. Subscriptions Table
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

-- 7. Enable RLS (Row Level Security) - Optional but recommended
-- For MVP speed, we'll keep it simple but you SHOULD enable policies later
alter table tenants enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table settings enable row level security;
alter table subscriptions enable row level security;

-- 8. OPEN ACCESS POLICIES (FOR MVP ONLY - REMOVE IN PROD V2)
-- Allow anyone with the API Key/Service Role to do anything
create policy "Allow All Tenants" on tenants for all using (true) with check (true);
create policy "Allow All Users" on users for all using (true) with check (true);
create policy "Allow All Products" on products for all using (true) with check (true);
create policy "Allow All Orders" on orders for all using (true) with check (true);
create policy "Allow All Settings" on settings for all using (true) with check (true);
create policy "Allow All Subs" on subscriptions for all using (true) with check (true);
