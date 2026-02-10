-- Міграція: Створення таблиці whatsapp_accounts
-- Ця таблиця зберігає підключені WhatsApp телефонні номери

-- Створюємо таблицю
CREATE TABLE IF NOT EXISTS whatsapp_accounts (
    id SERIAL PRIMARY KEY,
    phone_number_id VARCHAR NOT NULL UNIQUE,
    phone_number VARCHAR,
    name VARCHAR,
    waba_id VARCHAR,
    page_id VARCHAR,
    page_name VARCHAR,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Створюємо індекси
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'whatsapp_accounts') THEN
        CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_phone_number_id ON whatsapp_accounts(phone_number_id);
        CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_phone_number ON whatsapp_accounts(phone_number);
        CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_waba_id ON whatsapp_accounts(waba_id);
        CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_is_active ON whatsapp_accounts(is_active);
    END IF;
END $$;

