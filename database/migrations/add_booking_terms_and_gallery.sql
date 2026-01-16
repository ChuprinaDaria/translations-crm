-- Міграція: додавання полів booking_terms та gallery_photos до таблиці kps
-- Дата: 2025-12-15

-- Додаємо колонку для умов бронювання
ALTER TABLE kps ADD COLUMN IF NOT EXISTS booking_terms TEXT;

-- Додаємо колонку для галереї фото (до 9 фото)
ALTER TABLE kps ADD COLUMN IF NOT EXISTS gallery_photos JSON;

-- Коментарі
COMMENT ON COLUMN kps.booking_terms IS 'Умови бронювання заходу (текст)';
COMMENT ON COLUMN kps.gallery_photos IS 'Масив шляхів до фото галереї (до 9 фото, відображаються по 3 в рядок)';

