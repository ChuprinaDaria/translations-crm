-- Migration: Add languages and specializations system
-- Date: 2026-01-22
-- Description: Creates centralized language management system with specializations and translator rates

-- Таблиця мов з базовими цінами для клієнтів
CREATE TABLE IF NOT EXISTS languages (
    id SERIAL PRIMARY KEY,
    name_pl VARCHAR(100) NOT NULL UNIQUE,
    name_en VARCHAR(100),
    base_client_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Таблиця типів спеціалізацій (TRC, Umowy, Dyplomy...)
CREATE TABLE IF NOT EXISTS specializations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Зв'язок перекладач <-> мова <-> спеціалізація з індивідуальними ставками
CREATE TABLE IF NOT EXISTS translator_language_rates (
    id SERIAL PRIMARY KEY,
    translator_id INTEGER REFERENCES translators(id) ON DELETE CASCADE,
    language_id INTEGER REFERENCES languages(id) ON DELETE CASCADE,
    specialization_id INTEGER REFERENCES specializations(id) ON DELETE CASCADE,
    translator_rate DECIMAL(10,2) NOT NULL,
    custom_client_price DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(translator_id, language_id, specialization_id)
);

-- Індекси для швидкості
CREATE INDEX IF NOT EXISTS idx_translator_rates ON translator_language_rates(translator_id);
CREATE INDEX IF NOT EXISTS idx_language_rates ON translator_language_rates(language_id);
CREATE INDEX IF NOT EXISTS idx_specialization_rates ON translator_language_rates(specialization_id);

-- Коментарі для документації
COMMENT ON TABLE languages IS 'Централізована таблиця мов з базовими цінами для клієнтів';
COMMENT ON TABLE specializations IS 'Типи спеціалізацій перекладів (TRC, Umowy, Dyplomy...)';
COMMENT ON TABLE translator_language_rates IS 'Зв''язок перекладач-мова-спеціалізація з індивідуальними ставками';
COMMENT ON COLUMN languages.base_client_price IS 'Базова ціна для клієнта за сторінку';
COMMENT ON COLUMN translator_language_rates.translator_rate IS 'Ставка перекладача за сторінку';
COMMENT ON COLUMN translator_language_rates.custom_client_price IS 'Кастомна ціна для клієнта (якщо відрізняється від базової)';

-- Вставка базових спеціалізацій
INSERT INTO specializations (name, description, is_custom) VALUES
('TRC', 'Tłumaczenie przysięgłe', FALSE),
('Umowy', 'Umowy i kontrakty', FALSE),
('Szkolne', 'Dokumenty szkolne', FALSE),
('Dyplomy', 'Dyplomy i certyfikaty', FALSE),
('Medyczne', 'Dokumenty medyczne', FALSE),
('Prawne', 'Dokumenty prawne', FALSE),
('Biznesowe', 'Dokumenty biznesowe', FALSE),
('Techniczne', 'Dokumenty techniczne', FALSE)
ON CONFLICT (name) DO NOTHING;

-- Вставка базових мов з цінами
INSERT INTO languages (name_pl, name_en, base_client_price) VALUES
('Angielski', 'English', 60.00),
('Ukraiński', 'Ukrainian', 60.00),
('Rosyjski', 'Russian', 60.00),
('Niemiecki', 'German', 70.00),
('Hiszpański', 'Spanish', 70.00),
('Francuski', 'French', 70.00),
('Białoruski', 'Belarusian', 120.00),
('Litewski', 'Lithuanian', 85.00),
('Łotewski', 'Latvian', 85.00),
('Włoski', 'Italian', 70.00),
('Gruziński', 'Georgian', 100.00),
('Portugalski', 'Portuguese', 80.00),
('Bułgarski', 'Bulgarian', 80.00),
('Węgierski', 'Hungarian', 120.00),
('Niderlandzki', 'Dutch', 90.00),
('Chiński', 'Chinese', 200.00),
('Japoński', 'Japanese', 180.00),
('Czeski', 'Czech', 80.00),
('Turecki', 'Turkish', 150.00),
('Rumuński', 'Romanian', 80.00),
('Słowacki', 'Slovak', 70.00),
('Fiński', 'Finnish', 100.00),
('Duński', 'Danish', 100.00),
('Grecki', 'Greek', 150.00),
('Chorwacki', 'Croatian', 80.00),
('Indonezyjski', 'Indonesian', 200.00),
('Arabski', 'Arabic', 200.00),
('Perski', 'Persian', 150.00),
('Wietnamski', 'Vietnamese', 200.00)
ON CONFLICT (name_pl) DO NOTHING;

