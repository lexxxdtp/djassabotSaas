-- Migration: Add personality columns to settings table
-- Run this in Supabase SQL Editor

-- Add humor_level column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'humor_level') THEN
        ALTER TABLE settings ADD COLUMN humor_level text DEFAULT 'medium';
    END IF;
END $$;

-- Add slang_level column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'slang_level') THEN
        ALTER TABLE settings ADD COLUMN slang_level text DEFAULT 'low';
    END IF;
END $$;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'settings' 
AND column_name IN ('humor_level', 'slang_level');
