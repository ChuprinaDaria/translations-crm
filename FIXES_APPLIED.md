# Виправлення помилок

## 1. Виправлення помилки з Telegram api_id

### Проблема
При створенні Telegram акаунта виникала помилка:
```
column "api_id" is of type uuid but expression is of type integer
```

### Причина
В базі даних поле `api_id` має тип UUID, але має бути INTEGER.

### Виправлення
Створено міграцію `database/migrations/fix_telegram_accounts_api_id_type.sql` для виправлення типу колонки.

### Як застосувати міграцію

```bash
# Підключитися до бази даних
docker-compose exec postgres psql -U translator -d crm_db

# Або локально
psql -U translator -d crm_db -h localhost -p 5435

# Виконати міграцію
\i database/migrations/fix_telegram_accounts_api_id_type.sql
```

Або через Python:

```python
from sqlalchemy import create_engine, text

engine = create_engine("postgresql://translator:password@localhost:5435/crm_db")
with engine.connect() as conn:
    with open("database/migrations/fix_telegram_accounts_api_id_type.sql") as f:
        conn.execute(text(f.read()))
    conn.commit()
```

## 2. Автоматичний запуск email_imap_listener.py

### Проблема
`email_imap_listener.py` потрібно було запускати вручну, що незручно при деплої.

### Виправлення
Додано сервіс `email_imap_listener` в `docker-compose.yml` та `docker-compose.production.yml`.

### Як використовувати

1. **Автоматичний запуск**: Сервіс автоматично запускається при старті контейнерів:
   ```bash
   docker-compose up -d
   ```

2. **Перевірка статусу**:
   ```bash
   docker-compose ps email_imap_listener
   docker-compose logs email_imap_listener
   ```

3. **Перезапуск сервісу**:
   ```bash
   docker-compose restart email_imap_listener
   ```

### Налаштування

Змінні оточення (в docker-compose):
- `EMAIL_CHECK_INTERVAL` - інтервал перевірки email-ів в секундах (за замовчуванням: 60)
- `WEBSOCKET_NOTIFY_URL` - автоматично встановлюється на `http://backend:8000/api/v1/communications/test-notification`

## 3. Виправлення WebSocket broadcast endpoint

### Проблема
Ендпоінт `/api/v1/communications/broadcast-message` не отримував JSON тіло з POST запитів.

### Виправлення
Додано `Body(None)` для правильного отримання JSON тіла з POST запитів.

### Файли змінено
- `backend/main.py` - додано імпорт `Body` та використання `Body(None)` в ендпоінтах

## Наступні кроки

1. **Застосувати міграцію бази даних** для виправлення типу `api_id`
2. **Перезапустити контейнери** для застосування змін:
   ```bash
   docker-compose down
   docker-compose up -d --build
   ```
3. **Перевірити роботу email_imap_listener**:
   ```bash
   docker-compose logs -f email_imap_listener
   ```
4. **Перевірити створення Telegram акаунта** - помилка з api_id має зникнути

## Документація

Детальна документація по email_imap_listener: `EMAIL_LISTENER_SETUP.md`

