-- Міграція: додавання полів шрифтів та заголовка до таблиці templates
-- Дата: 2025-12-16

-- Заголовок КП
ALTER TABLE templates ADD COLUMN IF NOT EXISTS title_text VARCHAR(255) DEFAULT 'КОМЕРЦІЙНА ПРОПОЗИЦІЯ';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS company_name VARCHAR(255) DEFAULT 'ДЗИҐА КЕЙТЕРІНҐ';

-- Шрифти для різних елементів
ALTER TABLE templates ADD COLUMN IF NOT EXISTS title_font VARCHAR(100);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS header_font VARCHAR(100);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS body_font VARCHAR(100);
ALTER TABLE templates ADD COLUMN IF NOT EXISTS table_font VARCHAR(100);

-- Коментарі
COMMENT ON COLUMN templates.title_text IS 'Текст заголовка КП (напр. КОМЕРЦІЙНА ПРОПОЗИЦІЯ)';
COMMENT ON COLUMN templates.company_name IS 'Назва компанії в заголовку (напр. ДЗИҐА КЕЙТЕРІНҐ)';
COMMENT ON COLUMN templates.title_font IS 'Шрифт для заголовка КП';
COMMENT ON COLUMN templates.header_font IS 'Шрифт для заголовків секцій (ФУРШЕТ, ОБЛАДНАННЯ...)';
COMMENT ON COLUMN templates.body_font IS 'Шрифт для основного тексту';
COMMENT ON COLUMN templates.table_font IS 'Шрифт для таблиці меню';

