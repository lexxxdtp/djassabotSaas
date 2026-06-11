-- ============================================================
-- RLS défense en profondeur — À APPLIQUER ENSEMBLE (pas en aveugle)
-- ============================================================
-- CONTEXTE : aujourd'hui toutes les policies sont `using (true)` :
-- n'importe qui possédant la clé ANON peut lire TOUTE la base.
-- Le backend utilise la clé SERVICE_ROLE qui CONTOURNE la RLS,
-- donc il continuera de fonctionner normalement après ce changement.
--
-- ⚠️ PRÉREQUIS AVANT D'APPLIQUER (vérifier ensemble) :
-- 1. Le .env du VPS utilise bien la clé service_role (pas anon) :
--    ssh alex@187.77.171.44 "grep SUPABASE_KEY /home/alex/djassabotSaas/backend/.env | head -c 60"
--    → la clé service_role contient "service_role" dans son payload JWT.
--    Test rapide : https://jwt.io → coller la clé → "role":"service_role"
-- 2. Le frontend n'interroge AUCUNE table directement (vérifié dans le code :
--    les uploads passent par le backend, supabaseClient.ts n'est plus utilisé
--    pour les tables).
--
-- APRÈS APPLICATION, TESTER IMMÉDIATEMENT :
-- - Connexion au dashboard, liste produits, commandes, conversations
-- - Envoi d'un message au bot (lecture/écriture sessions)
--
-- ROLLBACK si problème :
--   Réappliquer les policies permissives (voir bloc tout en bas).
-- ============================================================

-- 1. Supprimer toutes les policies permissives existantes
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 2. S'assurer que la RLS est ACTIVÉE sur toutes les tables métier
alter table if exists tenants             enable row level security;
alter table if exists users               enable row level security;
alter table if exists subscriptions      enable row level security;
alter table if exists settings            enable row level security;
alter table if exists products            enable row level security;
alter table if exists orders              enable row level security;
alter table if exists sessions            enable row level security;
alter table if exists auth_tokens         enable row level security;
alter table if exists activity_logs       enable row level security;
alter table if exists variation_templates enable row level security;
alter table if exists customers           enable row level security;

-- 3. AUCUNE policy créée = accès refusé pour anon et authenticated.
--    Seul le backend (service_role) peut lire/écrire — c'est le but :
--    toute la logique d'accès passe par l'API qui filtre par tenantId.

-- ============================================================
-- ROLLBACK (en cas de casse) — recrée l'accès permissif d'avant :
-- ============================================================
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['tenants','users','subscriptions','settings','products','orders','sessions','auth_tokens','activity_logs','variation_templates','customers']
--   loop
--     execute format('create policy allow_all on %I for all using (true) with check (true)', t);
--   end loop;
-- end $$;
