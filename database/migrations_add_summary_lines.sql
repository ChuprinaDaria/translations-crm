-- Migration: Add summary_lines field to templates table
-- Date: 2024

ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS summary_lines JSON;

