-- Міграція для додавання нових полів до таблиці kps
-- Дата: 2025-12-15

-- Окремі знижки для кожної категорії
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_menu_id INTEGER REFERENCES benefits(id);
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_equipment_id INTEGER REFERENCES benefits(id);
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_service_id INTEGER REFERENCES benefits(id);

-- Знижки по підкатегоріях обладнання (JSON)
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_equipment_subcategories JSON;

-- Історія знижок для цього КП (нова система)
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50);
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS discount_reason VARCHAR(255);

-- Кешбек для цього КП (нова система)
ALTER TABLE kps ADD COLUMN IF NOT EXISTS cashback_earned NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS cashback_used NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS cashback_rate_applied NUMERIC(5, 2);

-- Загальна та фінальна сума
ALTER TABLE kps ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2) DEFAULT 0;

-- Умови бронювання та фото
ALTER TABLE kps ADD COLUMN IF NOT EXISTS booking_terms TEXT;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS gallery_photos JSON;

-- Таблиця чеклістів
CREATE TABLE IF NOT EXISTS checklists (
    id SERIAL PRIMARY KEY,
    checklist_type VARCHAR(20) NOT NULL,
    client_id INTEGER REFERENCES clients(id),
    kp_id INTEGER REFERENCES kps(id),
    manager_id INTEGER REFERENCES users(id),
    event_date DATE,
    contact_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(200),
    event_format VARCHAR(200),
    event_reason VARCHAR(300),
    order_number VARCHAR(100),
    delivery_time VARCHAR(100),
    event_duration VARCHAR(100),
    needs_courier BOOLEAN DEFAULT FALSE,
    personnel_notes TEXT,
    location_address VARCHAR(500),
    location_floor VARCHAR(50),
    location_elevator BOOLEAN DEFAULT FALSE,
    guest_count INTEGER,
    budget VARCHAR(200),
    budget_amount NUMERIC(10, 2),
    equipment_furniture BOOLEAN DEFAULT FALSE,
    equipment_tablecloths BOOLEAN DEFAULT FALSE,
    equipment_disposable_dishes BOOLEAN DEFAULT FALSE,
    equipment_glass_dishes BOOLEAN DEFAULT FALSE,
    equipment_notes TEXT,
    food_hot BOOLEAN DEFAULT FALSE,
    food_cold BOOLEAN DEFAULT FALSE,
    food_salads BOOLEAN DEFAULT FALSE,
    food_garnish BOOLEAN DEFAULT FALSE,
    food_sweet BOOLEAN DEFAULT FALSE,
    food_vegetarian BOOLEAN DEFAULT FALSE,
    food_vegan BOOLEAN DEFAULT FALSE,
    food_preference VARCHAR(100),
    food_notes TEXT,
    general_comment TEXT,
    drinks_notes TEXT,
    alcohol_notes TEXT,
    discount_notes TEXT,
    surcharge_notes TEXT,
    status VARCHAR(50) DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Індекси для чеклістів
CREATE INDEX IF NOT EXISTS idx_checklists_type ON checklists(checklist_type);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON checklists(status);
CREATE INDEX IF NOT EXISTS idx_checklists_client_id ON checklists(client_id);
CREATE INDEX IF NOT EXISTS idx_checklists_manager_id ON checklists(manager_id);

