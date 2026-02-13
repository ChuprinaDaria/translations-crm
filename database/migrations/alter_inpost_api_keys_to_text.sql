-- Alter inpost_settings.api_key and sandbox_api_key from VARCHAR(255) to TEXT
-- Created: 2026-02-13
-- Reason: JWT tokens can be longer than 255 characters (typically 500+ chars)

-- Change api_key column type from VARCHAR(255) to TEXT
ALTER TABLE inpost_settings 
ALTER COLUMN api_key TYPE TEXT;

-- Change sandbox_api_key column type from VARCHAR(255) to TEXT
ALTER TABLE inpost_settings 
ALTER COLUMN sandbox_api_key TYPE TEXT;

-- Add comments
COMMENT ON COLUMN inpost_settings.api_key IS 'InPost API key (JWT Organization Token for API authentication - supports long JWT tokens)';
COMMENT ON COLUMN inpost_settings.sandbox_api_key IS 'InPost sandbox API key (JWT token - supports long JWT tokens)';

