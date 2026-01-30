-- Міграція: Додавання полів для архівації діалогів
-- Додає поля:
--   - is_archived: BOOLEAN - чи діалог архівований
--   - last_message_at: TIMESTAMP - час останнього повідомлення для швидкої сортировки

-- Додаємо поле is_archived
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_conversations' 
        AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE communications_conversations 
        ADD COLUMN is_archived BOOLEAN DEFAULT FALSE NOT NULL;
        
        -- Створюємо індекс для швидкої фільтрації
        CREATE INDEX IF NOT EXISTS idx_conversations_is_archived 
        ON communications_conversations(is_archived);
    END IF;
END $$;

-- Додаємо поле last_message_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_conversations' 
        AND column_name = 'last_message_at'
    ) THEN
        ALTER TABLE communications_conversations 
        ADD COLUMN last_message_at TIMESTAMP WITH TIME ZONE;
        
        -- Створюємо індекс для швидкої сортировки
        CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
        ON communications_conversations(last_message_at DESC NULLS LAST);
    END IF;
END $$;

-- Заповнюємо last_message_at з існуючих даних
UPDATE communications_conversations c 
SET last_message_at = (
    SELECT MAX(created_at) 
    FROM communications_messages m 
    WHERE m.conversation_id = c.id
)
WHERE last_message_at IS NULL;

-- Архівуємо старі діалоги (старші 30 днів без нових повідомлень)
UPDATE communications_conversations 
SET is_archived = TRUE 
WHERE is_archived = FALSE 
AND last_message_at IS NOT NULL
AND last_message_at < NOW() - INTERVAL '30 days';

