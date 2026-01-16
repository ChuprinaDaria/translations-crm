-- Міграція: додати кольори та шрифт до шаблонів КП

ALTER TABLE templates
    ADD COLUMN IF NOT EXISTS primary_color VARCHAR(50),
    ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(50),
    ADD COLUMN IF NOT EXISTS text_color VARCHAR(50),
    ADD COLUMN IF NOT EXISTS font_family VARCHAR(100);

-- За замовчуванням нічого не змінюємо, фронт/рендер підставить дефолтні значення


