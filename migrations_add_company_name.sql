-- migrations_add_company_name.sql
-- Додавання колонки company_name до таблиці clients

ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

