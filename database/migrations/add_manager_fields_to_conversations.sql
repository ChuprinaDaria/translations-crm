-- Міграція: Додавання полів для закріплення менеджерів та SMTP акаунтів до conversations
-- Додає поля:
--   - manager_smtp_account_id: зв'язок з менеджерським SMTP акаунтом
--   - assigned_manager_id: ID менеджера, який закріплений за розмовою
--   - last_manager_response_at: час останньої відповіді менеджера

-- Додаємо поля до таблиці communications_conversations
DO $$
BEGIN
    -- Додаємо manager_smtp_account_id (зв'язок з менеджерським SMTP акаунтом)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_conversations' 
        AND column_name = 'manager_smtp_account_id'
    ) THEN
        ALTER TABLE communications_conversations 
        ADD COLUMN manager_smtp_account_id INTEGER;
        
        -- Додаємо foreign key якщо таблиця manager_smtp_accounts існує
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manager_smtp_accounts') THEN
            ALTER TABLE communications_conversations
            ADD CONSTRAINT fk_conversations_manager_smtp_account
            FOREIGN KEY (manager_smtp_account_id) 
            REFERENCES manager_smtp_accounts(id) 
            ON DELETE SET NULL;
        END IF;
        
        -- Створюємо індекс
        CREATE INDEX IF NOT EXISTS idx_conversations_manager_smtp_account_id 
        ON communications_conversations(manager_smtp_account_id);
    END IF;

    -- Додаємо assigned_manager_id (ID менеджера, закріпленого за розмовою)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_conversations' 
        AND column_name = 'assigned_manager_id'
    ) THEN
        ALTER TABLE communications_conversations 
        ADD COLUMN assigned_manager_id UUID;
        
        -- Додаємо foreign key якщо таблиця users існує
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
            ALTER TABLE communications_conversations
            ADD CONSTRAINT fk_conversations_assigned_manager
            FOREIGN KEY (assigned_manager_id) 
            REFERENCES users(id) 
            ON DELETE SET NULL;
        END IF;
        
        -- Створюємо індекс
        CREATE INDEX IF NOT EXISTS idx_conversations_assigned_manager_id 
        ON communications_conversations(assigned_manager_id);
    END IF;

    -- Додаємо last_manager_response_at (час останньої відповіді менеджера)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'communications_conversations' 
        AND column_name = 'last_manager_response_at'
    ) THEN
        ALTER TABLE communications_conversations 
        ADD COLUMN last_manager_response_at TIMESTAMP WITH TIME ZONE;
        
        -- Створюємо індекс
        CREATE INDEX IF NOT EXISTS idx_conversations_last_manager_response_at 
        ON communications_conversations(last_manager_response_at);
    END IF;
END $$;

