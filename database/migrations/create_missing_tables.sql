-- Tables manquantes à créer dans Supabase SQL Editor
-- Colle ce SQL dans : Supabase Dashboard > SQL Editor > New query

-- 1. Activity Logs (journal d'activité du dashboard)
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('info', 'sale', 'warning', 'action')),
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Activity Logs" ON activity_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. Variation Templates (templates réutilisables : Taille, Couleur, etc.)
CREATE TABLE IF NOT EXISTS variation_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  default_options jsonb DEFAULT '[]',
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE variation_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow All Variation Templates" ON variation_templates FOR ALL USING (true) WITH CHECK (true);

-- 3. Mettre le tenant en statut "active" (plus "trial")
UPDATE tenants SET status = 'active' WHERE id = '5989aeca-c803-4262-9d9b-9ee69f1f046d';
