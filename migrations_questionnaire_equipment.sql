-- Міграція: додавання поля для вибраного обладнання в анкеті
-- Дата: 2025-12-04

-- Додаємо поле для збереження ID вибраного обладнання
ALTER TABLE client_questionnaires 
    ADD COLUMN IF NOT EXISTS selected_equipment_ids JSONB;

-- Коментар
COMMENT ON COLUMN client_questionnaires.selected_equipment_ids IS 'ID вибраного обладнання для автоматичного додавання в КП клієнта';

