# 🚀 Швидкий старт: Запуск fix скрипта

## ✅ Push виконано успішно!

Зміни запушені в main: `9d840b81..836a9ede`

## 🛠 Запуск fix скрипта

### Варіант 1: В Docker контейнері (рекомендовано)

```bash
# Зайти в контейнер backend
docker-compose exec backend bash

# Запустити скрипт
cd /app
python scripts/maintenance_fix.py
```

### Варіант 2: Прямо через docker-compose

```bash
docker-compose exec backend python scripts/maintenance_fix.py
```

### Варіант 3: Після перезапуску контейнерів

```bash
# Перебудувати та перезапустити контейнери
docker-compose down
docker-compose up -d --build

# Запустити скрипт
docker-compose exec backend python scripts/maintenance_fix.py
```

## 📋 Що робить скрипт

1. **Виправляє Instagram імена** - замінює IGSID на реальні імена через API
2. **Розкодовує MIME заголовки** - виправляє абракадабру в email (From, Subject)
3. **Очищення старих мейлів** - опціонально (закоментовано за замовчуванням)

## ⚙️ Налаштування (якщо потрібно)

### Збільшити rate limiting для Instagram

Якщо багато чатів (1000+), відкрийте `backend/scripts/maintenance_fix.py`:

```python
# Змінити:
fix_instagram_profiles(db, rate_limit_delay=1.0)

# На:
fix_instagram_profiles(db, rate_limit_delay=2.0)  # 2 секунди
```

### Увімкнути очищення старих мейлів

Відкрийте `backend/scripts/maintenance_fix.py`, знайдіть функцію `main()` та розкоментуйте:

```python
cleanup_old_auto_emails(db, days_old=7)
```

⚠️ **Важливо**: Перед очищенням зробіть backup!

```bash
docker-compose exec postgres pg_dump -U translator crm_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

## 📊 Очікуваний вивід

```
============================================================
Maintenance Fix Script
============================================================
Fixing Instagram profiles...
Found 150 Instagram conversations
[1/150] Fetching profile for IGSID: 17841405309211860...
  ✓ Updated: N/A → John Doe
...
Instagram profiles fixed: 145 successful, 3 errors, 2 skipped

Fixing email MIME headers...
Found 500 email messages
Email MIME headers fixed: 487 messages updated

✓ Maintenance fix completed successfully!
```

## 🔍 Перевірка результатів

```bash
# Перевірити логи
docker-compose logs backend | grep "Maintenance"

# Перевірити Telegram Listener
docker-compose logs telegram_listener
```

## 📝 Детальні інструкції

Дивіться `DEPLOYMENT_INSTRUCTIONS.md` для повної документації.

