-- Міграція: Додавання поля can_cook_on_location для позначення страв, які можна готувати на локації
ALTER TABLE kp_items 
ADD COLUMN IF NOT EXISTS can_cook_on_location BOOLEAN DEFAULT FALSE NOT NULL;

