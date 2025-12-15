-- Міграція для створення таблиці чеклістів для боксів та кейтерингу
-- Дата: 2025-12-15

CREATE TABLE IF NOT EXISTS checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Тип чекліста: 'box' або 'catering'
    checklist_type VARCHAR(20) NOT NULL,
    
    -- Зв'язки
    client_id INTEGER REFERENCES clients(id),
    kp_id INTEGER REFERENCES kps(id),
    manager_id INTEGER REFERENCES users(id),
    
    -- 1. Дата заходу
    event_date DATE,
    
    -- 2. Контакт
    contact_name VARCHAR(200),
    contact_phone VARCHAR(50),
    contact_email VARCHAR(200),
    
    -- 3. Формат заходу
    event_format VARCHAR(200),
    
    -- 4. Привід/причина святкування
    event_reason VARCHAR(300),
    
    -- 5. Номер замовлення (для боксів)
    order_number VARCHAR(100),
    
    -- 6. Час доставки / Час початку
    delivery_time VARCHAR(100),
    
    -- 7. Тривалість заходу
    event_duration VARCHAR(100),
    
    -- 8. Чи потрібен кур'єр/персонал
    needs_courier BOOLEAN DEFAULT FALSE,
    personnel_notes TEXT,
    
    -- 9. Локація
    location_address VARCHAR(500),
    location_floor VARCHAR(50),
    location_elevator BOOLEAN DEFAULT FALSE,
    
    -- 10. К-кість гостей
    guest_count INTEGER,
    
    -- 11. Бюджет
    budget VARCHAR(200),
    budget_amount NUMERIC(10, 2),
    
    -- 12. Обладнання (кейтеринг)
    equipment_furniture BOOLEAN DEFAULT FALSE,
    equipment_tablecloths BOOLEAN DEFAULT FALSE,
    equipment_disposable_dishes BOOLEAN DEFAULT FALSE,
    equipment_glass_dishes BOOLEAN DEFAULT FALSE,
    equipment_notes TEXT,
    
    -- 13. Побажання щодо страв
    food_hot BOOLEAN DEFAULT FALSE,
    food_cold BOOLEAN DEFAULT FALSE,
    food_salads BOOLEAN DEFAULT FALSE,
    food_garnish BOOLEAN DEFAULT FALSE,
    food_sweet BOOLEAN DEFAULT FALSE,
    food_vegetarian BOOLEAN DEFAULT FALSE,
    food_vegan BOOLEAN DEFAULT FALSE,
    food_preference VARCHAR(100),
    food_notes TEXT,
    
    -- 14. Загальний коментар
    general_comment TEXT,
    
    -- 15. Напої та алкоголь
    drinks_notes TEXT,
    alcohol_notes TEXT,
    
    -- 16. Знижка та націнка
    discount_notes TEXT,
    surcharge_notes TEXT,
    
    -- Статус
    status VARCHAR(50) DEFAULT 'draft',
    
    -- Метадані
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Індекси для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_checklists_type ON checklists(checklist_type);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON checklists(status);
CREATE INDEX IF NOT EXISTS idx_checklists_client_id ON checklists(client_id);
CREATE INDEX IF NOT EXISTS idx_checklists_manager_id ON checklists(manager_id);
CREATE INDEX IF NOT EXISTS idx_checklists_created_at ON checklists(created_at);

