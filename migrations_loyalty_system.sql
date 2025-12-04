-- migrations_loyalty_system.sql
-- Система лояльності з рівнями кешбеку

-- Оновлення таблиці clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS lifetime_spent NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS current_year_spent NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cashback_earned_total NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cashback_used_total NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cashback_expires_at DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_tier VARCHAR(50) DEFAULT 'silver';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cashback_rate NUMERIC(5, 2) DEFAULT 3.0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_custom_rate BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS yearly_photographer_used BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS yearly_robot_used BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS bonus_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);

-- Оновлення таблиці KP
ALTER TABLE kps ADD COLUMN IF NOT EXISTS menu_total NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE kps ADD COLUMN IF NOT EXISTS cashback_rate_applied NUMERIC(5, 2);

-- Таблиця транзакцій кешбеку
CREATE TABLE IF NOT EXISTS cashback_transactions (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    kp_id INTEGER REFERENCES kps(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    balance_after NUMERIC(10, 2) NOT NULL,
    description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cashback_client ON cashback_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_cashback_kp ON cashback_transactions(kp_id);

-- Встановити дату згоряння кешбеку для існуючих клієнтів
UPDATE clients 
SET cashback_expires_at = DATE(EXTRACT(YEAR FROM CURRENT_DATE) || '-12-31')
WHERE cashback_expires_at IS NULL;
