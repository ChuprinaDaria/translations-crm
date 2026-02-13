-- Fix InPost API key configuration
-- Created: 2026-02-13
-- 
-- This script helps fix the InPost API authentication issue.
-- 
-- IMPORTANT: Replace 'YOUR_REAL_JWT_TOKEN_FROM_INPOST' with the actual JWT token 
-- from your InPost account (API Settings -> Organization Token)
--
-- The token should look like: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNCW...

-- Update InPost settings with correct API key
UPDATE inpost_settings 
SET 
  api_key = 'YOUR_REAL_JWT_TOKEN_FROM_INPOST',  -- ⚠️ REPLACE THIS with your JWT token!
  organization_id = '124089',  -- Keep your organization ID
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- Verify the update
SELECT 
  id,
  CASE 
    WHEN api_key IS NULL THEN 'NULL'
    WHEN LENGTH(api_key) < 50 THEN 'TOO SHORT - probably not a JWT token!'
    ELSE CONCAT('OK - Length: ', LENGTH(api_key), ' chars')
  END as api_key_status,
  organization_id,
  sandbox_mode,
  is_enabled
FROM inpost_settings
WHERE id = 1;

-- Expected result:
-- api_key_status should show: "OK - Length: XXX chars" (where XXX is > 200)
-- organization_id should be: 124089
-- sandbox_mode should be: false
-- is_enabled should be: true

