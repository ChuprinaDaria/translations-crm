-- Міграція: Додавання поля active_payment_provider до таблиці payment_settings
-- Додає поле для вибору активної системи оплати (stripe або przelewy24)

-- Додаємо поле active_payment_provider
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_settings' 
        AND column_name = 'active_payment_provider'
    ) THEN
        ALTER TABLE payment_settings 
        ADD COLUMN active_payment_provider VARCHAR(20);
        
        -- Створюємо індекс для швидкого пошуку
        CREATE INDEX IF NOT EXISTS idx_payment_settings_active_provider 
        ON payment_settings(active_payment_provider);
    END IF;
END $$;

-- Автоматично встановити активну систему на основі enabled статусів
-- Якщо stripe_enabled = true і є stripe_secret_key → stripe
-- Якщо przelewy24_enabled = true і є przelewy24_merchant_id → przelewy24
UPDATE payment_settings
SET active_payment_provider = CASE
    WHEN stripe_enabled = true AND stripe_secret_key IS NOT NULL AND stripe_secret_key != '' THEN 'stripe'
    WHEN przelewy24_enabled = true AND przelewy24_merchant_id IS NOT NULL THEN 'przelewy24'
    ELSE NULL
END
WHERE active_payment_provider IS NULL;

