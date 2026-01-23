# Виправлення помилки: relation "notification_settings" does not exist

## Проблема

При спробі отримати кількість непрочитаних нотифікацій через API `/api/v1/notifications/unread/count` виникає помилка:

```
relation "notification_settings" does not exist
```

### Причина

1. Модель `NotificationSettings` використовує `Base` з `core.db` (async engine)
2. `main.py` створює таблиці використовуючи `Base` з `db.py` (sync engine)
3. Через це таблиця `notification_settings` не створюється автоматично
4. Коли API намагається завантажити користувача з relationship `notification_settings` (lazy="selectin"), виникає помилка

## Рішення

### Варіант 1: Автоматичне створення (рекомендовано)

Оновлено `main.py` - тепер при старті додаток автоматично перевіряє і створює таблиці `notification_settings` та `notifications` якщо вони не існують.

**Перезапустіть backend сервер** - таблиці створяться автоматично.

### Варіант 2: Ручне створення через міграційний скрипт

Якщо автоматичне створення не спрацювало, виконайте міграційний скрипт:

```bash
cd translations-crm/backend
python3 create_notification_settings_table.py
```

Скрипт:
- Перевіряє чи існує таблиця `notification_settings`
- Створює таблицю якщо вона не існує
- Також створює таблицю `notifications` якщо вона не існує
- Створює необхідні індекси

## Перевірка

Після виконання міграції перевірте:

1. Таблиця створена:
```sql
SELECT * FROM notification_settings LIMIT 1;
```

2. API працює:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://tlumaczeniamt.com.pl/api/v1/notifications/unread/count
```

## Структура таблиці

### notification_settings
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, UNIQUE, FOREIGN KEY -> users.id)
- `enabled` (BOOLEAN, default: TRUE)
- `sound` (BOOLEAN, default: TRUE)
- `desktop` (BOOLEAN, default: TRUE)
- `vibration` (BOOLEAN, default: TRUE)
- `types_enabled` (JSONB)
- `do_not_disturb` (JSONB)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `updated_at` (TIMESTAMP WITH TIME ZONE)

### notifications
- `id` (UUID, PRIMARY KEY)
- `user_id` (UUID, FOREIGN KEY -> users.id)
- `type` (VARCHAR)
- `title` (VARCHAR)
- `message` (VARCHAR)
- `entity_type` (VARCHAR, nullable)
- `entity_id` (VARCHAR, nullable)
- `data` (JSONB, nullable)
- `is_read` (BOOLEAN, default: FALSE)
- `read_at` (TIMESTAMP WITH TIME ZONE, nullable)
- `action_url` (VARCHAR, nullable)
- `created_at` (TIMESTAMP WITH TIME ZONE)
- `expires_at` (TIMESTAMP WITH TIME ZONE, nullable)

## Примітки

- Міграція безпечна - вона не видаляє дані
- Якщо таблиці вже існують, скрипт просто пропустить їх створення
- Після створення таблиць помилка повинна зникнути

