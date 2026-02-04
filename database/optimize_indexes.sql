-- =============================================================
-- SQL скрипт для оптимізації індексів бази даних CRM
-- Запустити на production сервері для прискорення запитів
-- =============================================================

-- Індекс для швидкого отримання повідомлень розмови (сортування за датою)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_at 
ON communications_messages(conversation_id, created_at DESC);

-- Індекс для підрахунку непрочитаних повідомлень
CREATE INDEX IF NOT EXISTS idx_messages_conversation_status_direction 
ON communications_messages(conversation_id, status, direction);

-- Індекс для пошуку вкладень за повідомленням
CREATE INDEX IF NOT EXISTS idx_attachments_message_id 
ON communications_attachments(message_id);

-- Індекс для фільтрації розмов за платформою та архівом
CREATE INDEX IF NOT EXISTS idx_conversations_platform_archived 
ON communications_conversations(platform, is_archived);

-- Індекс для сортування розмов за останнім повідомленням
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at 
ON communications_conversations(last_message_at DESC NULLS LAST);

-- Індекс для пошуку розмов за external_id
CREATE INDEX IF NOT EXISTS idx_conversations_external_id 
ON communications_conversations(external_id);

-- Композитний індекс для inbox запиту
CREATE INDEX IF NOT EXISTS idx_conversations_inbox 
ON communications_conversations(is_archived, last_message_at DESC NULLS LAST, platform);

-- Індекс для пошуку клієнтів за ім'ям (для search в inbox)
CREATE INDEX IF NOT EXISTS idx_clients_name_search 
ON crm_clients USING gin(name gin_trgm_ops);

-- Індекс для пошуку клієнтів за full_name
CREATE INDEX IF NOT EXISTS idx_clients_fullname_search 
ON crm_clients USING gin(full_name gin_trgm_ops);

-- Індекс для autobot налаштувань
CREATE INDEX IF NOT EXISTS idx_autobot_settings_office 
ON autobot_settings(office_id);

-- Індекс для AI налаштувань
CREATE INDEX IF NOT EXISTS idx_ai_settings_enabled 
ON ai_settings(is_enabled);

-- =============================================================
-- Аналіз таблиць для оптимізації планувальника запитів
-- =============================================================

ANALYZE communications_conversations;
ANALYZE communications_messages;
ANALYZE communications_attachments;
ANALYZE crm_clients;
ANALYZE autobot_settings;
ANALYZE ai_settings;

-- =============================================================
-- Перевірка створених індексів
-- =============================================================

SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes 
WHERE tablename IN (
    'communications_conversations', 
    'communications_messages', 
    'communications_attachments',
    'crm_clients',
    'autobot_settings',
    'ai_settings'
)
ORDER BY tablename, indexname;

