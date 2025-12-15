-- Міграція для додавання полів транспортних витрат
-- Додаємо два нові поля для розділення транспортних витрат на обладнання та персонал

ALTER TABLE kps 
ADD COLUMN IF NOT EXISTS transport_equipment_total NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transport_personnel_total NUMERIC(10, 2) DEFAULT 0;

-- Коментарі для полів
COMMENT ON COLUMN kps.transport_equipment_total IS 'Транспортні витрати для доставки обладнання';
COMMENT ON COLUMN kps.transport_personnel_total IS 'Транспортні витрати для персоналу';

