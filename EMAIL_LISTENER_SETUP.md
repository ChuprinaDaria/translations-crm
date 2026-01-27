# Налаштування Email IMAP Listener

## Опис

`email_imap_listener.py` - це сервіс, який автоматично перевіряє email-и з менеджерських SMTP акаунтів та імпортує їх в inbox CRM системи.

## Автоматичний запуск

Сервіс автоматично запускається при старті Docker контейнерів через `docker-compose.yml` та `docker-compose.production.yml`.

### Запуск вручну

Якщо потрібно запустити сервіс вручну:

```bash
# В Docker контейнері
docker-compose exec email_imap_listener python email_imap_listener.py

# Або локально (якщо не використовуєте Docker)
cd translations-crm/backend
python email_imap_listener.py
```

### Перевірка статусу

```bash
# Перевірити логи
docker-compose logs email_imap_listener

# Перевірити статус контейнера
docker-compose ps email_imap_listener
```

## Налаштування

### Змінні оточення

- `DATABASE_URL` - URL підключення до бази даних (автоматично з docker-compose)
- `WEBSOCKET_NOTIFY_URL` - URL для сповіщення через WebSocket (за замовчуванням: `http://backend:8000/api/v1/communications/test-notification`)
- `EMAIL_CHECK_INTERVAL` - Інтервал перевірки email-ів в секундах (за замовчуванням: 60)

### Налаштування менеджерських SMTP акаунтів

1. Перейдіть в налаштування CRM → Email
2. Додайте менеджерський SMTP акаунт з наступними параметрами:
   - Email адреса
   - SMTP host та port
   - IMAP host та port (якщо відрізняється від SMTP)
   - SMTP user та password
   - Встановіть `is_active = true`

3. Сервіс автоматично почне перевіряти email-и для всіх активних акаунтів

## Як це працює

1. Сервіс перевіряє всі активні менеджерські SMTP акаунти кожні 60 секунд (або інший інтервал)
2. Для кожного акаунта підключається до IMAP сервера та шукає непрочитані листи
3. Для кожного нового листа:
   - Створює або знаходить розмову в базі даних
   - Зберігає повідомлення
   - Відправляє сповіщення через WebSocket для оновлення inbox в реальному часі
4. Позначає листи як прочитані в IMAP

## Усунення проблем

### Email-и не приходять в inbox

1. Перевірте, чи запущений сервіс:
   ```bash
   docker-compose ps email_imap_listener
   ```

2. Перевірте логи на помилки:
   ```bash
   docker-compose logs email_imap_listener
   ```

3. Перевірте, чи є активні менеджерські SMTP акаунти:
   ```sql
   SELECT * FROM manager_smtp_accounts WHERE is_active = true;
   ```

4. Перевірте правильність IMAP налаштувань (host, port, credentials)

### Помилки підключення до IMAP

- Перевірте, чи правильні IMAP host та port
- Перевірте, чи правильні credentials (username, password)
- Перевірте, чи дозволено підключення з вашого IP (якщо є обмеження)

### WebSocket сповіщення не працюють

- Перевірте, чи запущений backend сервіс
- Перевірте, чи правильний `WEBSOCKET_NOTIFY_URL` (має бути `http://backend:8000/...` в Docker)
- Перевірте логи backend на помилки

## Моніторинг

Для моніторингу роботи сервісу можна використовувати:

```bash
# Відстеження логів в реальному часі
docker-compose logs -f email_imap_listener

# Перевірка статистики
docker stats email_imap_listener
```

