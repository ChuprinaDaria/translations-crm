-- Alter inpost_settings.webhook_secret from VARCHAR(255) to TEXT
-- Created: 2026-02-04
-- Reason: JWT tokens can be longer than 255 characters

-- Change webhook_secret column type from VARCHAR(255) to TEXT
ALTER TABLE inpost_settings 
ALTER COLUMN webhook_secret TYPE TEXT;

-- Add comment
COMMENT ON COLUMN inpost_settings.webhook_secret IS 'Webhook secret for verification (supports long JWT tokens)';

