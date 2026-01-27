-- Міграція: Перевірка та створення таблиці manager_smtp_accounts якщо вона відсутня
-- Дата: 2026-01-22
-- Опис: Забезпечує існування таблиці manager_smtp_accounts для foreign key в communications_conversations

-- Створюємо таблицю якщо вона не існує
CREATE TABLE IF NOT EXISTS manager_smtp_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    smtp_host VARCHAR NOT NULL,
    smtp_port INTEGER NOT NULL DEFAULT 587,
    smtp_user VARCHAR NOT NULL,
    smtp_password VARCHAR NOT NULL,
    imap_host VARCHAR,
    imap_port INTEGER DEFAULT 993,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Створюємо індекси якщо вони не існують
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manager_smtp_accounts') THEN
        CREATE INDEX IF NOT EXISTS idx_manager_smtp_accounts_name ON manager_smtp_accounts(name);
        CREATE INDEX IF NOT EXISTS idx_manager_smtp_accounts_email ON manager_smtp_accounts(email);
        CREATE INDEX IF NOT EXISTS idx_manager_smtp_accounts_is_active ON manager_smtp_accounts(is_active);
    END IF;
END $$;

-- Перевіряємо та створюємо foreign key constraint якщо він відсутній
DO $$
BEGIN
    -- Перевіряємо чи існує колонка manager_smtp_account_id в communications_conversations
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_conversations' 
        AND column_name = 'manager_smtp_account_id'
    ) THEN
        -- Перевіряємо чи існує constraint
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'fk_conversations_manager_smtp_account'
            AND table_name = 'communications_conversations'
        ) THEN
            -- Додаємо foreign key constraint
            ALTER TABLE communications_conversations
            ADD CONSTRAINT fk_conversations_manager_smtp_account
            FOREIGN KEY (manager_smtp_account_id) 
            REFERENCES manager_smtp_accounts(id) 
            ON DELETE SET NULL;
            
            RAISE NOTICE 'Foreign key constraint fk_conversations_manager_smtp_account додано';
        ELSE
            RAISE NOTICE 'Foreign key constraint fk_conversations_manager_smtp_account вже існує';
        END IF;
    END IF;
END $$;

-- Коментарі для документації
COMMENT ON TABLE manager_smtp_accounts IS 'SMTP акаунти менеджерів для підключення до inbox';
COMMENT ON COLUMN manager_smtp_accounts.email IS 'Email адреса менеджера';
COMMENT ON COLUMN manager_smtp_accounts.is_active IS 'Чи активний акаунт для автоматичного імпорту email';

