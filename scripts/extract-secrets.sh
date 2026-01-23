#!/bin/bash
# Скрипт для витягування значень з .env файлу для GitHub Secrets
# Використання: ./extract-secrets.sh [path-to-.env]

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
    echo "Помилка: Файл $ENV_FILE не знайдено"
    echo "Використання: $0 [path-to-.env]"
    exit 1
fi

echo "=== GitHub Secrets для додавання ==="
echo ""
echo "Скопіюйте наступні значення в GitHub Secrets:"
echo ""

# Читаємо .env файл і виводимо значення
while IFS='=' read -r key value || [ -n "$key" ]; do
    # Пропускаємо коментарі та порожні рядки
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    
    # Видаляємо пробіли
    key=$(echo "$key" | xargs)
    value=$(echo "$value" | xargs)
    
    # Видаляємо лапки якщо є
    value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
    
    # Виводимо тільки якщо значення не порожнє
    if [ -n "$value" ]; then
        echo "$key = $value"
    fi
done < "$ENV_FILE"

echo ""
echo "=== Важливі Secrets для перевірки ==="
echo ""
echo "Обов'язкові:"
echo "- SSH_PRIVATE_KEY (створіть окремо)"
echo "- SERVER_HOST"
echo "- SERVER_USER"
echo "- REPO_URL"
echo "- BACKEND_PORT (за замовчуванням: 8001)"
echo ""
echo "Перевірте, що всі значення правильно скопійовані!"

