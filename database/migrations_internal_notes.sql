-- migrations_internal_notes.sql
-- Єдина система Internal Notes для всіх сутностей

CREATE TABLE IF NOT EXISTS internal_notes (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_internal_notes_entity_type ON internal_notes(entity_type);
CREATE INDEX IF NOT EXISTS idx_internal_notes_entity_id ON internal_notes(entity_id);
CREATE INDEX IF NOT EXISTS idx_internal_notes_author_id ON internal_notes(author_id);
CREATE INDEX IF NOT EXISTS idx_internal_notes_created_at ON internal_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_internal_notes_entity ON internal_notes(entity_type, entity_id);

-- Коментарі для документації
COMMENT ON TABLE internal_notes IS 'Єдина система нотаток для всіх сутностей (client, order, chat, payment)';
COMMENT ON COLUMN internal_notes.entity_type IS 'Тип сутності: client, order, chat, payment';
COMMENT ON COLUMN internal_notes.entity_id IS 'ID сутності (може бути UUID або string)';
COMMENT ON COLUMN internal_notes.author_id IS 'ID автора нотатки (з users)';
COMMENT ON COLUMN internal_notes.author_name IS 'Ім''я автора (для швидкого відображення)';

