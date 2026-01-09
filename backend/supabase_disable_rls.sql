-- DÉSACTIVER TEMPORAIREMENT RLS (Row Level Security)
-- Cela permet à l'API (qui utilise peut-être la clé anon) d'écrire sans restriction
-- Une fois le système stable, nous remettrons des politiques précises.

ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- Pour être sûr, on donne tous les droits public (attention sécu, mais c'est pour debug)
GRANT ALL ON TABLE products TO anon;
GRANT ALL ON TABLE tenants TO anon;
GRANT ALL ON TABLE users TO anon;
GRANT ALL ON TABLE orders TO anon;
GRANT ALL ON TABLE settings TO anon;
GRANT ALL ON TABLE subscriptions TO anon;
