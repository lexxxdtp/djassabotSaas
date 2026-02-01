-- Migration: Add missing settings columns for vendor payments and negotiation
-- ✅ EXECUTED ON: 2026-02-01 16:35 UTC
-- Status: SUCCESS - 4 columns added

-- This migration has been applied to Supabase.
-- Keeping for documentation purposes.

/*
Columns added:
- settlement_bank TEXT
- settlement_account TEXT  
- negotiation_margin INTEGER DEFAULT 10
- free_delivery_threshold NUMERIC DEFAULT 50000
*/
