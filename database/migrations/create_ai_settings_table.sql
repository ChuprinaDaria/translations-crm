-- Міграція для створення таблиці налаштувань AI RAG інтеграції
-- Створює таблицю для зберігання конфігурації AI сервісу

-- Таблиця налаштувань AI
CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    
    -- API Configuration
    rag_api_url VARCHAR(500) NOT NULL DEFAULT 'https://api.adme-ai.com/v1',
    rag_api_key VARCHAR(255) DEFAULT '',
    
    -- Enable/Disable
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Configuration
    trigger_delay_seconds INTEGER NOT NULL DEFAULT 10,
    active_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    
    -- Webhook Security
    webhook_secret VARCHAR(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Індекси
CREATE INDEX IF NOT EXISTS idx_ai_settings_enabled ON ai_settings(is_enabled);

-- Коментарі
COMMENT ON TABLE ai_settings IS 'Налаштування AI RAG інтеграції';
COMMENT ON COLUMN ai_settings.rag_api_url IS 'URL RAG API сервісу';
COMMENT ON COLUMN ai_settings.rag_api_key IS 'API ключ для RAG сервісу (зберігається як plain text, можна зашифрувати)';
COMMENT ON COLUMN ai_settings.is_enabled IS 'Чи увімкнено AI інтеграцію';
COMMENT ON COLUMN ai_settings.trigger_delay_seconds IS 'Затримка в секундах перед відправкою запиту до AI (щоб дозволити менеджеру втрутитися)';
COMMENT ON COLUMN ai_settings.active_channels IS 'Активні канали для AI (telegram, whatsapp, email, instagram, facebook)';
COMMENT ON COLUMN ai_settings.webhook_secret IS 'Секретний ключ для верифікації webhook запитів від RAG сервісу';

