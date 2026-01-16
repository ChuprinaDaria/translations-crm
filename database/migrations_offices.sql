-- migrations_offices.sql
-- Таблиця для офісів видачі замовлень

CREATE TABLE IF NOT EXISTS offices (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(500) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    working_hours VARCHAR(200) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Додаємо поле office_id до таблиці замовлень
ALTER TABLE crm_orders 
ADD COLUMN IF NOT EXISTS office_id INTEGER REFERENCES offices(id) ON DELETE SET NULL;

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_offices_is_active ON offices(is_active);
CREATE INDEX IF NOT EXISTS idx_offices_is_default ON offices(is_default);
CREATE INDEX IF NOT EXISTS idx_offices_city ON offices(city);
CREATE INDEX IF NOT EXISTS idx_crm_orders_office_id ON crm_orders(office_id);

-- Коментарі для документації
COMMENT ON TABLE offices IS 'Офіси видачі замовлень';
COMMENT ON COLUMN offices.is_default IS 'Офіс за замовчуванням (використовується якщо не вказано office_id)';
COMMENT ON COLUMN crm_orders.office_id IS 'Офіс видачі замовлення';

