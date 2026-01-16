-- Міграція: Додавання поля source до таблиці clients
-- Дата: 2025-12-15
-- Опис: Додає поле source для відстеження джерела створення клієнта

-- Додаємо поле source до таблиці clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';

-- Оновлюємо існуючих клієнтів (за замовчуванням 'manual')
UPDATE clients SET source = 'manual' WHERE source IS NULL;

-- Коментар для поля
COMMENT ON COLUMN clients.source IS 'Джерело створення клієнта: manual/checklist/kp/import';

