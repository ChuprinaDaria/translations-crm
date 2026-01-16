-- Міграція для кастомізації структури шаблонів КП
-- Дата: 2024-12-04

-- Додаємо поля для налаштування відображення колонок у таблиці меню
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_item_photo BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_item_weight BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_item_quantity BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_item_price BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_item_total BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_item_description BOOLEAN DEFAULT FALSE;

-- Додаємо поля для налаштування підсумкових блоків
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_weight_summary BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_weight_per_person BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_discount_block BOOLEAN DEFAULT FALSE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_equipment_block BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_service_block BOOLEAN DEFAULT TRUE;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS show_transport_block BOOLEAN DEFAULT TRUE;

-- Додаємо секції меню (JSON масив категорій)
ALTER TABLE templates ADD COLUMN IF NOT EXISTS menu_sections JSON;

-- Додаємо текстові налаштування
ALTER TABLE templates ADD COLUMN IF NOT EXISTS menu_title VARCHAR(255) DEFAULT 'Меню';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS summary_title VARCHAR(255) DEFAULT 'Підсумок';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS footer_text TEXT;

-- Додаємо layout налаштування
ALTER TABLE templates ADD COLUMN IF NOT EXISTS page_orientation VARCHAR(20) DEFAULT 'portrait';
ALTER TABLE templates ADD COLUMN IF NOT EXISTS items_per_page INTEGER DEFAULT 20;

-- Встановлюємо дефолтні секції меню для існуючих шаблонів
UPDATE templates 
SET menu_sections = '["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"]'::json
WHERE menu_sections IS NULL;

-- Встановлюємо дефолтні заголовки для існуючих шаблонів
UPDATE templates 
SET menu_title = 'Меню'
WHERE menu_title IS NULL;

UPDATE templates 
SET summary_title = 'Підсумок'
WHERE summary_title IS NULL;

-- Коментар для перевірки виконання
SELECT 'Міграція template_customization виконана успішно' AS status;

