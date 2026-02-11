# Інструкції по запуску міграцій на сервері

## Міграція: Додавання organization_id до inpost_settings

### Варіант 1: Через Python скрипт (рекомендовано)

```bash
# SSH на сервер
ssh user@server

# Перейти в директорію проекту
cd /opt/translations/translations-crm

# Запустити міграцію через Docker
docker-compose exec backend python backend/apply_organization_id_migration.py

# Або якщо контейнер називається інакше
docker exec -it crm_translations_backend python /app/backend/apply_organization_id_migration.py
```

### Варіант 2: Через psql напряму

```bash
# SSH на сервер
ssh user@server

# Підключитися до PostgreSQL контейнера
docker-compose exec postgres psql -U crm_user -d crm_translations

# Або якщо PostgreSQL запущений локально
psql -U crm_user -d crm_translations -h localhost

# Виконати міграцію
\i /opt/translations/translations-crm/database/migrations/add_organization_id_to_inpost_settings.sql

# Або скопіювати SQL і виконати вручну:
ALTER TABLE inpost_settings 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100);

COMMENT ON COLUMN inpost_settings.organization_id IS 'InPost Organization ID for ShipX API';
```

### Варіант 3: Через docker exec з psql

```bash
# SSH на сервер
ssh user@server

# Виконати SQL напряму через docker exec
docker-compose exec postgres psql -U crm_user -d crm_translations -c "
ALTER TABLE inpost_settings 
ADD COLUMN IF NOT EXISTS organization_id VARCHAR(100);

COMMENT ON COLUMN inpost_settings.organization_id IS 'InPost Organization ID for ShipX API';
"
```

### Варіант 4: Через run_all_migrations.py (всі міграції)

```bash
# SSH на сервер
ssh user@server

cd /opt/translations/translations-crm

# Запустити всі міграції
docker-compose exec backend python backend/run_all_migrations.py
```

## Перевірка результату

Після виконання міграції перевірте, чи колонка додана:

```bash
# Підключитися до бази
docker-compose exec postgres psql -U crm_user -d crm_translations

# Перевірити структуру таблиці
\d inpost_settings

# Або через SQL
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inpost_settings' 
AND column_name = 'organization_id';
```

## Якщо виникли проблеми

1. **Permission denied**: Переконайтеся, що ви маєте права на виконання команд
2. **Table not found**: Переконайтеся, що таблиця `inpost_settings` існує
3. **Column already exists**: Це нормально, міграція використовує `IF NOT EXISTS`

## Після міграції

Після успішного виконання міграції:
1. Перезапустіть backend (якщо потрібно):
   ```bash
   docker-compose restart backend
   ```
2. Перевірте, що поле `organization_id` з'явилося в налаштуваннях InPost на фронтенді

