-- 1. Create Products Table
create table products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  price numeric not null,
  stock integer not null default 0,
  description text,
  images text[] default '{}',
  created_at timestamp with time zone default timezone('utc', now())
);

-- 2. Enable Row Level Security (RLS)
alter table products enable row level security;

-- 3. Create Policy to allow public access (Simplest for MVP)
create policy "Enable all access for all users" on products for all using (true) with check (true);

-- 4. Create Storage Bucket for Images
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true);

-- 5. Storage Policies
create policy "Public Access" on storage.objects for select using ( bucket_id = 'product-images' );
create policy "Public Upload" on storage.objects for insert with check ( bucket_id = 'product-images' );
create policy "Public Update" on storage.objects for update using ( bucket_id = 'product-images' );
