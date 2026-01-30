-- Migration: Add external_id to communications_messages
-- Created: 2026-01-22
-- Purpose: Store unique external message IDs (Message-ID for email, message_id for Telegram/WhatsApp) to prevent duplicates

-- Додаємо поле для зберігання унікального ID з email (Message-ID header) або з інших платформ
DO $$
BEGIN
    -- Додаємо поле external_id якщо його ще немає
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_messages' 
        AND column_name = 'external_id'
    ) THEN
        ALTER TABLE communications_messages 
        ADD COLUMN external_id VARCHAR(500);
        
        -- Додаємо індекс для швидкого пошуку
        CREATE INDEX IF NOT EXISTS ix_messages_external_id 
        ON communications_messages(external_id);
        
        -- Додаємо коментар
        COMMENT ON COLUMN communications_messages.external_id IS 'Унікальний ID повідомлення з зовнішньої платформи (Message-ID для email, message_id для Telegram/WhatsApp)';
    END IF;
END $$;

