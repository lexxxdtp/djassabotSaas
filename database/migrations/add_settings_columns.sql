-- Migration pour ajouter les nouveaux champs de configuration
-- Run this in Supabase SQL Editor

ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS opening_hours JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS delivery_zones JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS policy_description TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS notification_phone TEXT DEFAULT '';

-- Mise à jour des données existantes pour migrer les anciens champs vers les nouveaux (optionnel, best effort)
-- Exemple : migrer delivery_abidjan_price vers delivery_zones
-- Ceci est complexe en SQL pur sans fonction, on le fera peut-être manuellement ou via le code backend si besoin.
-- Pour l'instant, les valeurs par défaut suffisent.
