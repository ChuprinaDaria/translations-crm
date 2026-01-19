-- Міграція: Додавання полів api_id та api_hash до таблиці telegram_accounts
-- Це дозволяє кожному Telegram акаунту мати власні API credentials
-- для підтримки до 10+ особистих акаунтів з різними api_id/api_hash

-- Додаємо поле api_id (Integer, nullable)
ALTER TABLE telegram_accounts ADD COLUMN api_id INTEGER;

-- Додаємо поле api_hash (String, nullable)
ALTER TABLE telegram_accounts ADD COLUMN api_hash VARCHAR;

-- Коментарі для документації
-- Якщо api_id та api_hash не вказані (NULL), система використовує глобальні налаштування
-- з таблиці app_settings (telegram_api_id, telegram_api_hash)
-- Це дозволяє сумісність зі старими акаунтами та гнучкість налаштування

