-- Міграція для збільшення довжини поля product_name
-- Дата: 2025-12-16

-- Збільшуємо ліміт для recipe_ingredients
ALTER TABLE recipe_ingredients 
ALTER COLUMN product_name TYPE VARCHAR(500);

-- Збільшуємо ліміт для recipe_component_ingredients
ALTER TABLE recipe_component_ingredients 
ALTER COLUMN product_name TYPE VARCHAR(500);
