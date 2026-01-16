-- ============================================
-- Міграція: Додавання системи знижок та кешбеку
-- Дата: 2025-12-03
-- ============================================

-- 1. Створення таблиці `benefits` (рівні знижок та кешбеку)
CREATE TABLE IF NOT EXISTS benefits (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,  -- Назва рівня (напр. "Знижка 5%", "Кешбек 3%")
    type VARCHAR NOT NULL,  -- 'discount' або 'cashback'
    value DOUBLE PRECISION NOT NULL,  -- Значення у відсотках (напр. 5 для 5%)
    description VARCHAR NULL,  -- Опис
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_benefits_type ON benefits(type);
CREATE INDEX IF NOT EXISTS idx_benefits_is_active ON benefits(is_active);

-- 2. Додавання полів до таблиці `clients`
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS discount TEXT NULL,  -- Текст про знижки до КП (напр. "5% до КП #123")
ADD COLUMN IF NOT EXISTS cashback DOUBLE PRECISION DEFAULT 0 NOT NULL;  -- Сума всіх кешбеків з усіх КП

-- 3. Додавання полів до таблиці `kps`
ALTER TABLE kps 
ADD COLUMN IF NOT EXISTS discount_id INTEGER NULL,  -- ID рівня знижки
ADD COLUMN IF NOT EXISTS cashback_id INTEGER NULL,  -- ID рівня кешбеку
ADD COLUMN IF NOT EXISTS use_cashback BOOLEAN DEFAULT FALSE NOT NULL,  -- Чи списати кешбек з бонусного рахунку
ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION NULL,  -- Сума знижки
ADD COLUMN IF NOT EXISTS cashback_amount DOUBLE PRECISION NULL;  -- Сума кешбеку

-- Додавання foreign keys для benefits
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kps_discount_id_fkey'
    ) THEN
        ALTER TABLE kps 
        ADD CONSTRAINT kps_discount_id_fkey 
        FOREIGN KEY (discount_id) REFERENCES benefits(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'kps_cashback_id_fkey'
    ) THEN
        ALTER TABLE kps 
        ADD CONSTRAINT kps_cashback_id_fkey 
        FOREIGN KEY (cashback_id) REFERENCES benefits(id);
    END IF;
END $$;

-- Індекси для нових полів
CREATE INDEX IF NOT EXISTS idx_kps_discount_id ON kps(discount_id);
CREATE INDEX IF NOT EXISTS idx_kps_cashback_id ON kps(cashback_id);

-- ============================================
-- Перевірка: після виконання перевірте структуру таблиць
-- ============================================

