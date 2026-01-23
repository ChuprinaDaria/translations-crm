# Система міграцій при деплої

## Як працює система міграцій

При кожному деплої (старті backend) автоматично виконується перевірка та створення відсутніх таблиць.

### Що робить система:

1. ✅ **Перевіряє наявність таблиць** - порівнює список таблиць з async моделей з тими, що вже є в базі
2. ✅ **Створює тільки відсутні таблиці** - не чіпає існуючі таблиці
3. ✅ **Не створює старі таблиці** - ігнорує таблиці з `db.Base` (sync)
4. ✅ **Безпечна** - не видаляє і не змінює існуючі таблиці

### Які таблиці створюються:

Система створює тільки таблиці з **нових async моделей** (`core.db.Base`):

- `users` (auth)
- `clients`, `orders`, `internal_notes`, `timeline_steps` (crm)
- `translators`, `translator_languages`, `translation_requests` (crm)
- `offices`, `languages`, `specializations`, `translator_language_rates` (crm)
- `transactions` (finance)
- `communications_conversations`, `communications_messages` (communications)
- `notifications`, `notification_settings` (notifications)

### Старі таблиці (legacy):

Таблиці з `db.Base` (sync) **НЕ створюються автоматично**:
- `categories`, `templates`, `kps`, `recipes`, `benefits`, `telegram_accounts`, `app_settings`, etc.

Ці таблиці вже існують в базі і не потребують автоматичного створення.

## Логи при деплої

При старті backend ви побачите:

```
Found 16 async models to check: clients, communications_conversations, ...
Found 45 existing tables in database
Creating 2 missing tables: notification_settings, notifications
✓ Created table: notification_settings
✓ Created table: notifications
✓ Successfully created 2 tables
✓ Database migration check completed
```

Якщо всі таблиці вже існують:

```
Found 16 async models to check: clients, communications_conversations, ...
Found 45 existing tables in database
✓ All async tables already exist, nothing to create
✓ Database migration check completed
```

## Додавання нових таблиць

Коли ви додаєте нову модель з `from core.db import Base`:

1. Створіть модель в відповідному модулі
2. При наступному деплої таблиця створиться автоматично
3. Нічого додаткового робити не потрібно!

## Ручне створення таблиць

Якщо потрібно створити таблиці вручну (наприклад, для тестування):

```bash
cd translations-crm/backend
python3 -c "from core.migrations import create_missing_tables; import asyncio; asyncio.run(create_missing_tables())"
```

Або використайте готовий скрипт:

```bash
cd translations-crm/backend
python3 create_notification_settings_table.py
```

## Перевірка створених таблиць

Після деплою перевірте в базі:

```sql
-- Перевірити всі таблиці
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Перевірити конкретну таблицю
SELECT * FROM notification_settings LIMIT 1;
```

## Важливо

- ✅ Система **безпечна** - не видаляє і не змінює існуючі таблиці
- ✅ Створює тільки **відсутні** таблиці
- ✅ Працює **автоматично** при кожному деплої
- ✅ Не потребує **ручного втручання**

