-- Міграція: додавання поля event_type (формат заходу) в client_questionnaires

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'client_questionnaires'
          AND column_name = 'event_type'
    ) THEN
        ALTER TABLE client_questionnaires
        ADD COLUMN event_type VARCHAR(255);
        
        COMMENT ON COLUMN client_questionnaires.event_type IS 'Формат заходу (для переносу в КП)';
    END IF;
END $$;


