-- Міграція: Додавання поля is_from_me до таблиці communications_messages
-- Це поле використовується для розрізнення повідомлень "від мене" та "від клієнта"
-- Особливо важливо для Instagram, де потрібно розрізняти повідомлення на основі IGSID

-- Додаємо поле is_from_me до таблиці communications_messages
DO $$
BEGIN
    -- Додаємо is_from_me (nullable Boolean для сумісності з існуючими записами)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_messages' 
        AND column_name = 'is_from_me'
    ) THEN
        ALTER TABLE communications_messages 
        ADD COLUMN is_from_me BOOLEAN;
        
        -- Створюємо індекс для швидкого пошуку
        CREATE INDEX IF NOT EXISTS idx_messages_is_from_me 
        ON communications_messages(is_from_me);
        
        -- Коментар до колонки
        COMMENT ON COLUMN communications_messages.is_from_me IS 
        'Вказує, чи повідомлення відправлено від нас (true) або від клієнта (false). NULL для старих записів.';
    END IF;
END $$;

