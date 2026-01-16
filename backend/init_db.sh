#!/bin/bash
# Скрипт для ініціалізації бази даних

echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Створення БД (якщо не існує)
PGPASSWORD=${POSTGRES_PASSWORD:-traslatorini2025} psql -h postgres -U ${POSTGRES_USER:-translator} -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB:-crm_db}'" | grep -q 1 || \
PGPASSWORD=${POSTGRES_PASSWORD:-traslatorini2025} psql -h postgres -U ${POSTGRES_USER:-translator} -d postgres -c "CREATE DATABASE ${POSTGRES_DB:-crm_db};"

echo "Database ${POSTGRES_DB:-crm_db} is ready!"

