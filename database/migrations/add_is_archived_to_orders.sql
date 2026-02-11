-- Міграція: Додавання поля is_archived до таблиці crm_orders
-- Додає поле для архівації замовлень

-- Додаємо поле is_archived
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'crm_orders' 
        AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE crm_orders 
        ADD COLUMN is_archived BOOLEAN DEFAULT FALSE NOT NULL;
        
        -- Створюємо індекс для швидкої фільтрації
        CREATE INDEX IF NOT EXISTS idx_orders_is_archived 
        ON crm_orders(is_archived);
    END IF;
END $$;

