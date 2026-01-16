-- migrations_clients.sql

-- Таблиця клієнтів
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company_name VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    total_orders INTEGER DEFAULT 0,
    total_spent NUMERIC(10, 2) DEFAULT 0,
    cashback_balance NUMERIC(10, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- Таблиця анкет
CREATE TABLE IF NOT EXISTS client_questionnaires (
    id SERIAL PRIMARY KEY,
    client_id INTEGER UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Сервіс
    event_date DATE,
    location VARCHAR(500),
    contact_person VARCHAR(255),
    contact_phone VARCHAR(50),
    on_site_contact VARCHAR(255),
    on_site_phone VARCHAR(50),
    arrival_time VARCHAR(50),
    event_start_time VARCHAR(50),
    event_end_time VARCHAR(50),
    service_type_timing TEXT,
    additional_services_timing TEXT,
    equipment_notes TEXT,
    payment_method VARCHAR(100),
    textile_color VARCHAR(100),
    banquet_line_color VARCHAR(100),
    
    -- Заїзд
    venue_complexity VARCHAR(100),
    floor_number VARCHAR(50),
    elevator_available BOOLEAN DEFAULT FALSE,
    technical_room VARCHAR(255),
    kitchen_available VARCHAR(255),
    venue_photos BOOLEAN DEFAULT FALSE,
    arrival_photos BOOLEAN DEFAULT FALSE,
    
    -- Кухня
    dish_serving VARCHAR(255),
    hot_snacks_serving VARCHAR(255),
    salad_serving VARCHAR(255),
    product_allergy VARCHAR(255),
    vegetarians BOOLEAN DEFAULT FALSE,
    hot_snacks_prep VARCHAR(255),
    menu_notes TEXT,
    client_order_notes TEXT,
    client_drinks_notes TEXT,
    
    -- Контент
    photo_allowed VARCHAR(100),
    video_allowed VARCHAR(100),
    branded_products VARCHAR(100),
    
    -- Замовник
    client_company_name VARCHAR(255),
    client_activity_type VARCHAR(255),
    
    -- Коментарі
    special_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Додати client_id до KP (якщо колонка ще не існує)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kps' AND column_name = 'client_id') THEN
        ALTER TABLE kps ADD COLUMN client_id INTEGER REFERENCES clients(id);
    END IF;
END $$;

-- Додати нові поля для знижок та кешбеку до KP
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kps' AND column_name = 'discount_type') THEN
        ALTER TABLE kps ADD COLUMN discount_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kps' AND column_name = 'discount_value') THEN
        ALTER TABLE kps ADD COLUMN discount_value NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kps' AND column_name = 'discount_reason') THEN
        ALTER TABLE kps ADD COLUMN discount_reason VARCHAR(255);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kps' AND column_name = 'cashback_earned') THEN
        ALTER TABLE kps ADD COLUMN cashback_earned NUMERIC(10, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'kps' AND column_name = 'cashback_used') THEN
        ALTER TABLE kps ADD COLUMN cashback_used NUMERIC(10, 2) DEFAULT 0;
    END IF;
END $$;

-- Індекси
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_kp_client_id ON kps(client_id);

