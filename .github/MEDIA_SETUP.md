# Налаштування MEDIA_ROOT та MEDIA_URL в GitHub Secrets

## Крок 1: Додати змінні в GitHub Secrets

1. Перейдіть в репозиторій: https://github.com/ChuprinaDaria/translations-crm
2. Натисніть **Settings** → **Secrets and variables** → **Actions**
3. Натисніть **New repository secret**
4. Додайте два секрети:

### Secret 1: MEDIA_ROOT
- **Name:** `MEDIA_ROOT`
- **Value:** `/app/media`
- **Description:** Внутрішній шлях у контейнері, куди пишуться файли

### Secret 2: MEDIA_URL
- **Name:** `MEDIA_URL`
- **Value:** `/media/`
- **Description:** Префікс, який фронтенд додаватиме до посилань

## Крок 2: Перевірка конфігурації

Після додавання секретів, вони автоматично передадуться в Docker через:
- `docker-compose.yml` - для локальної розробки
- `docker-compose.production.yml` - для production
- `.github/workflows/deploy.yml` - для автоматичного деплою

## Крок 3: Перезапуск контейнерів

Після додавання секретів, перезапустіть контейнери:

```bash
docker-compose down
docker-compose up -d
```

Або для production:

```bash
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

## Перевірка

Перевірте, що змінні передаються правильно:

```bash
docker exec crm_translations_backend env | grep MEDIA
```

Має показати:
```
MEDIA_ROOT=/app/media
MEDIA_URL=/media/
```

