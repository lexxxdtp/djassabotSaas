-- Migration: Add delivery_enabled and opening_hours columns to settings
-- Run this in Supabase SQL Editor
-- Date: 2026-02-01

-- 1. delivery_enabled (controls if delivery is offered)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS delivery_enabled BOOLEAN DEFAULT TRUE;

-- 2. opening_hours (business hours JSON)
ALTER TABLE settings 
ADD COLUMN IF NOT EXISTS opening_hours JSONB;

-- Verify columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'settings' 
AND column_name IN ('delivery_enabled', 'opening_hours')
ORDER BY column_name;
