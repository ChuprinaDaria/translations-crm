# GitHub Secrets для деплою

Цей документ містить список всіх GitHub Secrets, які необхідно налаштувати в репозиторії для автоматичного деплою.

## Як додати Secrets в GitHub

1. Перейдіть в Settings репозиторію
2. Виберіть Secrets and variables → Actions
3. Натисніть "New repository secret"
4. Додайте кожен secret з наведеного нижче списку

## Обов'язкові Secrets

### Сервер та доступ

- **`SSH_PRIVATE_KEY`** - Приватний SSH ключ для доступу до сервера
- **`SERVER_HOST`** - IP адреса або домен сервера (наприклад: `tlumaczeniamt.com.pl` або IP)
- **`SERVER_USER`** - Ім'я користувача для SSH (наприклад: `root` або `deploy`)
- **`REPO_URL`** - URL репозиторію для клонування (наприклад: `https://github.com/username/repo.git` або з SSH)
- **`BACKEND_PORT`** - Порт для backend (за замовчуванням: `8001`)

### База даних

- **`POSTGRES_USER`** - Користувач PostgreSQL
- **`POSTGRES_PASSWORD`** - Пароль PostgreSQL
- **`POSTGRES_DB`** - Назва бази даних
- **`DATABASE_URL`** - Повний URL підключення до БД (наприклад: `postgresql://user:password@crm_translations_postgres:5432/dbname`)

### Безпека

- **`JWT_SECRET`** - Секретний ключ для JWT токенів (використовуйте довгий випадковий рядок)
- **`ENCRYPTION_KEY`** - Fernet ключ для шифрування даних (~44 символи, згенеруйте через `scripts/generate-encryption-key.py`)

### Опціональні Secrets

- **`REDIS_URL`** - URL підключення до Redis (наприклад: `redis://localhost:6379/0`)
- **`FRONTEND_URL`** - URL фронтенду (наприклад: `https://tlumaczeniamt.com.pl`)
- **`OPENAI_API_KEY`** - API ключ OpenAI (якщо використовується функціонал з OpenAI)

## Налаштування через фронтенд

⚠️ **Важливо:** Наступні налаштування **НЕ** потрібно додавати в GitHub Secrets, вони налаштовуються через фронтенд в Settings:

- **SMTP** (Email) - налаштовується в Settings → SMTP
- **Telegram** - налаштовується в Settings → Telegram
- **WhatsApp** - налаштовується в Settings → WhatsApp
- **Instagram** - налаштовується в Settings → Instagram
- **Facebook** - налаштовується в Settings → Facebook
- **Stripe** - налаштовується в Settings → Stripe
- **InPost** - налаштовується в Settings → InPost

Всі ці налаштування зберігаються в базі даних в таблиці `app_settings` і не потребують GitHub Secrets.

## Приклад значень

```env
POSTGRES_USER=translator
POSTGRES_PASSWORD=your_password_here
POSTGRES_DB=crm_db
DATABASE_URL=postgresql://translator:password@crm_translations_postgres:5432/crm_db
JWT_SECRET=your_jwt_secret_here
APP_ENV=prod
FRONTEND_URL=https://tlumaczeniamt.com.pl
REDIS_URL=redis://localhost:6379/0
```

## Важливо

⚠️ **НЕ додавайте `.env` файл в git!** Всі чутливі дані мають бути тільки в GitHub Secrets.

⚠️ Переконайтеся, що SSH ключ має права доступу до сервера та може виконувати команди Docker.

⚠️ Після додавання всіх secrets, перевірте що workflow може успішно підключитися до сервера.

⚠️ **Налаштування сервісів** (SMTP, Telegram, WhatsApp, тощо) додаються через фронтенд після деплою, не через GitHub Secrets.

## Перевірка

Після налаштування всіх secrets, зробіть push в `main` гілку і перевірте виконання workflow в розділі Actions репозиторію.

## Генерація ENCRYPTION_KEY

Для генерації ENCRYPTION_KEY використайте один з методів:

```bash
# Варіант 1: Python скрипт
cd translations-crm/scripts
python3 generate-encryption-key.py

# Варіант 2: Bash скрипт
cd translations-crm/scripts
chmod +x generate-encryption-key.sh
./generate-encryption-key.sh

# Варіант 3: Пряма команда Python
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
