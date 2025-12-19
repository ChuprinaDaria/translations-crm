-- Міграція для виправлення невалідних filename у шаблонах
-- Виправляє всі шаблони з filename = '-.html', '-', '.html', '' або NULL
-- Генерує унікальний filename на основі ID: template_{id}.html
-- Працює для SQLite та PostgreSQL

-- SQLite та PostgreSQL підтримують оператор || для конкатенації рядків
UPDATE templates 
SET filename = 'template_' || CAST(id AS TEXT) || '.html' 
WHERE filename IN ('-.html', '-', '.html', '') OR filename IS NULL;

