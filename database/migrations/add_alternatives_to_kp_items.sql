-- Міграція: Додавання полів для альтернатив страв в KPItem
-- Додаємо поля is_alternative та alternative_group_id для підтримки альтернативних варіантів страв

ALTER TABLE kp_items 
ADD COLUMN IF NOT EXISTS is_alternative BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS alternative_group_id VARCHAR(255);

-- Створюємо індекс для швидкого пошуку альтернатив
CREATE INDEX IF NOT EXISTS idx_kp_items_alternative_group ON kp_items(alternative_group_id) WHERE alternative_group_id IS NOT NULL;

