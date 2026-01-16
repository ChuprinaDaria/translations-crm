-- Міграція: Додати початкові мокові дані для CRM
-- Дата: 2026-01-16

-- Додати офіси
INSERT INTO offices (name, address, city, postal_code, phone, email, working_hours, is_active, is_default, created_at)
VALUES 
  ('Офіс Warszawa Centrum', 'ul. Marszałkowska 123', 'Warszawa', '00-001', '+48 22 123 4567', 'warszawa@translations.pl', 'Пн-Пт 9:00-18:00, Сб 10:00-14:00', TRUE, TRUE, NOW()),
  ('Офіс Kraków', 'ul. Floriańska 45', 'Kraków', '31-019', '+48 12 345 6789', 'krakow@translations.pl', 'Пн-Пт 9:00-17:00', TRUE, FALSE, NOW()),
  ('Офіс Wrocław', 'Rynek 12', 'Wrocław', '50-101', '+48 71 234 5678', 'wroclaw@translations.pl', 'Пн-Пт 10:00-18:00', TRUE, FALSE, NOW())
ON CONFLICT DO NOTHING;

-- Додати перекладачів
INSERT INTO translators (name, email, phone, telegram_id, whatsapp, status, rating, completed_orders, created_at, updated_at)
VALUES 
  ('Олена Kowalska', 'olena.kowalska@example.com', '+48 500 123 456', '@olena_translator', '+48 500 123 456', 'active', 4.8, 127, NOW(), NOW()),
  ('Марта Nowak', 'marta.nowak@example.com', '+48 501 234 567', '@marta_translator', NULL, 'active', 4.5, 89, NOW(), NOW()),
  ('Анна Wiśniewska', 'anna.wisniewska@example.com', '+48 502 345 678', NULL, '+48 502 345 678', 'active', 4.9, 156, NOW(), NOW()),
  ('Петро Kowalczyk', 'piotr.kowalczyk@example.com', '+48 503 456 789', '@piotr_translator', '+48 503 456 789', 'busy', 4.7, 98, NOW(), NOW())
ON CONFLICT (email) DO NOTHING;

-- Додати мови та ставки перекладачів
INSERT INTO translator_languages (translator_id, language, rate_per_page, specializations)
SELECT 
  t.id,
  lang.language,
  lang.rate,
  lang.specs
FROM translators t
CROSS JOIN (VALUES
  ('Олена Kowalska', 'Danński', 60.00, '["TRC", "Umowy", "Szkolne"]'),
  ('Олена Kowalska', 'Angielski', 65.00, '["TRC", "Umowy"]'),
  ('Марта Nowak', 'Niemiecki', 70.00, '["TRC", "Biznesowe", "Umowy"]'),
  ('Марта Nowak', 'Francuski', 75.00, '["TRC", "Dyplomy"]'),
  ('Анна Wiśniewska', 'Włoski', 65.00, '["TRC", "Umowy", "Medyczne"]'),
  ('Анна Wiśniewska', 'Hiszpański', 70.00, '["TRC", "Prawne"]'),
  ('Петро Kowalczyk', 'Rosyjski', 60.00, '["TRC", "Umowy", "Biznesowe"]'),
  ('Петро Kowalczyk', 'Ukraiński', 55.00, '["TRC", "Dyplomy", "Szkolne"]')
) AS lang(name, language, rate, specs)
WHERE t.name = lang.name
ON CONFLICT DO NOTHING;

-- Додати мокових клієнтів
DO $$
DECLARE
  client1_id UUID := gen_random_uuid();
  client2_id UUID := gen_random_uuid();
  client3_id UUID := gen_random_uuid();
  client4_id UUID := gen_random_uuid();
  client5_id UUID := gen_random_uuid();
  
  manager_id UUID;
  
  order1_id UUID := gen_random_uuid();
  order2_id UUID := gen_random_uuid();
  order3_id UUID := gen_random_uuid();
  order4_id UUID := gen_random_uuid();
  order5_id UUID := gen_random_uuid();
  order6_id UUID := gen_random_uuid();
  order7_id UUID := gen_random_uuid();
BEGIN
  -- Отримати ID менеджера (перший юзер)
  SELECT id INTO manager_id FROM users LIMIT 1;
  
  -- Якщо менеджера немає, створюємо тестового
  IF manager_id IS NULL THEN
    manager_id := gen_random_uuid();
    INSERT INTO users (id, email, first_name, last_name, totp_secret, role, is_active, created_at)
    VALUES (manager_id, 'manager@translations.pl', 'Менеджер', 'Тестовий', 'test_secret', 'admin', TRUE, NOW());
  END IF;

  -- Додати клієнтів
  INSERT INTO crm_clients (id, full_name, email, phone, source, created_at)
  VALUES 
    (client1_id, 'Іван Kowalski', 'ivan.kowalski@example.com', '+48 600 111 222', 'tg', NOW()),
    (client2_id, 'Марія Коваленко', 'maria.kovalenko@example.com', '+48 600 222 333', 'meta', NOW()),
    (client3_id, 'Володимир Сидоренко', 'volodymyr.sydorenko@example.com', '+48 600 333 444', 'manual', NOW()),
    (client4_id, 'Анна Мельник', 'anna.melnyk@example.com', '+48 600 444 555', 'tg', NOW()),
    (client5_id, 'Оксана Бондаренко', 'oksana.bondarenko@example.com', '+48 600 555 666', 'meta', NOW());

  -- Додати замовлення
  INSERT INTO crm_orders (id, client_id, manager_id, order_number, description, status, deadline, office_id, created_at, updated_at)
  VALUES 
    (order1_id, client1_id, manager_id, 'N/01/02/01/26/dnk', 'TRC (Duński → Polski)', 'do_wykonania', NOW() + INTERVAL '5 days', 1, NOW(), NOW()),
    (order2_id, client2_id, manager_id, 'N/02/02/01/26/eng', 'Umowa (Angielski → Polski)', 'do_wykonania', NOW() + INTERVAL '1 day', 1, NOW(), NOW()),
    (order3_id, client3_id, manager_id, 'N/03/02/01/26/fra', 'Zaświadczenie (Francuski → Polski)', 'do_poswiadczenia', NOW() - INTERVAL '1 day', 2, NOW(), NOW()),
    (order4_id, client4_id, manager_id, 'N/04/02/01/26/esp', 'Dyplom (Hiszpański → Polski)', 'do_poswiadczenia', NOW() + INTERVAL '5 days', 1, NOW(), NOW()),
    (order5_id, client5_id, manager_id, 'N/05/02/01/26/deu', 'Biznesowy (Niemiecki → Polski)', 'do_wydania', NOW() + INTERVAL '1 day', 1, NOW(), NOW()),
    (order6_id, client1_id, manager_id, 'N/06/02/01/26/ita', 'Umowa (Włoski → Polski)', 'ustne', NOW() + INTERVAL '3 days', 3, NOW(), NOW()),
    (order7_id, client2_id, manager_id, 'N/07/02/01/26/rus', 'TRC (Rosyjski → Polski)', 'closed', NOW() - INTERVAL '3 days', 1, NOW(), NOW());

  -- Додати timeline етапи для замовлення 1 (новое)
  INSERT INTO timeline_steps (order_id, step_type, completed, completed_at, completed_by_id, created_at)
  VALUES 
    (order1_id, 'client_created', TRUE, NOW() - INTERVAL '2 days', manager_id, NOW() - INTERVAL '2 days'),
    (order1_id, 'order_created', TRUE, NOW() - INTERVAL '2 days', manager_id, NOW() - INTERVAL '2 days');

  -- Додати timeline етапи для замовлення 2 (в роботі)
  INSERT INTO timeline_steps (order_id, step_type, completed, completed_at, completed_by_id, created_at)
  VALUES 
    (order2_id, 'client_created', TRUE, NOW() - INTERVAL '3 days', manager_id, NOW() - INTERVAL '3 days'),
    (order2_id, 'order_created', TRUE, NOW() - INTERVAL '3 days', manager_id, NOW() - INTERVAL '3 days'),
    (order2_id, 'payment_link_sent', TRUE, NOW() - INTERVAL '2 days', manager_id, NOW() - INTERVAL '2 days'),
    (order2_id, 'payment_received', TRUE, NOW() - INTERVAL '1 day', manager_id, NOW() - INTERVAL '1 day'),
    (order2_id, 'translator_assigned', TRUE, NOW() - INTERVAL '1 day', manager_id, NOW() - INTERVAL '1 day');

  -- Додати timeline етапи для замовлення 7 (завершено)
  INSERT INTO timeline_steps (order_id, step_type, completed, completed_at, completed_by_id, created_at)
  VALUES 
    (order7_id, 'client_created', TRUE, NOW() - INTERVAL '10 days', manager_id, NOW() - INTERVAL '10 days'),
    (order7_id, 'order_created', TRUE, NOW() - INTERVAL '10 days', manager_id, NOW() - INTERVAL '10 days'),
    (order7_id, 'payment_link_sent', TRUE, NOW() - INTERVAL '9 days', manager_id, NOW() - INTERVAL '9 days'),
    (order7_id, 'payment_received', TRUE, NOW() - INTERVAL '8 days', manager_id, NOW() - INTERVAL '8 days'),
    (order7_id, 'translator_assigned', TRUE, NOW() - INTERVAL '7 days', manager_id, NOW() - INTERVAL '7 days'),
    (order7_id, 'translation_ready', TRUE, NOW() - INTERVAL '4 days', manager_id, NOW() - INTERVAL '4 days'),
    (order7_id, 'issued_sent', TRUE, NOW() - INTERVAL '3 days', manager_id, NOW() - INTERVAL '3 days');

  -- Додати internal notes
  INSERT INTO internal_notes (entity_type, entity_id, author_id, author_name, text, created_at)
  VALUES 
    ('order', order1_id::text, manager_id, 'Менеджер Тестовий', 'Клієнт просив терміново', NOW() - INTERVAL '1 day'),
    ('order', order1_id::text, manager_id, 'Менеджер Тестовий', 'Уточнити формат документа', NOW() - INTERVAL '6 hours'),
    ('client', client1_id::text, manager_id, 'Менеджер Тестовий', 'Постійний клієнт, дати знижку 5%', NOW() - INTERVAL '2 days'),
    ('order', order2_id::text, manager_id, 'Менеджер Тестовий', 'Перекладач взяв в роботу', NOW() - INTERVAL '1 day'),
    ('order', order7_id::text, manager_id, 'Менеджер Тестовий', 'Замовлення виконано успішно', NOW() - INTERVAL '3 days');

END $$;

