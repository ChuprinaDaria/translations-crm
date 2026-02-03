-- ============================================
-- Міграція: Додавання поля rag_token до таблиці ai_settings
-- Дата: 2026-01-22
-- Опис: Додає поле rag_token для авторизації вхідних запитів від RAG
-- ============================================

-- Додавання поля rag_token до таблиці ai_settings
ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS rag_token VARCHAR(255) NULL DEFAULT 'adme_rag_secret_987654321';

-- Оновлення існуючих записів (якщо поле NULL)
UPDATE ai_settings 
SET rag_token = 'adme_rag_secret_987654321' 
WHERE rag_token IS NULL;

-- ============================================
-- Перевірка: після виконання перевірте структуру таблиці
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'ai_settings' AND column_name = 'rag_token';
-- ============================================

