-- Міграція: додавання полів для обладнання кухні в анкеті
-- Дата: 2025-12-04

-- Додаємо поля для збереження ID обладнання кухні
ALTER TABLE client_questionnaires 
    ADD COLUMN IF NOT EXISTS dish_serving_equipment_ids JSONB,
    ADD COLUMN IF NOT EXISTS hot_snacks_equipment_ids JSONB,
    ADD COLUMN IF NOT EXISTS salad_equipment_ids JSONB;

-- Коментарі
COMMENT ON COLUMN client_questionnaires.dish_serving_equipment_ids IS 'ID обладнання для подачі страв';
COMMENT ON COLUMN client_questionnaires.hot_snacks_equipment_ids IS 'ID обладнання для гарячих закусок';
COMMENT ON COLUMN client_questionnaires.salad_equipment_ids IS 'ID обладнання для салатів';

