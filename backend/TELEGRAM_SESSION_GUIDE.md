# Інструкція: Як отримати Telegram Session String

## Крок 1: Отримати API Credentials

1. Перейдіть на https://my.telegram.org/apps
2. Увійдіть зі своїм Telegram акаунтом
3. Натисніть "Create application" або використайте існуючу
4. Скопіюйте:
   - **API ID** (число, наприклад: `12345678`)
   - **API Hash** (рядок, наприклад: `abcdef1234567890abcdef1234567890`)

## Крок 2: Запустити скрипт генерації

```bash
cd backend
source venv/bin/activate  # або віртуальне середовище з telethon
python3 generate_telegram_session.py
```

## Крок 3: Ввести дані

Скрипт попросить ввести:
1. **API ID** - число з my.telegram.org
2. **API Hash** - рядок з my.telegram.org
3. **Номер телефону** - у форматі `+380...`
4. **Код підтвердження** - код, який прийде в Telegram
5. **Пароль 2FA** (якщо встановлено) - пароль двофакторної аутентифікації

## Крок 4: Скопіювати Session String

Після успішної авторизації скрипт виведе session string, який потрібно скопіювати.

Приклад:
```
1BVtsOMwBu5...
```

## Крок 5: Додати в CRM

1. Перейдіть в **Налаштування → Telegram**
2. Розділ **"Telegram акаунти для відправки КП"**
3. Натисніть **"Додати акаунт"**
4. Заповніть:
   - **Назва акаунта** (наприклад: "Менеджер Іван")
   - **Телефон акаунта** (опційно)
   - **API ID** (опційно, якщо відрізняється від глобального)
   - **API Hash** (опційно, якщо відрізняється від глобального)
   - **Session string** (обов'язково) - вставте згенерований рядок
5. Натисніть **"Додати акаунт"**

## Важливо

- ✅ Session string можна використовувати для одного акаунта
- ✅ Якщо акаунт має власні API credentials, вкажіть їх при додаванні
- ✅ Якщо не вказати API credentials для акаунта, використовуватимуться глобальні налаштування
- ⚠️ Зберігайте session string в безпеці - він дає доступ до вашого Telegram акаунта
- ⚠️ Якщо зміните пароль Telegram або видалите сесію, потрібно згенерувати новий session string

## Приклад використання

```bash
# 1. Активувати віртуальне середовище
cd /home/dchuprina/crm\ translation/translations-crm/backend
source venv/bin/activate

# 2. Запустити скрипт
python3 generate_telegram_session.py

# 3. Дотримуватися інструкцій на екрані
```

## Troubleshooting

### Помилка: "ModuleNotFoundError: No module named 'telethon'"
```bash
pip install telethon
```

### Помилка: "Invalid phone number"
- Переконайтеся, що номер починається з `+`
- Формат: `+380123456789`

### Помилка: "Invalid code"
- Код дійсний 5 хвилин
- Введіть код без пробілів
- Якщо не прийшов - перевірте номер телефону

### Помилка: "Password required"
- У вас встановлено 2FA (двофакторну аутентифікацію)
- Введіть пароль 2FA, коли скрипт попросить

## Альтернативний спосіб (через Python інтерактивно)

```python
from telethon import TelegramClient
from telethon.sessions import StringSession

api_id = 12345678  # Ваш API ID
api_hash = 'abcdef1234567890abcdef1234567890'  # Ваш API Hash

session = StringSession()
client = TelegramClient(session, api_id, api_hash)

async def main():
    await client.connect()
    if not await client.is_user_authorized():
        await client.send_code_request('+380123456789')  # Ваш номер
        code = input('Введіть код: ')
        await client.sign_in('+380123456789', code)
    
    print("Session string:")
    print(client.session.save())
    await client.disconnect()

import asyncio
asyncio.run(main())
```

