-- ============================================
-- Скрипт для встановлення адміністратора
-- Використання: psql -U postgres -d cafe_db -f set_admin.sql
-- ============================================

-- Призначення адміністратора для користувача chuprina.dariia@gmail.com
UPDATE users 
SET is_admin = TRUE 
WHERE email = 'chuprina.dariia@gmail.com';

-- Перевірка результату
SELECT id, email, is_admin, is_active, role 
FROM users 
WHERE email = 'chuprina.dariia@gmail.com';

