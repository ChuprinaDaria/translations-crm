-- migrations_timeline_steps.sql
-- Таблиця для зберігання етапів Timeline замовлень

CREATE TABLE IF NOT EXISTS timeline_steps (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
    step_type VARCHAR(50) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_timeline_steps_order_id ON timeline_steps(order_id);
CREATE INDEX IF NOT EXISTS idx_timeline_steps_step_type ON timeline_steps(step_type);
CREATE INDEX IF NOT EXISTS idx_timeline_steps_completed ON timeline_steps(completed);
CREATE INDEX IF NOT EXISTS idx_timeline_steps_completed_at ON timeline_steps(completed_at);
CREATE INDEX IF NOT EXISTS idx_timeline_steps_order_step ON timeline_steps(order_id, step_type);

-- Коментарі для документації
COMMENT ON TABLE timeline_steps IS 'Етапи Timeline для автоматизації замовлень';
COMMENT ON COLUMN timeline_steps.step_type IS 'Тип етапу: client_created, order_created, payment_link_sent, payment_received, translator_assigned, translation_ready, issued_sent';
COMMENT ON COLUMN timeline_steps.metadata IS 'JSON з додатковими даними (client_id, payment_link, transaction_id, translator_id, tracking_number)';

