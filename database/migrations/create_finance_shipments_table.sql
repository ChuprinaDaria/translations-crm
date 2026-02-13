-- Migration: Create finance_shipments table
-- Date: 2026-01-22
-- Description: Creates table for tracking shipments (deliveries) - universal model for different delivery methods

-- Створюємо таблицю відправок
CREATE TABLE IF NOT EXISTS finance_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
    
    -- Метод доставки
    method VARCHAR(50) NOT NULL,
    
    -- Tracking
    tracking_number VARCHAR(100),
    tracking_url TEXT,
    
    -- Статус
    status VARCHAR(50) NOT NULL DEFAULT 'created',
    
    -- Пачкомат (для inpost_locker)
    paczkomat_code VARCHAR(20),
    
    -- Адреса доставки (для кур'єра)
    delivery_address TEXT,
    
    -- Дані отримувача
    recipient_name VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    
    -- Вартість доставки
    shipping_cost NUMERIC(10, 2),
    
    -- URL етикетки
    label_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- InPost shipment ID (якщо створено через InPost API)
    inpost_shipment_id VARCHAR(100)
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON finance_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON finance_shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_status ON finance_shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_method ON finance_shipments(method);
CREATE INDEX IF NOT EXISTS idx_shipments_inpost_shipment_id ON finance_shipments(inpost_shipment_id) WHERE inpost_shipment_id IS NOT NULL;

-- Коментарі для документації
COMMENT ON TABLE finance_shipments IS 'Відправки (доставки) - універсальна модель для різних типів доставок';
COMMENT ON COLUMN finance_shipments.method IS 'Метод доставки: inpost_locker, inpost_courier, office_pickup, courier';
COMMENT ON COLUMN finance_shipments.status IS 'Статус відправки: created, label_printed, in_transit, ready_for_pickup, delivered, returned';
COMMENT ON COLUMN finance_shipments.paczkomat_code IS 'Код пачкомату (наприклад, WRO01M)';
COMMENT ON COLUMN finance_shipments.shipping_cost IS 'Вартість доставки (наприклад, 13.99 zł для InPost)';
COMMENT ON COLUMN finance_shipments.inpost_shipment_id IS 'ID відправки в InPost API (якщо створено через InPost)';

