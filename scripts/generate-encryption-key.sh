#!/bin/bash
# Скрипт для генерації Fernet encryption key
# Використання: ./generate-encryption-key.sh

echo "Генерування ENCRYPTION_KEY..."

# Перевіряємо чи встановлено Python
if ! command -v python3 &> /dev/null; then
    echo "Помилка: Python3 не встановлено"
    exit 1
fi

# Перевіряємо чи встановлено cryptography
if ! python3 -c "import cryptography" 2>/dev/null; then
    echo "Встановлення cryptography..."
    pip3 install cryptography --quiet
fi

# Генеруємо ключ
KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

echo ""
echo "============================================================"
echo "ENCRYPTION_KEY для GitHub Secrets:"
echo "============================================================"
echo "$KEY"
echo "============================================================"
echo ""
echo "Довжина ключа: ${#KEY} символів"
echo ""
echo "Скопіюйте цей ключ і додайте його в GitHub Secrets як ENCRYPTION_KEY"
echo "============================================================"

