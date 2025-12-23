-- Додавання поля phone в таблицю users для зберігання телефону менеджера
-- Це поле використовується для відображення контактів менеджера в шапці КП

ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR NULL;

-- Коментар для поля
COMMENT ON COLUMN users.phone IS 'Телефон менеджера для відображення в шапці комерційної пропозиції';

