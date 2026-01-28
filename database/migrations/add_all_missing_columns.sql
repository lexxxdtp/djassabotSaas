-- Migration: Add ALL missing columns to settings table
-- Run this in Supabase SQL Editor

-- 1. notification_phone
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'notification_phone') THEN
        ALTER TABLE settings ADD COLUMN notification_phone text;
    END IF;
END $$;

-- 2. business_type
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'business_type') THEN
        ALTER TABLE settings ADD COLUMN business_type text;
    END IF;
END $$;

-- 3. location_url
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'location_url') THEN
        ALTER TABLE settings ADD COLUMN location_url text;
    END IF;
END $$;

-- 4. gps_coordinates
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'gps_coordinates') THEN
        ALTER TABLE settings ADD COLUMN gps_coordinates text;
    END IF;
END $$;

-- 5. social_media
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'social_media') THEN
        ALTER TABLE settings ADD COLUMN social_media jsonb DEFAULT '{}';
    END IF;
END $$;

-- 6. policy_description
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'policy_description') THEN
        ALTER TABLE settings ADD COLUMN policy_description text;
    END IF;
END $$;

-- 7. delivery_zones
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'delivery_zones') THEN
        ALTER TABLE settings ADD COLUMN delivery_zones jsonb DEFAULT '[]';
    END IF;
END $$;

-- 8. system_instructions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'settings' AND column_name = 'system_instructions') THEN
        ALTER TABLE settings ADD COLUMN system_instructions text;
    END IF;
END $$;

-- Verify all columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'settings' 
ORDER BY ordinal_position;
