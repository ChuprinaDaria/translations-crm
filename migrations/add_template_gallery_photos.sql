-- Міграція: додавання полів gallery_photos та booking_terms до таблиці templates
-- Дата: 2025-12-16

-- Додаємо колонку для галереї фото (до 9 фото)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS gallery_photos JSON;

-- Додаємо колонку для умов бронювання
ALTER TABLE templates ADD COLUMN IF NOT EXISTS booking_terms TEXT;

-- Коментарі
COMMENT ON COLUMN templates.gallery_photos IS 'Масив шляхів до фото галереї (до 9 фото, відображаються по 3 в рядок у PDF)';
COMMENT ON COLUMN templates.booking_terms IS 'Умови бронювання заходу (текст з пунктами, кожен з нового рядка)';

