-- migrations_add_total_amount.sql
-- Додавання колонки total_amount до таблиці kps

ALTER TABLE kps ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0;

