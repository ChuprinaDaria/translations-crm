#!/bin/bash
# Скрипт для ручного створення бекапу бази даних
# Використання: ./backup-db.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/../backups"
ENV_FILE="$PROJECT_DIR/.env"

# Створюємо директорію для бекапів
mkdir -p "$BACKUP_DIR"

# Перевіряємо наявність .env файлу
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Завантажуємо змінні з .env
source "$ENV_FILE"

# Перевіряємо що контейнер запущений
if ! docker ps | grep -q crm_translations_postgres; then
    echo "Error: PostgreSQL container is not running!"
    echo "Start it with: docker-compose -f docker-compose.production.yml up -d"
    exit 1
fi

# Створюємо бекап
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/crm_db_backup_$TIMESTAMP.sql"

echo "Creating database backup..."
docker exec crm_translations_postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_FILE"

# Перевіряємо що бекап створено
if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
    echo "Error: Backup file is empty or not created!"
    exit 1
fi

# Стискаємо бекап
echo "Compressing backup..."
gzip "$BACKUP_FILE"
BACKUP_FILE_GZ="$BACKUP_FILE.gz"

echo "Backup created: $BACKUP_FILE_GZ"

# Видаляємо старі бекапи (залишаємо тільки останній)
echo "Removing old backups..."
cd "$BACKUP_DIR"
if ls crm_db_backup_*.sql.gz 1> /dev/null 2>&1; then
    # Сортуємо за часом модифікації, залишаємо тільки найновіший
    ls -t crm_db_backup_*.sql.gz | tail -n +2 | xargs -r rm -f
    echo "Old backups removed, keeping only the latest backup"
else
    echo "No old backups to remove"
fi

# Показуємо розмір бекапу
echo ""
echo "Backup details:"
ls -lh "$BACKUP_FILE_GZ"
du -h "$BACKUP_FILE_GZ"
echo ""
echo "Backup completed successfully!"

