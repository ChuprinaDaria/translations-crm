#!/usr/bin/env python3
"""
Скрипт для генерації Telegram session string для використання в CRM системі.

Інструкція:
1. Отримайте API credentials на https://my.telegram.org/apps
   - Зайдіть на сайт зі своїм Telegram акаунтом
   - Створіть новий додаток
   - Скопіюйте api_id та api_hash

2. Запустіть цей скрипт:
   python3 generate_telegram_session.py

3. Введіть дані:
   - api_id (число)
   - api_hash (рядок)
   - номер телефону (у форматі +380...)
   - код підтвердження з Telegram
   - пароль 2FA (якщо встановлено)

4. Скопіюйте згенерований session string та використайте його в налаштуваннях CRM.
"""

import asyncio
from telethon import TelegramClient
from telethon.sessions import StringSession


async def generate_session_string():
    """Генерує session string для Telegram акаунта."""
    
    print("=" * 60)
    print("Генерація Telegram Session String для CRM")
    print("=" * 60)
    print()
    
    # Отримуємо API credentials
    print("Крок 1: Введіть API credentials")
    print("(Отримайте їх на https://my.telegram.org/apps)")
    print()
    
    api_id = input("API ID (число): ").strip()
    if not api_id.isdigit():
        print("❌ Помилка: API ID має бути числом")
        return
    
    api_hash = input("API Hash (рядок): ").strip()
    if not api_hash:
        print("❌ Помилка: API Hash не може бути порожнім")
        return
    
    # Отримуємо номер телефону
    print()
    print("Крок 2: Введіть номер телефону")
    phone = input("Номер телефону (формат: +380...): ").strip()
    if not phone.startswith('+'):
        print("⚠️  Попередження: номер має починатися з '+'")
    
    # Створюємо клієнта
    print()
    print("Крок 3: Підключення до Telegram...")
    print("(Вам прийде код підтвердження в Telegram)")
    print()
    
    # Використовуємо StringSession для збереження сесії
    session = StringSession()
    client = TelegramClient(session, int(api_id), api_hash)
    
    try:
        await client.connect()
        
        if not await client.is_user_authorized():
            print("Авторизація...")
            await client.send_code_request(phone)
            
            code = input("Введіть код з Telegram: ").strip()
            
            try:
                await client.sign_in(phone, code)
            except Exception as e:
                # Можливо потрібен пароль 2FA
                if "password" in str(e).lower() or "two" in str(e).lower():
                    password = input("Введіть пароль 2FA: ").strip()
                    await client.sign_in(password=password)
                else:
                    raise
        
        # Отримуємо session string
        session_string = client.session.save()
        
        print()
        print("=" * 60)
        print("✅ Session string успішно згенеровано!")
        print("=" * 60)
        print()
        print("📋 Скопіюйте цей session string:")
        print()
        print(session_string)
        print()
        print("=" * 60)
        print()
        print("💡 Інструкція:")
        print("1. Скопіюйте session string вище")
        print("2. Перейдіть в налаштування CRM → Telegram")
        print("3. Додайте новий Telegram акаунт")
        print("4. Вставте session string в поле 'Session string'")
        print("5. (Опційно) Вкажіть api_id та api_hash для цього акаунта")
        print()
        
        # Зберігаємо також в файл для зручності
        filename = f"telegram_session_{phone.replace('+', '').replace(' ', '')}.txt"
        with open(filename, 'w') as f:
            f.write(f"Phone: {phone}\n")
            f.write(f"API ID: {api_id}\n")
            f.write(f"API Hash: {api_hash}\n")
            f.write(f"Session String:\n{session_string}\n")
        
        print(f"💾 Session string також збережено в файл: {filename}")
        print()
        
    except Exception as e:
        print()
        print("❌ Помилка при генерації session string:")
        print(f"   {str(e)}")
        print()
        print("💡 Перевірте:")
        print("   - Правильність API credentials")
        print("   - Правильність номера телефону")
        print("   - Наявність інтернет-з'єднання")
        print()
    finally:
        await client.disconnect()


if __name__ == "__main__":
    try:
        asyncio.run(generate_session_string())
    except KeyboardInterrupt:
        print("\n\n⚠️  Скасовано користувачем")
    except Exception as e:
        print(f"\n❌ Критична помилка: {e}")

