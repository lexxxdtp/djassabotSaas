-- Migration: Create auth_tokens table for OTP and Password Resets
-- Safe to run multiple times (idempotent)

CREATE TABLE IF NOT EXISTS public.auth_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- email or phone or user_id
    token_type VARCHAR(50) NOT NULL, -- 'EMAIL_OTP' or 'PASSWORD_RESET'
    token_value VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS idx_auth_tokens_identifier ON public.auth_tokens (identifier);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_type_value ON public.auth_tokens (token_type, token_value);
