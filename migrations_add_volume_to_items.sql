-- Migration: Add volume, stock_quantity, and loss_price fields to items table
-- Date: 2024

ALTER TABLE items 
ADD COLUMN IF NOT EXISTS volume VARCHAR(255),
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS loss_price DOUBLE PRECISION;

