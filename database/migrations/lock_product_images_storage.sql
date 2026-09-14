-- ============================================================================
-- Photos produits : plus aucune écriture anonyme (audit du 14 septembre 2026, A01)
--
-- POURQUOI : les politiques « Public Upload » et « Public Update » autorisaient
-- le rôle public à ajouter ou REMPLACER n'importe quel fichier du bucket
-- product-images, sans compte, sans limite de taille ni de type. Les chemins
-- des photos sont visibles dans les URLs envoyées aux clients : n'importe qui
-- pouvait remplacer la photo d'un produit par une autre image.
--
-- Le frontend n'écrit plus dans Supabase : les photos passent par
-- POST /api/products/upload (authentifié, 5 Mo, types contrôlés), qui utilise la
-- clé service_role et n'a donc besoin d'aucune politique.
--
-- La lecture reste publique : un bucket public sert ses fichiers par URL
-- (/storage/v1/object/public/...) sans politique SELECT. La politique
-- « Public Access » permettait en plus de LISTER les photos de toutes les
-- boutiques via l'API : elle est retirée aussi.
--
-- adjust_stock : exécutable par anon/authenticated dans l'état constaté. La RLS
-- des produits bloquait l'effet, mais la fonction est réservée au backend.
--
-- Vérification après application : une insertion dans storage.objects avec le
-- rôle anon doit être refusée (voir la requête en bas de fichier).
-- ============================================================================

drop policy if exists "Public Upload" on storage.objects;
drop policy if exists "Public Update" on storage.objects;
drop policy if exists "Public Access" on storage.objects;

update storage.buckets
set file_size_limit = 5242880, -- 5 Mo, comme la limite du backend
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'product-images';

revoke all on function adjust_stock(uuid, text, integer, jsonb) from public, anon, authenticated;
grant execute on function adjust_stock(uuid, text, integer, jsonb) to service_role;

-- Contrôle (à lancer séparément, ne crée rien) :
-- begin;
--   set local role anon;
--   insert into storage.objects (bucket_id, name) values ('product-images', 'controle-anonyme.txt');
--   -- attendu : ERROR new row violates row-level security policy
-- rollback;
