-- Міграція: Перенесення can_cook_on_location з kp_items в items
-- Додаємо поле до таблиці items
ALTER TABLE items 
ADD COLUMN IF NOT EXISTS can_cook_on_location BOOLEAN DEFAULT FALSE NOT NULL;

-- Копіюємо значення з kp_items в items (якщо страва має хоча б один запис з can_cook_on_location = true, то встановлюємо true)
UPDATE items 
SET can_cook_on_location = TRUE
WHERE id IN (
    SELECT DISTINCT item_id 
    FROM kp_items 
    WHERE item_id IS NOT NULL 
    AND can_cook_on_location = TRUE
);

-- Видаляємо поле з kp_items
ALTER TABLE kp_items 
DROP COLUMN IF EXISTS can_cook_on_location;

