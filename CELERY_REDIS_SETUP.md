# Налаштування Celery та Redis для Deployment

## 📋 GitHub Secrets - що потрібно додати

Для роботи Celery та Redis потрібно додати наступні секрети в GitHub репозиторії:

### Обов'язкові секрети (вже мають бути):
1. **POSTGRES_USER** - користувач PostgreSQL
2. **POSTGRES_PASSWORD** - пароль PostgreSQL
3. **POSTGRES_DB** - назва бази даних
4. **DATABASE_URL** - повний URL підключення до БД (наприклад: `postgresql://user:password@host:port/dbname`)
5. **JWT_SECRET** - секретний ключ для JWT токенів
6. **SSH_PRIVATE_KEY** - приватний SSH ключ для деплою
7. **SERVER_HOST** - IP адреса або домен сервера
8. **SERVER_USER** - користувач для SSH підключення

### Нові секрети для Celery/Redis:

#### 9. **REDIS_URL** ⭐ ОБОВ'ЯЗКОВО
- **Опис:** URL для підключення до Redis
- **Формат:** `redis://localhost:6379/0` (для локального) або `redis://redis:6379/0` (для Docker)
- **Приклад для production:** `redis://crm_translations_redis:6379/0`
- **Як отримати:** 
  - Для Docker: використовуйте `redis://crm_translations_redis:6379/0` (назва контейнера)
  - Для зовнішнього Redis: `redis://user:password@host:port/db`

#### 10. **FRONTEND_URL** (опціонально, але рекомендовано)
- **Опис:** URL фронтенду для CORS та WebSocket
- **Приклад:** `https://tlumaczeniamt.com.pl` або `http://localhost:5173`

#### 11. **OPENAI_API_KEY** (опціонально)
- **Опис:** API ключ для OpenAI (якщо використовується)
- **Формат:** `sk-...`

#### 12. **ENCRYPTION_KEY** (опціонально)
- **Опис:** Ключ для шифрування даних
- **Формат:** Будь-який рядок (рекомендовано 32+ символів)

#### 13. **WHATSAPP_API_TOKEN** (опціонально)
- **Опис:** Token для WhatsApp Business API
- **Формат:** Токен від Meta

#### 14. **WHATSAPP_PHONE_NUMBER_ID** (опціонально)
- **Опис:** ID телефонного номера WhatsApp
- **Формат:** Числовий ID

#### 15. **STRIPE_SECRET_KEY** (опціонально)
- **Опис:** Секретний ключ Stripe
- **Формат:** `sk_live_...` або `sk_test_...`

#### 16. **STRIPE_PUBLISHABLE_KEY** (опціонально)
- **Опис:** Публічний ключ Stripe
- **Формат:** `pk_live_...` або `pk_test_...`

---

## 🔧 Як додати секрети в GitHub

1. Перейдіть в репозиторій на GitHub
2. Відкрийте **Settings** → **Secrets and variables** → **Actions**
3. Натисніть **New repository secret**
4. Додайте кожен secret з назвою та значенням

### Мінімальний набір для Celery/Redis:

**Обов'язково додайте:**
- `REDIS_URL` = `redis://crm_translations_redis:6379/0`

**Рекомендовано додати:**
- `FRONTEND_URL` = ваш домен або `http://localhost:5173` для dev

---

## 🐳 Docker Compose зміни

### Додані сервіси:

1. **Redis** (`crm_translations_redis`)
   - Порт: `6379:6379`
   - Volume: `redis_data` (зберігає дані)
   - Healthcheck: автоматична перевірка

2. **Celery Worker** (`crm_translations_celery_worker`)
   - Обробляє асинхронні задачі
   - Concurrency: 4 воркери
   - Залежить від Redis та PostgreSQL

3. **Celery Beat** (`crm_translations_celery_beat`)
   - Планувальник періодичних задач
   - Залежить від Redis та PostgreSQL

### Автоматичне створення контейнерів

При деплої через GitHub Actions контейнери будуть:
- ✅ Автоматично створені при першому деплої
- ✅ Підключені до існуючих при наступних деплоях
- ✅ Зберігатимуть дані Redis в volume `redis_data`

---

## 📝 Приклад .env файлу на сервері

Після деплою на сервері буде створено/оновлено `.env` файл з такими змінними:

```env
POSTGRES_USER=translator
POSTGRES_PASSWORD=your_password
POSTGRES_DB=crm_db
DATABASE_URL=postgresql://translator:password@postgres:5432/crm_db
JWT_SECRET=your_jwt_secret
APP_ENV=prod
REDIS_URL=redis://crm_translations_redis:6379/0
FRONTEND_URL=https://tlumaczeniamt.com.pl
OPENAI_API_KEY=sk-...
ENCRYPTION_KEY=your_encryption_key
WHATSAPP_API_TOKEN=your_token
WHATSAPP_PHONE_NUMBER_ID=123456789
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## ✅ Перевірка після деплою

Після успішного деплою перевірте:

```bash
# Перевірити статус контейнерів
docker ps | grep crm_translations

# Має бути видно:
# - crm_translations_redis
# - crm_translations_celery_worker
# - crm_translations_celery_beat
# - crm_translations_backend
# - crm_translations_postgres

# Перевірити логи Celery worker
docker logs crm_translations_celery_worker

# Перевірити логи Celery beat
docker logs crm_translations_celery_beat

# Перевірити підключення до Redis
docker exec crm_translations_redis redis-cli ping
# Має повернути: PONG
```

---

## 🚨 Troubleshooting

### Redis не підключається
- Перевірте `REDIS_URL` в секретах
- Для Docker використовуйте назву контейнера: `redis://crm_translations_redis:6379/0`
- Перевірте що Redis контейнер запущений: `docker ps | grep redis`

### Celery worker не запускається
- Перевірте логи: `docker logs crm_translations_celery_worker`
- Переконайтеся що Redis доступний
- Перевірте що всі змінні середовища передані

### Celery beat не запускається
- Перевірте логи: `docker logs crm_translations_celery_beat`
- Переконайтеся що Redis доступний
- Перевірте що worker запущений

---

## 📚 Додаткова інформація

- [Celery Documentation](https://docs.celeryproject.org/)
- [Redis Documentation](https://redis.io/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

