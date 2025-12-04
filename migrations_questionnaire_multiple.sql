-- Міграція: підтримка множинних анкет для клієнта
-- Дата: 2025-12-04

-- Прибираємо унікальний constraint на client_id (дозволяємо кілька анкет на клієнта)
ALTER TABLE client_questionnaires DROP CONSTRAINT IF EXISTS client_questionnaires_client_id_key;

-- Додаємо поле manager_id
ALTER TABLE client_questionnaires 
    ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(id);

-- Створюємо індекс для швидкого пошуку анкет по клієнту та менеджеру
CREATE INDEX IF NOT EXISTS idx_questionnaires_client ON client_questionnaires(client_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_manager ON client_questionnaires(manager_id);
CREATE INDEX IF NOT EXISTS idx_questionnaires_created ON client_questionnaires(created_at DESC);

-- Коментар
COMMENT ON COLUMN client_questionnaires.manager_id IS 'Менеджер, який створив анкету';
COMMENT ON TABLE client_questionnaires IS 'Анкети клієнтів (можливо кілька анкет на одного клієнта)';

