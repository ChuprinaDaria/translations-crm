-- Міграція для створення таблиць модуля Auto-Reply Bot
-- Створює таблиці для налаштувань автобота, свят та логів

-- Таблиця налаштувань автобота для офісів
CREATE TABLE IF NOT EXISTS autobot_settings (
    id SERIAL PRIMARY KEY,
    office_id INTEGER NOT NULL UNIQUE REFERENCES offices(id) ON DELETE CASCADE,
    
    -- Робочі години
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    monday_start TIME,
    monday_end TIME,
    tuesday_start TIME,
    tuesday_end TIME,
    wednesday_start TIME,
    wednesday_end TIME,
    thursday_start TIME,
    thursday_end TIME,
    friday_start TIME,
    friday_end TIME,
    saturday_start TIME,
    saturday_end TIME,
    sunday_start TIME,
    sunday_end TIME,
    
    -- Повідомлення бота
    auto_reply_message TEXT NOT NULL DEFAULT 'Добрий день! 👋

Це Бюро перекладів MT.

На жаль, зараз неробочий час, але ви можете:
- Написати ваше питання тут
- Відправити документ для перевірки

Наш менеджер зв''яжеться з вами в робочий час.

З цінами наших послуг ви можете ознайомитися на нашому сайті:
https://www.tlumaczeniamt.pl/cennik/

Для точної оцінки вартості, будь ласка, надішліть якісні фото або скани усіх сторінок документа.

Гарного дня! ☀️',
    
    -- Додаткові налаштування
    auto_create_client BOOLEAN NOT NULL DEFAULT TRUE,
    auto_create_order BOOLEAN NOT NULL DEFAULT TRUE,
    auto_save_files BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця свят та неробочих днів
CREATE TABLE IF NOT EXISTS autobot_holidays (
    id SERIAL PRIMARY KEY,
    settings_id INTEGER NOT NULL REFERENCES autobot_settings(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця логів роботи бота
CREATE TABLE IF NOT EXISTS autobot_logs (
    id SERIAL PRIMARY KEY,
    settings_id INTEGER NOT NULL REFERENCES autobot_settings(id) ON DELETE CASCADE,
    office_id INTEGER NOT NULL REFERENCES offices(id) ON DELETE CASCADE,
    
    -- Деталі
    message_id VARCHAR(255),
    client_id UUID REFERENCES crm_clients(id) ON DELETE SET NULL,
    order_id UUID REFERENCES crm_orders(id) ON DELETE SET NULL,
    
    -- Дії
    action_taken VARCHAR(100) NOT NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    
    -- Метадані
    meta_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_autobot_settings_office_id ON autobot_settings(office_id);
CREATE INDEX IF NOT EXISTS idx_autobot_holidays_settings_id ON autobot_holidays(settings_id);
CREATE INDEX IF NOT EXISTS idx_autobot_holidays_date ON autobot_holidays(date);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_settings_id ON autobot_logs(settings_id);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_office_id ON autobot_logs(office_id);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_message_id ON autobot_logs(message_id);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_client_id ON autobot_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_order_id ON autobot_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_created_at ON autobot_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_autobot_logs_action_taken ON autobot_logs(action_taken);

-- Коментарі для документації
COMMENT ON TABLE autobot_settings IS 'Налаштування автобота для офісів';
COMMENT ON TABLE autobot_holidays IS 'Свята та неробочі дні для автобота';
COMMENT ON TABLE autobot_logs IS 'Логи роботи автобота';

