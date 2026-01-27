-- Migration: Add CSV fields to orders table
-- Date: 2026-01-22
-- Description: Adds fields from CSV structure: price_netto, price_brutto, reference_code, repertorium_number, follow_up_date

-- Додаємо нові поля в таблицю замовлень
ALTER TABLE crm_orders 
ADD COLUMN IF NOT EXISTS price_netto NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS price_brutto NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS reference_code VARCHAR(100),
ADD COLUMN IF NOT EXISTS repertorium_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS order_source VARCHAR(100); -- Zrodlo (WhatsApp, Email, Formularz kontaktowy)

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_orders_reference_code ON crm_orders(reference_code);
CREATE INDEX IF NOT EXISTS idx_orders_repertorium_number ON crm_orders(repertorium_number);
CREATE INDEX IF NOT EXISTS idx_orders_follow_up_date ON crm_orders(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_orders_source ON crm_orders(order_source);

-- Коментарі для документації
COMMENT ON COLUMN crm_orders.price_netto IS 'Ціна нетто замовлення';
COMMENT ON COLUMN crm_orders.price_brutto IS 'Ціна брутто замовлення';
COMMENT ON COLUMN crm_orders.reference_code IS 'Код референційний (Kod_ref)';
COMMENT ON COLUMN crm_orders.repertorium_number IS 'Номер реперторію (Nr_repertorium)';
COMMENT ON COLUMN crm_orders.follow_up_date IS 'Дата повторного контакту (Ponowny_kontakt)';
COMMENT ON COLUMN crm_orders.order_source IS 'Джерело замовлення (Zrodlo: WhatsApp, Email, Formularz kontaktowy)';

