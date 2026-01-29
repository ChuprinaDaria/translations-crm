# Скрипт виправлення даних (maintenance_fix.py)

Скрипт для виправлення існуючих даних після міграції бази даних.

## Функції

1. **Виправлення Instagram профілів** - замінює IGSID на реальні імена користувачів
2. **Розкодування MIME-заголовків** - виправляє абракадабру в email (From, Subject)
3. **Очищення старих мейлів** - видаляє автоматично підтягнуті мейли старіше N днів (опціонально)

## Використання

### В Docker контейнері:

```bash
# Зайти в контейнер
docker exec -it <container_name> bash

# Перейти в директорію backend
cd /app/backend

# Запустити скрипт
python scripts/maintenance_fix.py
```

### Локально:

```bash
cd backend
python scripts/maintenance_fix.py
```

## Налаштування

### Rate Limiting для Instagram API

За замовчуванням між запитами до Instagram API є затримка 1 секунда. Якщо у вас багато чатів (1000+), Meta може забанити за масові запити. 

Щоб збільшити затримку, змініть параметр `rate_limit_delay` у функції `fix_instagram_profiles()`:

```python
fix_instagram_profiles(db, rate_limit_delay=2.0)  # 2 секунди замість 1
```

### Очищення старих мейлів

За замовчуванням функція очищення закоментована. Щоб увімкнути:

1. Розкоментуйте рядок у функції `main()`:
```python
cleanup_old_auto_emails(db, days_old=7)
```

2. Скрипт запитає підтвердження перед видаленням

## Безпека

⚠️ **Важливо**: Перед запуском скрипта з очищенням мейлів обов'язково зробіть backup бази даних!

```bash
# Backup бази даних
pg_dump -U translator -d crm_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Логи

Скрипт виводить детальні логи:
- Кількість знайдених записів
- Прогрес обробки
- Результати виправлень
- Помилки (якщо є)

## Приклад виводу

```
============================================================
Maintenance Fix Script
============================================================
This script will:
  1. Fix Instagram profile names (replace IGSID with real names)
  2. Decode MIME headers in email messages
  3. Clean up old auto-imported emails (optional)
============================================================
============================================================
Fixing Instagram profiles...
============================================================
Found 150 Instagram conversations
[1/150] Fetching profile for IGSID: 17841405309211860...
  ✓ Updated: N/A → John Doe
[2/150] Fetching profile for IGSID: 17841405309211861...
  ✓ Updated: N/A → Jane Smith
...
Instagram profiles fixed: 145 successful, 3 errors, 2 skipped

============================================================
Fixing email MIME headers...
============================================================
Found 500 email messages
Email MIME headers fixed: 487 messages updated

============================================================
✓ Maintenance fix completed successfully!
============================================================
```

