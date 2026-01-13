# CI/CD Pipeline Documentation

## Огляд

Цей GitHub Actions workflow автоматизує процес деплою при пуші в гілку `main`.

## Що робить pipeline

1. **Lint & Test Job**
   - Перевіряє TypeScript код на помилки
   - Білдить frontend проект
   - Перевіряє наявність build артефактів

2. **Deploy Job**
   - Деплоїть код на сервер через SSH
   - Перезапускає Docker контейнери
   - Копіює build файли на сервер
   - Перезавантажує parent nginx
   - Виконує health check

## Налаштування Secrets

Для роботи pipeline потрібно налаштувати наступні secrets в GitHub репозиторії:

1. **SSH_PRIVATE_KEY** - приватний SSH ключ для доступу до сервера
2. **SERVER_HOST** - IP адреса або домен сервера
3. **SERVER_USER** - користувач для SSH підключення
4. **DEPLOY_PATH** - шлях до директорії проекту на сервері (наприклад: `/home/dziga/dzyga-catering.com.ua/crm`)

## Як налаштувати Secrets

1. Перейдіть в Settings → Secrets and variables → Actions
2. Натисніть "New repository secret"
3. Додайте кожен secret з назвою та значенням

## Структура деплою

```
GitHub Actions → SSH на сервер → Git pull → Docker rebuild → Nginx reload
```

## Troubleshooting

### Помилка SSH підключення
- Перевірте що SSH_PRIVATE_KEY правильний
- Перевірте що SERVER_USER має доступ до сервера
- Перевірте firewall налаштування

### Помилка Docker
- Перевірте що docker-compose.yml існує на сервері
- Перевірте що Docker запущений на сервері
- Перевірте логи: `docker-compose logs`

### Помилка Nginx
- Перевірте що nginx-production.conf правильний
- Перевірте права доступу для reload: `sudo nginx -t`

