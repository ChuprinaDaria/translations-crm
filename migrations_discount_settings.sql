-- Міграція для додавання полів налаштувань знижки в таблицю kps
-- Виконати цей скрипт для додавання нових полів

ALTER TABLE kps 
ADD COLUMN IF NOT EXISTS discount_include_menu BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS discount_include_equipment BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS discount_include_service BOOLEAN DEFAULT FALSE NOT NULL;

-- Оновлюємо існуючі записи, щоб мати значення за замовчуванням
UPDATE kps 
SET 
    discount_include_menu = TRUE,
    discount_include_equipment = FALSE,
    discount_include_service = FALSE
WHERE discount_include_menu IS NULL OR discount_include_equipment IS NULL OR discount_include_service IS NULL;

