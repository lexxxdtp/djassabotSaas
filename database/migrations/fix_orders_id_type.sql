-- Script pour corriger les différences entre votre base de données et le code
-- A copier/coller dans l'éditeur SQL de Supabase et à exécuter (Run)

-- 1. Corriger la table `orders`
-- Actuellement `id` est de type UUID dans votre base, mais le code génère des identifiants texte (ex: "ORD-12345").
-- Cela bloque la création de commandes. Nous devons changer le type en TEXT.

ALTER TABLE orders 
ALTER COLUMN id TYPE text USING id::text;

-- 2. Nettoyage des colonnes inutilisées (Optionnel mais recommandé pour garder la base propre)
-- Ces colonnes existent dans votre table `settings`, mais le code utilise d'autres noms maintenant.
-- Décommentez (enlevez les --) si vous voulez les supprimer :

-- ALTER TABLE settings DROP COLUMN IF EXISTS business_description;
-- ALTER TABLE settings DROP COLUMN IF EXISTS specific_instructions;

-- Tout le reste (les nouveautés comme manage_stock, ai_instructions, opening_hours, etc.)
-- est parfaitement en place dans votre base ! 🎉
