# Шляхи для деплою

## Основна директорія деплою

**`/opt/translations`** - основна директорія для деплою проєкту

## Структура директорій

```
/opt/translations/
├── translations-crm/          # Код проєкту
│   ├── .env                   # Файл з налаштуваннями
│   ├── backend/               # Backend код
│   ├── frontend/              # Frontend код
│   ├── docker-compose.production.yml
│   └── ...
└── backups/                   # Бекапи бази даних
    └── crm_db_backup_*.sql.gz
```

## Важливі шляхи

- **Код проєкту:** `/opt/translations/translations-crm/`
- **.env файл:** `/opt/translations/translations-crm/.env`
- **Бекапи БД:** `/opt/translations/backups/`
- **Docker volumes:** Зберігаються в Docker (не видаляються при cleanup)

## Створення директорій на сервері

```bash
# Створити основну директорію
sudo mkdir -p /opt/translations
sudo mkdir -p /opt/translations/backups

# Визначити поточного користувача
CURRENT_USER=$(whoami)
echo "Current user: $CURRENT_USER"

# Встановити права доступу (використовуємо поточного користувача)
CURRENT_USER=$(whoami)
sudo chown -R $CURRENT_USER:$CURRENT_USER /opt/translations
sudo chmod -R 755 /opt/translations

# Або якщо знаєте ім'я користувача (наприклад, t):
# sudo chown -R t:t /opt/translations
```

## Перевірка

```bash
# Перевірити структуру
ls -la /opt/translations/
ls -la /opt/translations/translations-crm/
ls -la /opt/translations/backups/
```

