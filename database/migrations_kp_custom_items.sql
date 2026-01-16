-- Міграція для підтримки custom items в КП
-- Дозволяє створювати позиції без прив'язки до меню

-- 1. Робимо item_id nullable
ALTER TABLE kp_items ALTER COLUMN item_id DROP NOT NULL;

-- 2. Додаємо поля для custom items
ALTER TABLE kp_items ADD COLUMN IF NOT EXISTS name VARCHAR;
ALTER TABLE kp_items ADD COLUMN IF NOT EXISTS price FLOAT;
ALTER TABLE kp_items ADD COLUMN IF NOT EXISTS weight FLOAT;
ALTER TABLE kp_items ADD COLUMN IF NOT EXISTS unit VARCHAR;

-- 3. Додаємо індекс для швидшого пошуку custom items
CREATE INDEX IF NOT EXISTS idx_kp_items_custom ON kp_items(item_id) WHERE item_id IS NULL;

-- 4. Додаємо check constraint: або є item_id, або є name і price
ALTER TABLE kp_items ADD CONSTRAINT check_item_or_custom 
    CHECK (
        item_id IS NOT NULL OR (name IS NOT NULL AND price IS NOT NULL)
    );

