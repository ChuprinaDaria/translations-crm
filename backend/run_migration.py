#!/usr/bin/env python3
"""
Скрипт для виконання міграції бази даних для виправлення типу api_id
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Додаємо поточну директорію до шляху
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Отримуємо DATABASE_URL з змінних оточення
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://translator:traslatorini2025@localhost:5434/crm_db")

def run_migration():
    """Виконує міграцію для виправлення типу api_id."""
    print("=" * 60)
    print("Виконання міграції: fix_telegram_accounts_api_id_type")
    print("=" * 60)
    
    # Шлях до файлу міграції
    migration_file = Path(__file__).parent.parent / "database" / "migrations" / "fix_telegram_accounts_api_id_type.sql"
    
    if not migration_file.exists():
        print(f"❌ Помилка: Файл міграції не знайдено: {migration_file}")
        return False
    
    try:
        # Підключаємося до бази даних
        print(f"Підключення до бази даних...")
        engine = create_engine(DATABASE_URL)
        
        with engine.connect() as conn:
            # Читаємо та виконуємо міграцію
            print(f"Читання міграції з {migration_file}...")
            with open(migration_file, 'r', encoding='utf-8') as f:
                migration_sql = f.read()
            
            print("Виконання міграції...")
            conn.execute(text(migration_sql))
            conn.commit()
            
        print("✅ Міграція успішно виконана!")
        return True
        
    except Exception as e:
        print(f"❌ Помилка при виконанні міграції: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

