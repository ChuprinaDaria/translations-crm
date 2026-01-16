-- migrations_translators.sql
-- Таблиці для модуля TRANSLATORS та TRANSLATION REQUESTS

-- Таблиця перекладачів
CREATE TABLE IF NOT EXISTS translators (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    telegram_id VARCHAR(255),
    whatsapp VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'active',
    rating NUMERIC(3, 2) DEFAULT 0.0 NOT NULL,
    completed_orders INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Таблиця мов та ставок перекладачів
CREATE TABLE IF NOT EXISTS translator_languages (
    id SERIAL PRIMARY KEY,
    translator_id INTEGER NOT NULL REFERENCES translators(id) ON DELETE CASCADE,
    language VARCHAR(100) NOT NULL,
    rate_per_page NUMERIC(10, 2) NOT NULL,
    specializations TEXT,  -- JSON array: ["TRC", "Umowy", "Szkolne"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Таблиця запитів на переклад
CREATE TABLE IF NOT EXISTS translation_requests (
    id SERIAL PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES crm_orders(id) ON DELETE CASCADE,
    translator_id INTEGER NOT NULL REFERENCES translators(id) ON DELETE CASCADE,
    sent_via VARCHAR(50) NOT NULL,  -- "email" | "telegram" | "whatsapp"
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- "pending" | "accepted" | "declined"
    response_at TIMESTAMP WITH TIME ZONE,
    offered_rate NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_translators_status ON translators(status);
CREATE INDEX IF NOT EXISTS idx_translators_email ON translators(email);
CREATE INDEX IF NOT EXISTS idx_translator_languages_translator_id ON translator_languages(translator_id);
CREATE INDEX IF NOT EXISTS idx_translator_languages_language ON translator_languages(language);
CREATE INDEX IF NOT EXISTS idx_translation_requests_order_id ON translation_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_translation_requests_translator_id ON translation_requests(translator_id);
CREATE INDEX IF NOT EXISTS idx_translation_requests_status ON translation_requests(status);
CREATE INDEX IF NOT EXISTS idx_translation_requests_sent_at ON translation_requests(sent_at);

-- Коментарі для документації
COMMENT ON TABLE translators IS 'Перекладачі системи';
COMMENT ON TABLE translator_languages IS 'Мови та ставки перекладачів';
COMMENT ON TABLE translation_requests IS 'Запити на переклад відправлені перекладачам';
COMMENT ON COLUMN translator_languages.specializations IS 'JSON array спеціалізацій: ["TRC", "Umowy", "Szkolne"]';
COMMENT ON COLUMN translation_requests.sent_via IS 'Спосіб відправки: email, telegram, whatsapp';
COMMENT ON COLUMN translation_requests.status IS 'Статус запиту: pending, accepted, declined';

