#!/bin/bash
# Скрипт для очищення старих Docker images (без видалення volumes)
# Використання: ./cleanup-docker.sh

set -e

echo "Starting Docker cleanup..."
echo ""

# Видаляємо dangling images (невикористовувані)
echo "Removing dangling images..."
docker image prune -f

# Видаляємо невикористовувані images (старіші за 7 днів)
echo "Removing unused images older than 7 days..."
docker image prune -a -f --filter "until=168h"

# Показуємо залишкові images
echo ""
echo "Remaining images:"
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"

# Показуємо використання диска
echo ""
echo "Disk usage:"
docker system df

echo ""
echo "Cleanup finished successfully!"
echo ""
echo "Note: Volumes were NOT removed to preserve data."

