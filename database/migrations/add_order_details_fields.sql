-- Migration: Add language, translation_type, payment_method to crm_orders
-- Date: 2026-01-22

-- Додаємо поле для мови перекладу
ALTER TABLE crm_orders 
ADD COLUMN IF NOT EXISTS language VARCHAR(10);

-- Додаємо поле для типу перекладу
ALTER TABLE crm_orders 
ADD COLUMN IF NOT EXISTS translation_type VARCHAR(20);

-- Додаємо поле для способу оплати (cash, card, transfer, none)
ALTER TABLE crm_orders 
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'none';

-- Коментарі до полів
COMMENT ON COLUMN crm_orders.language IS 'Мова перекладу (uk-pl, pl-uk, etc.)';
COMMENT ON COLUMN crm_orders.translation_type IS 'Тип перекладу (zwykle, przysiegle, ustne, ekspresowe)';
COMMENT ON COLUMN crm_orders.payment_method IS 'Спосіб оплати (cash=готівка, card=картка, transfer=переказ, none=не оплачено)';

