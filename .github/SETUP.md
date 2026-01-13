# Налаштування CI/CD Pipeline

## Крок 1: Створення SSH ключа

На сервері виконайте:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions_key
```

Скопіюйте **приватний** ключ:
```bash
cat ~/.ssh/github_actions_key
```

## Крок 2: Додавання SSH ключа до GitHub Secrets

1. Перейдіть в GitHub репозиторій
2. Settings → Secrets and variables → Actions
3. Натисніть "New repository secret"
4. Додайте наступні secrets:

### SSH_PRIVATE_KEY
```
-----BEGIN OPENSSH PRIVATE KEY-----
[вміст приватного ключа]
-----END OPENSSH PRIVATE KEY-----
```

### SSH_HOST
```
ваш-сервер.com
або
123.45.67.89
```

### SSH_USER
```
deploy
(або ваш користувач для деплою)
```

### SSH_PORT
```
22
(стандартний порт SSH, або ваш кастомний порт)
```

### POSTGRES_USER
```
postgres
(користувач PostgreSQL, опціонально - за замовчуванням postgres)
```

### POSTGRES_PASSWORD
```
ваш-пароль-postgres
(пароль для PostgreSQL)
```

### POSTGRES_DB
```
cafe_db
(назва бази даних, опціонально - за замовчуванням cafe_db)
```

### JWT_SECRET
```
ваш-секретний-ключ-jwt
(секретний ключ для JWT токенів, обов'язково!)
```

### APP_ENV
```
production
(середовище: production, staging, dev - опціонально, за замовчуванням production)
```

## Крок 3: Налаштування сервера

### Додавання публічного ключа до authorized_keys

На сервері:
```bash
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Налаштування sudo для docker restart nginx

Додайте права користувачу `deploy` на перезапуск nginx контейнера:

```bash
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/docker restart whiteout_nginx" | sudo tee -a /etc/sudoers.d/deploy-docker
```

Це дозволить workflow перезапускати nginx контейнер без введення пароля.

**Примітка:** Якщо ваш користувач має інше ім'я (не `deploy`), замініть його в команді.

## Крок 4: Перевірка

1. Зробіть commit і push в main гілку
2. Перейдіть в GitHub → Actions
3. Перевірте що workflow запустився і виконався успішно

## Troubleshooting

### Помилка "Permission denied (publickey)"
- Перевірте що SSH_PRIVATE_KEY правильний
- Перевірте що публічний ключ додано до authorized_keys
- Перевірте права доступу: `chmod 600 ~/.ssh/authorized_keys`

### Помилка "docker-compose: command not found"
- Встановіть docker-compose на сервері
- Або використовуйте `docker compose` (без дефісу) в workflow

### Помилка "nginx: command not found"
- Перевірте шлях до nginx: `which nginx`
- Оновіть команду в workflow на правильний шлях

### Помилка "cd /opt/cafe-crm: No such file or directory"
- Перевірте що директорія `/opt/cafe-crm` існує на сервері
- Або змініть шлях в workflow на правильний

