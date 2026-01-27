-- Міграція: Виправлення типу api_id з UUID на INTEGER в таблиці telegram_accounts
-- Дата: 2026-01-22
-- Опис: Виправляє помилку типу даних для api_id (має бути INTEGER, а не UUID)

-- Перевіряємо поточний тип колонки
DO $$
BEGIN
    -- Якщо колонка має тип UUID, змінюємо на INTEGER
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'telegram_accounts' 
        AND column_name = 'api_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Спочатку видаляємо колонку (якщо вона UUID)
        ALTER TABLE telegram_accounts DROP COLUMN IF EXISTS api_id;
        
        -- Додаємо колонку з правильним типом INTEGER
        ALTER TABLE telegram_accounts ADD COLUMN api_id INTEGER;
        
        RAISE NOTICE 'Колонка api_id змінена з UUID на INTEGER';
    ELSIF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'telegram_accounts' 
        AND column_name = 'api_id'
    ) THEN
        -- Якщо колонки немає взагалі, додаємо її
        ALTER TABLE telegram_accounts ADD COLUMN api_id INTEGER;
        
        RAISE NOTICE 'Колонка api_id додана як INTEGER';
    ELSE
        -- Колонка вже має правильний тип
        RAISE NOTICE 'Колонка api_id вже має правильний тип INTEGER';
    END IF;
END $$;

-- Коментар для документації
COMMENT ON COLUMN telegram_accounts.api_id IS 'API ID для цього акаунта (Integer, nullable). Якщо не вказано - використовується глобальне значення з app_settings';

