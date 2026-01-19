-- Міграція: Створення таблиці telegram_accounts
-- Ця таблиця зберігає Telegram акаунти для відправки КП

-- Створюємо таблицю
CREATE TABLE IF NOT EXISTS telegram_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    phone VARCHAR,
    session_string VARCHAR NOT NULL,
    api_id INTEGER,
    api_hash VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Створюємо індекси (тільки якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'telegram_accounts') THEN
        CREATE INDEX IF NOT EXISTS idx_telegram_accounts_name ON telegram_accounts(name);
        CREATE INDEX IF NOT EXISTS idx_telegram_accounts_phone ON telegram_accounts(phone);
        CREATE INDEX IF NOT EXISTS idx_telegram_accounts_is_active ON telegram_accounts(is_active);
    END IF;
END $$;

