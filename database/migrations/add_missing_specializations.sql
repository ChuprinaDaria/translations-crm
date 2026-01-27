-- Migration: Add missing specializations from CSV
-- Date: 2026-01-22
-- Description: Adds missing document types: Zaświadczenie, Samochodowe

-- Додаємо відсутні типи документів
INSERT INTO specializations (name, description, is_custom) VALUES
('Zaświadczenie', 'Zaświadczenia i certyfikaty', FALSE),
('Samochodowe', 'Dokumenty samochodowe', FALSE)
ON CONFLICT (name) DO NOTHING;

