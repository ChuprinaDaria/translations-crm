-- Міграція: збільшення розмірів полів в client_questionnaires та додавання JSON полів для фото
-- Дата: 2025-12-04

-- СЕРВІС
ALTER TABLE client_questionnaires 
    ALTER COLUMN location TYPE VARCHAR(500),
    ALTER COLUMN contact_person TYPE VARCHAR(200),
    ALTER COLUMN contact_phone TYPE VARCHAR(50),
    ALTER COLUMN on_site_contact TYPE VARCHAR(200),
    ALTER COLUMN on_site_phone TYPE VARCHAR(50),
    ALTER COLUMN arrival_time TYPE TEXT,
    ALTER COLUMN event_start_time TYPE VARCHAR(50),
    ALTER COLUMN event_end_time TYPE VARCHAR(50),
    ALTER COLUMN payment_method TYPE VARCHAR(200),
    ALTER COLUMN textile_color TYPE VARCHAR(100),
    ALTER COLUMN banquet_line_color TYPE VARCHAR(200);

-- ЗАЇЗД
ALTER TABLE client_questionnaires 
    ALTER COLUMN venue_complexity TYPE VARCHAR(200),
    ALTER COLUMN floor_number TYPE VARCHAR(100),
    ALTER COLUMN technical_room TYPE VARCHAR(200),
    ALTER COLUMN kitchen_available TYPE VARCHAR(200);

-- Додаємо нові поля для збереження URL фото
ALTER TABLE client_questionnaires 
    ADD COLUMN IF NOT EXISTS venue_photos_urls JSONB,
    ADD COLUMN IF NOT EXISTS arrival_photos_urls JSONB;

-- КУХНЯ
ALTER TABLE client_questionnaires 
    ALTER COLUMN dish_serving TYPE VARCHAR(200),
    ALTER COLUMN hot_snacks_serving TYPE VARCHAR(200),
    ALTER COLUMN salad_serving TYPE VARCHAR(200),
    ALTER COLUMN product_allergy TYPE VARCHAR(200),
    ALTER COLUMN hot_snacks_prep TYPE VARCHAR(200);

-- КОНТЕНТ
ALTER TABLE client_questionnaires 
    ALTER COLUMN photo_allowed TYPE VARCHAR(200),
    ALTER COLUMN video_allowed TYPE VARCHAR(200),
    ALTER COLUMN branded_products TYPE VARCHAR(200);

-- ЗАМОВНИК
ALTER TABLE client_questionnaires 
    ALTER COLUMN client_company_name TYPE VARCHAR(300),
    ALTER COLUMN client_activity_type TYPE VARCHAR(300);

-- Коментар до міграції
COMMENT ON TABLE client_questionnaires IS 'Оновлено розміри полів для підтримки довгих текстів та додано поля для URL фото';

