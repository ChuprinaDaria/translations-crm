-- ============================================
-- Міграція: Додавання нових полів до таблиць
-- Дата: 2025-12-03
-- ============================================

-- 1. Таблиця `users` - додавання полів для імені, прізвища та відділу
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR NULL,
ADD COLUMN IF NOT EXISTS last_name VARCHAR NULL,
ADD COLUMN IF NOT EXISTS department VARCHAR NULL;

-- 2. Таблиця `templates` - додавання полів для зображень шапки та фону
ALTER TABLE templates 
ADD COLUMN IF NOT EXISTS header_image_url VARCHAR NULL,
ADD COLUMN IF NOT EXISTS background_image_url VARCHAR NULL;

-- 3. Таблиця `kps` - додавання полів для даних клієнта, заходу та менеджера
ALTER TABLE kps 
ADD COLUMN IF NOT EXISTS client_name VARCHAR NULL,
ADD COLUMN IF NOT EXISTS event_format VARCHAR NULL,
ADD COLUMN IF NOT EXISTS event_group VARCHAR NULL,
ADD COLUMN IF NOT EXISTS event_date TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS event_location VARCHAR NULL,
ADD COLUMN IF NOT EXISTS event_time VARCHAR NULL,
ADD COLUMN IF NOT EXISTS coordinator_name VARCHAR NULL,
ADD COLUMN IF NOT EXISTS coordinator_phone VARCHAR NULL,
ADD COLUMN IF NOT EXISTS created_by_id INTEGER NULL,
ADD COLUMN IF NOT EXISTS equipment_total DOUBLE PRECISION NULL,
ADD COLUMN IF NOT EXISTS service_total DOUBLE PRECISION NULL,
ADD COLUMN IF NOT EXISTS transport_total DOUBLE PRECISION NULL;

-- Додавання індексів для нових полів (якщо потрібно)
CREATE INDEX IF NOT EXISTS idx_kps_client_name ON kps(client_name);
CREATE INDEX IF NOT EXISTS idx_kps_created_by_id ON kps(created_by_id);

-- Додавання foreign key для created_by_id (якщо ще не існує)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kps_created_by_id_fkey'
    ) THEN
        ALTER TABLE kps 
        ADD CONSTRAINT kps_created_by_id_fkey 
        FOREIGN KEY (created_by_id) REFERENCES users(id);
    END IF;
END $$;

-- 4. Створення таблиці `clients` (якщо не існує)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    phone VARCHAR NULL,
    email VARCHAR NULL,
    status VARCHAR DEFAULT 'новий' NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NULL,
    event_format VARCHAR NULL,
    event_group VARCHAR NULL,
    event_time VARCHAR NULL,
    event_location VARCHAR NULL,
    comments TEXT NULL,
    kp_total_amount DOUBLE PRECISION NULL,
    paid_amount DOUBLE PRECISION NULL,
    unpaid_amount DOUBLE PRECISION NULL,
    payment_format VARCHAR NULL,
    cash_collector VARCHAR NULL,
    payment_plan_date TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NULL
);

-- Індекси для таблиці `clients`
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);

-- 5. Створення таблиці `menus` (якщо не існує)
CREATE TABLE IF NOT EXISTS menus (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description VARCHAR NULL,
    event_format VARCHAR NULL,
    people_count INTEGER NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_menus_name ON menus(name);

-- 6. Створення таблиці `menu_items` (якщо не існує)
CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    menu_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    CONSTRAINT menu_items_menu_id_fkey FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
    CONSTRAINT menu_items_item_id_fkey FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_item_id ON menu_items(item_id);

-- ============================================
-- Перевірка: після виконання перевірте структуру таблиць
-- ============================================

