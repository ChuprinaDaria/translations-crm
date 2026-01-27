-- Міграція: Створення таблиці manager_smtp_accounts
-- Ця таблиця зберігає SMTP акаунти менеджерів для підключення до inbox

-- Створюємо таблицю
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

-- Створюємо індекси
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manager_smtp_accounts') THEN
        CREATE INDEX IF NOT EXISTS idx_manager_smtp_accounts_name ON manager_smtp_accounts(name);
        CREATE INDEX IF NOT EXISTS idx_manager_smtp_accounts_email ON manager_smtp_accounts(email);
        CREATE INDEX IF NOT EXISTS idx_manager_smtp_accounts_is_active ON manager_smtp_accounts(is_active);
    END IF;
END $$;

