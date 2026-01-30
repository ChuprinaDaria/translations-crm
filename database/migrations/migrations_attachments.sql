-- Migration: Create communications_attachments table
-- Created: 2026-01-22

CREATE TABLE IF NOT EXISTS communications_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES communications_messages(id) ON DELETE CASCADE,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON communications_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_file_type ON communications_attachments(file_type);

COMMENT ON TABLE communications_attachments IS 'Зберігання медіа-файлів для повідомлень з усіх каналів';
COMMENT ON COLUMN communications_attachments.file_path IS 'Локальний шлях до файлу в /app/media';
COMMENT ON COLUMN communications_attachments.file_type IS 'Тип файлу: image, document, audio, video';
COMMENT ON COLUMN communications_attachments.file_size IS 'Розмір файлу в байтах';

