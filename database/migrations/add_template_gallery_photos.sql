-- Міграція: додавання нових полів до таблиці templates
-- Дата: 2025-12-16

-- Галерея фото (до 9 фото)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS gallery_photos JSON;

-- Умови бронювання
ALTER TABLE templates ADD COLUMN IF NOT EXISTS booking_terms TEXT;

-- Кольори елементів PDF
ALTER TABLE templates ADD COLUMN IF NOT EXISTS format_bg_color VARCHAR(10);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS table_header_bg_color VARCHAR(10);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS category_bg_color VARCHAR(10);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS summary_bg_color VARCHAR(10);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS total_bg_color VARCHAR(10);

-- Коментарі
COMMENT ON COLUMN templates.gallery_photos IS 'Масив шляхів до фото галереї (до 9 фото, відображаються по 3 в рядок у PDF)';
COMMENT ON COLUMN templates.booking_terms IS 'Умови бронювання заходу (текст з пунктами, кожен з нового рядка)';
COMMENT ON COLUMN templates.format_bg_color IS 'Колір фону формату заходу (ФУРШЕТ 13:30-14:30)';
COMMENT ON COLUMN templates.table_header_bg_color IS 'Колір фону шапки таблиці';
COMMENT ON COLUMN templates.category_bg_color IS 'Колір фону категорій страв';
COMMENT ON COLUMN templates.summary_bg_color IS 'Колір фону підсумків (ДО СПЛАТИ ЗА...)';
COMMENT ON COLUMN templates.total_bg_color IS 'Колір фону ВСЬОГО ДО СПЛАТИ';

