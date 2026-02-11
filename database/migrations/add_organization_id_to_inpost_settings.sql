-- Add organization_id column to inpost_settings table
-- Created: 2026-02-11

ALTER TABLE inpost_settings 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100);

COMMENT ON COLUMN inpost_settings.organization_id IS 'InPost Organization ID for ShipX API';

