# Підсумок налаштування деплою

## Що було створено

### 1. GitHub Actions Workflow
**Файл:** `.github/workflows/deploy.yml`

Автоматичний workflow, який:
- ✅ Перевіряє код та білд перед деплоєм
- ✅ Тестує Python imports
- ✅ Білдить frontend
- ✅ Деплоїть на сервер при push в `main`
- ✅ Виконує health check після деплою
- ✅ Використовує дані з існуючого .env файлу на сервері (якщо він є)

### 2. Автоматичний бекап бази даних
**Файл:** `.github/workflows/backup-database.yml`

- ✅ Запускається 1 числа кожного місяця о 2:00 UTC
- ✅ Створює бекап PostgreSQL бази даних
- ✅ Стискає бекап (gzip)
- ✅ **Видаляє старі бекапи** (залишає тільки останній)
  - ✅ Зберігає в `/opt/translations/backups/`
- ✅ Можна запустити вручну через GitHub Actions UI

### 3. Очищення Docker images
**Файл:** `.github/workflows/cleanup-images.yml`

- ✅ Запускається кожну неділю о 3:00 UTC
- ✅ Видаляє dangling images
- ✅ Видаляє невикористовувані images старіші за 7 днів
- ✅ **НЕ видаляє volumes** (дані зберігаються)
- ✅ Можна запустити вручну через GitHub Actions UI

### 4. Production Docker Compose
**Файл:** `docker-compose.production.yml`

Конфігурація з альтернативними портами:
- PostgreSQL: `5435` (внутрішній 5432)
- Backend: `8001` (внутрішній 8000)
- Nginx: `8082` (внутрішній 80)

### 5. Nginx Configuration
**Файл:** `nginx-production.conf`

Оновлена конфігурація для домену `tlumaczeniamt.com.pl`

### 6. Скрипти для ручного використання
- **`scripts/backup-db.sh`** - Ручний бекап бази даних
- **`scripts/cleanup-docker.sh`** - Ручне очищення Docker images
- **`scripts/extract-secrets.sh`** - Витягування значень з .env

### 7. Документація
- **`GITHUB_SECRETS.md`** - Список всіх необхідних GitHub Secrets
- **`DEPLOYMENT.md`** - Детальна інструкція з деплою
- **`SETUP_SUMMARY.md`** - Цей файл

## Що потрібно зробити

### Крок 1: Налаштувати GitHub Secrets

1. Перейдіть в Settings → Secrets and variables → Actions вашого репозиторію
2. Додайте всі secrets з файлу `GITHUB_SECRETS.md`

**Обов'язкові secrets:**
- `SSH_PRIVATE_KEY` - SSH ключ для доступу до сервера
- `SERVER_HOST` - IP або домен сервера
- `SERVER_USER` - Користувач SSH
- `REPO_URL` - URL репозиторію
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `DATABASE_URL` - Повний URL підключення
- `JWT_SECRET` - Секретний ключ для JWT

**Опціональні secrets:**
Всі інші (SMTP, Telegram, Stripe, Instagram, тощо) - додайте тільки якщо використовуєте відповідні функції.

**Важливо:** Якщо у вас вже є `.env` файл на сервері з даними (рядки 1-7), workflow буде використовувати їх та оновлювати тільки значення з GitHub Secrets.

### Крок 2: Підготувати сервер

```bash
# На сервері
# 1. Перевірити вільні порти
netstat -tuln | grep -E "5435|8001|8082"

# 2. Переконатися що Docker встановлений
docker --version
docker-compose --version

# 3. Створити директорію для деплою та бекапів
sudo mkdir -p /opt/translations
sudo mkdir -p /opt/translations/backups

# Встановити права доступу
CURRENT_USER=$(whoami)
sudo chown -R $CURRENT_USER:$CURRENT_USER /opt/translations
sudo chmod -R 755 /opt/translations
```

### Крок 3: Налаштувати SSH доступ

```bash
# На локальній машині
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_deploy

# Скопіювати приватний ключ в GitHub Secret SSH_PRIVATE_KEY
cat ~/.ssh/github_actions_deploy

# Додати публічний ключ на сервер
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub USER@SERVER_HOST
```

### Крок 4: Перший деплой

```bash
# Зробіть push в main гілку
git push origin main
```

Перевірте виконання в розділі **Actions** репозиторію.

## Автоматичні завдання

### Бекап бази даних
- **Розклад:** 1 числа кожного місяця о 2:00 UTC
- **Що робить:**
  - Створює бекап PostgreSQL бази даних
  - Стискає бекап (gzip)
  - **Видаляє старі бекапи** (залишає тільки останній)
  - Зберігає в `/opt/translations/backups/`

### Очищення Docker images
- **Розклад:** Кожну неділю о 3:00 UTC
- **Що робить:**
  - Видаляє dangling images
  - Видаляє невикористовувані images старіші за 7 днів
  - **НЕ видаляє volumes** (дані зберігаються)

Обидва workflows можна запустити вручну через GitHub Actions UI.

## Структура файлів

```
translations-crm/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # GitHub Actions workflow для деплою
│       ├── backup-database.yml     # Автоматичний бекап БД (щомісяця)
│       └── cleanup-images.yml      # Очищення images (щотижня)
├── docker-compose.production.yml   # Production Docker Compose
├── nginx-production.conf           # Nginx конфігурація
├── GITHUB_SECRETS.md               # Список secrets
├── DEPLOYMENT.md                   # Детальна інструкція
├── SETUP_SUMMARY.md                # Цей файл
└── scripts/
    ├── backup-db.sh                # Ручний бекап БД
    ├── cleanup-docker.sh           # Ручне очищення images
    └── extract-secrets.sh          # Витягування secrets з .env
```

## Важливі примітки

⚠️ **Не комітьте .env файли в git!** Вони вже в .gitignore

⚠️ **Перевірте порти** - якщо 5435, 8001, або 8082 зайняті, змініть їх в `docker-compose.production.yml`

⚠️ **DATABASE_URL** має використовувати ім'я контейнера: `postgresql://user:pass@crm_translations_postgres:5432/dbname`

⚠️ **Опціональні secrets** можна залишити порожніми, якщо функціонал не використовується

⚠️ **Бекапи БД** зберігаються на сервері, старі автоматично видаляються

⚠️ **Volumes не видаляються** при очищенні images - дані зберігаються

## Перевірка після деплою

1. Backend API: `http://SERVER_IP:8001/docs`
2. Frontend: `http://SERVER_IP:8082`
3. Health check виконується автоматично в workflow
4. Бекапи: `/opt/translations/backups/`

## Troubleshooting

Якщо щось не працює:

1. Перевірте логи workflow в GitHub Actions
2. Перевірте логи на сервері: `docker-compose -f docker-compose.production.yml logs`
3. Перевірте що всі secrets додані
4. Перевірте SSH доступ: `ssh USER@SERVER_HOST`
5. Перевірте що порти вільні
6. Перевірте бекапи: `ls -lh /opt/translations/backups/`

Детальніше в `DEPLOYMENT.md`

## Відкат (Rollback)

Якщо потрібно відкатити до попередньої версії:

```bash
# На сервері
cd /opt/translations
git checkout PREVIOUS_COMMIT_HASH
cd translations-crm
docker-compose -f docker-compose.production.yml up -d --build
```

## Відновлення з бекапу

```bash
# На сервері
cd /opt/translations/backups
LATEST_BACKUP=$(ls -t crm_db_backup_*.sql.gz | head -1)
gunzip -c $LATEST_BACKUP | docker exec -i crm_translations_postgres psql -U $POSTGRES_USER $POSTGRES_DB
```
