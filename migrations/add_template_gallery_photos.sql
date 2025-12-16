-- Міграція: додавання поля gallery_photos до таблиці templates
-- Дата: 2025-12-16

-- Додаємо колонку для галереї фото (до 9 фото)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS gallery_photos JSON;

-- Коментар
COMMENT ON COLUMN templates.gallery_photos IS 'Масив шляхів до фото галереї (до 9 фото, відображаються по 3 в рядок у PDF)';

