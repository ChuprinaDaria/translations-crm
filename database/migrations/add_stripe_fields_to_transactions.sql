-- Migration: Add Stripe fields to finance_transactions table
-- Date: 2026-01-22
-- Description: Adds Stripe-specific fields for payment tracking: payment_intent_id, session_id, customer_email, currency, fee, net_amount, card details, receipt_url, payment_status, payment_link_id

-- Додаємо нові Stripe поля в таблицю транзакцій
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

-- Індекси для швидкого пошуку
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_payment_intent_id ON finance_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_session_id ON finance_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_customer_email ON finance_transactions(stripe_customer_email) WHERE stripe_customer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status ON finance_transactions(payment_status) WHERE payment_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_stripe_payment_link_id ON finance_transactions(stripe_payment_link_id) WHERE stripe_payment_link_id IS NOT NULL;

-- Коментарі для документації
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

