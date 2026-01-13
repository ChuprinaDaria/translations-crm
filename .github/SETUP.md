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

### SERVER_HOST
```
ваш-сервер.com
або
123.45.67.89
```

### SERVER_USER
```
dziga
(або ваш користувач)
```

### DEPLOY_PATH
```
/home/dziga/dzyga-catering.com.ua/crm
(шлях до директорії проекту на сервері)
```

## Крок 3: Налаштування сервера

### Додавання публічного ключа до authorized_keys

На сервері:
```bash
cat ~/.ssh/github_actions_key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### Налаштування sudo для nginx reload (опціонально)

Якщо потрібен sudo для nginx reload, додайте в `/etc/sudoers`:
```
dziga ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
dziga ALL=(ALL) NOPASSWD: /usr/bin/systemctl reload nginx
dziga ALL=(ALL) NOPASSWD: /usr/sbin/service nginx reload
```

Або використовуйте без sudo, якщо користувач має права.

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

### Помилка "DEPLOY_PATH not found"
- Перевірте що шлях правильний
- Перевірте що директорія існує на сервері

