-- Міграція для додавання поля use_ai_reply до таблиці autobot_settings
-- Дозволяє переключити autobot на використання AI для генерації відповідей

-- Додати поле use_ai_reply
ALTER TABLE autobot_settings 
ADD COLUMN IF NOT EXISTS use_ai_reply BOOLEAN NOT NULL DEFAULT FALSE;

-- Додати коментар
COMMENT ON COLUMN autobot_settings.use_ai_reply IS 'Використовувати AI для генерації відповідей замість статичного повідомлення';

