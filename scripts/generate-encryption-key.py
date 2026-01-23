#!/usr/bin/env python3
"""
Скрипт для генерації Fernet encryption key
Використання: python3 generate-encryption-key.py
"""

try:
    from cryptography.fernet import Fernet
    
    # Генеруємо новий ключ
    key = Fernet.generate_key()
    key_string = key.decode('utf-8')
    
    print("=" * 60)
    print("ENCRYPTION_KEY для GitHub Secrets:")
    print("=" * 60)
    print(key_string)
    print("=" * 60)
    print(f"\nДовжина ключа: {len(key_string)} символів")
    print("\nСкопіюйте цей ключ і додайте його в GitHub Secrets як ENCRYPTION_KEY")
    print("=" * 60)
    
except ImportError:
    print("Помилка: Бібліотека cryptography не встановлена")
    print("Встановіть її командою: pip install cryptography")
    exit(1)

