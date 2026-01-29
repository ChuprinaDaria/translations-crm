-- Міграція: Виправлення типу id з UUID на INTEGER в таблиці telegram_accounts
-- Дата: 2026-01-22
-- Опис: Виправляє помилку типу даних для id (має бути INTEGER/SERIAL, а не UUID)

-- Перевіряємо поточний тип колонки id
DO $$
DECLARE
    current_type TEXT;
    seq_name TEXT;
BEGIN
    -- Отримуємо поточний тип колонки id
    SELECT data_type INTO current_type
    FROM information_schema.columns
    WHERE table_name = 'telegram_accounts'
    AND column_name = 'id';
    
    -- Якщо колонка має тип UUID, змінюємо на SERIAL
    IF current_type = 'uuid' THEN
        -- Створюємо нову таблицю з правильним типом
        CREATE TABLE telegram_accounts_new (
            id SERIAL PRIMARY KEY,
            name VARCHAR NOT NULL,
            phone VARCHAR,
            session_string VARCHAR NOT NULL,
            api_id INTEGER,
            api_hash VARCHAR,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Копіюємо дані (без id, щоб згенерувались нові)
        INSERT INTO telegram_accounts_new (name, phone, session_string, api_id, api_hash, is_active, created_at)
        SELECT name, phone, session_string, api_id, api_hash, is_active, created_at
        FROM telegram_accounts;
        
        -- Видаляємо стару таблицю
        DROP TABLE telegram_accounts CASCADE;
        
        -- Перейменовуємо нову таблицю
        ALTER TABLE telegram_accounts_new RENAME TO telegram_accounts;
        
        -- Відновлюємо індекси
        CREATE INDEX IF NOT EXISTS idx_telegram_accounts_name ON telegram_accounts(name);
        CREATE INDEX IF NOT EXISTS idx_telegram_accounts_phone ON telegram_accounts(phone);
        CREATE INDEX IF NOT EXISTS idx_telegram_accounts_is_active ON telegram_accounts(is_active);
        
        RAISE NOTICE 'Колонка id змінена з UUID на SERIAL (INTEGER)';
    ELSIF current_type = 'integer' OR current_type = 'bigint' THEN
        -- Колонка вже має правильний тип
        RAISE NOTICE 'Колонка id вже має правильний тип INTEGER';
    ELSE
        RAISE NOTICE 'Невідомий тип колонки id: %', current_type;
    END IF;
END $$;

-- Коментар для документації
COMMENT ON COLUMN telegram_accounts.id IS 'Primary key (SERIAL/INTEGER, auto-increment)';

