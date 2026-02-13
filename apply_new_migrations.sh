#!/bin/bash
# Script to apply new migrations on production server
# Run this on the server: bash apply_new_migrations.sh

set -e

echo "🔄 Pulling latest changes from git..."
git pull origin main

echo ""
echo "📝 Applying migration: add_stripe_fields_to_transactions.sql"
docker compose exec -T postgres psql -U crm_user -d crm_translations <<'EOF'
-- Migration: Add Stripe fields to finance_transactions table
ALTER TABLE finance_transactions 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS stripe_customer_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'PLN' NOT NULL,
ADD COLUMN IF NOT EXISTS stripe_fee NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS net_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS card_brand VARCHAR(50),
ADD COLUMN IF NOT EXISTS card_last4 VARCHAR(4),
ADD COLUMN IF NOT EXISTS stripe_receipt_url TEXT,
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS stripe_payment_link_id VARCHAR(255);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent_id ON finance_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session_id ON finance_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_customer_email ON finance_transactions(stripe_customer_email) WHERE stripe_customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON finance_transactions(payment_status) WHERE payment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_link_id ON finance_transactions(stripe_payment_link_id) WHERE stripe_payment_link_id IS NOT NULL;

-- Comments
COMMENT ON COLUMN finance_transactions.stripe_payment_intent_id IS 'Stripe Payment Intent ID (унікальний ідентифікатор платежу)';
COMMENT ON COLUMN finance_transactions.stripe_session_id IS 'Stripe Checkout Session ID';
COMMENT ON COLUMN finance_transactions.stripe_customer_email IS 'Email клієнта з Stripe';
COMMENT ON COLUMN finance_transactions.currency IS 'Валюта транзакції (за замовчуванням PLN)';
COMMENT ON COLUMN finance_transactions.stripe_fee IS 'Комісія Stripe';
COMMENT ON COLUMN finance_transactions.net_amount IS 'Нетто-сума після вирахування комісії Stripe';
COMMENT ON COLUMN finance_transactions.card_brand IS 'Бренд картки (Visa, Mastercard, etc.)';
COMMENT ON COLUMN finance_transactions.card_last4 IS 'Останні 4 цифри картки';
COMMENT ON COLUMN finance_transactions.stripe_receipt_url IS 'URL receipt від Stripe';
COMMENT ON COLUMN finance_transactions.payment_status IS 'Статус оплати (pending, succeeded, failed, refunded)';
COMMENT ON COLUMN finance_transactions.stripe_payment_link_id IS 'ID Stripe Payment Link';
EOF

echo "✅ Migration add_stripe_fields_to_transactions applied successfully"

echo ""
echo "📝 Applying migration: create_finance_shipments_table.sql"
docker compose exec -T postgres psql -U crm_user -d crm_translations <<'EOF'
-- Migration: Create finance_shipments table
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON finance_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON finance_shipments(tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_status ON finance_shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_method ON finance_shipments(method);
CREATE INDEX IF NOT EXISTS idx_shipments_inpost_shipment_id ON finance_shipments(inpost_shipment_id) WHERE inpost_shipment_id IS NOT NULL;

-- Comments
COMMENT ON TABLE finance_shipments IS 'Відправки (доставки) - універсальна модель для різних типів доставок';
COMMENT ON COLUMN finance_shipments.method IS 'Метод доставки: inpost_locker, inpost_courier, office_pickup, courier';
COMMENT ON COLUMN finance_shipments.status IS 'Статус відправки: created, label_printed, in_transit, ready_for_pickup, delivered, returned';
COMMENT ON COLUMN finance_shipments.paczkomat_code IS 'Код пачкомату (наприклад, WRO01M)';
COMMENT ON COLUMN finance_shipments.shipping_cost IS 'Вартість доставки (наприклад, 13.99 zł для InPost)';
COMMENT ON COLUMN finance_shipments.inpost_shipment_id IS 'ID відправки в InPost API (якщо створено через InPost)';
EOF

echo "✅ Migration create_finance_shipments_table applied successfully"

echo ""
echo "🎉 All migrations applied successfully!"
echo ""
echo "🔄 Restarting services..."
docker compose restart backend celery_worker celery_beat

echo ""
echo "✅ Done! Services restarted."

