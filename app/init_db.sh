#!/bin/bash
# Скрипт для ініціалізації бази даних

echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Створення БД (якщо не існує)
PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h postgres -U ${POSTGRES_USER:-postgres} -d postgres -c "SELECT 1 FROM pg_database WHERE datname = '${POSTGRES_DB:-cafe_db}'" | grep -q 1 || \
PGPASSWORD=${POSTGRES_PASSWORD:-postgres} psql -h postgres -U ${POSTGRES_USER:-postgres} -d postgres -c "CREATE DATABASE ${POSTGRES_DB:-cafe_db};"

echo "Database ${POSTGRES_DB:-cafe_db} is ready!"

