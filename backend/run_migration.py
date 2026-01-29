#!/usr/bin/env python3
"""
Скрипт для виконання міграцій бази даних
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Додаємо поточну директорію до шляху
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Отримуємо DATABASE_URL з змінних оточення
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://translator:traslatorini2025@localhost:5434/crm_db")

# Список міграцій для виконання (в порядку виконання)
MIGRATIONS = [
    "ensure_manager_smtp_accounts_table.sql",
    "fix_telegram_accounts_api_id_type.sql",
    "fix_telegram_accounts_id_type.sql",  # Виправлення типу id з UUID на INTEGER
]

def run_migration(migration_file: Path):
    """Виконує одну міграцію."""
    if not migration_file.exists():
        print(f"❌ Помилка: Файл міграції не знайдено: {migration_file}")
        return False
    
    try:
        print(f"📄 Читання міграції: {migration_file.name}...")
        with open(migration_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        print(f"⚙️  Виконання міграції...")
        engine = create_engine(DATABASE_URL)
        with engine.connect() as conn:
            conn.execute(text(migration_sql))
            conn.commit()
        
        print(f"✅ Міграція {migration_file.name} успішно виконана!")
        return True
        
    except Exception as e:
        print(f"❌ Помилка при виконанні міграції {migration_file.name}: {e}")
        import traceback
        traceback.print_exc()
        return False

def run_all_migrations():
    """Виконує всі міграції."""
    print("=" * 60)
    print("Виконання міграцій бази даних")
    print("=" * 60)
    
    migrations_dir = Path(__file__).parent.parent / "database" / "migrations"
    
    if not migrations_dir.exists():
        print(f"❌ Помилка: Директорія міграцій не знайдена: {migrations_dir}")
        return False
    
    print(f"📂 Директорія міграцій: {migrations_dir}")
    print(f"📋 Знайдено {len(MIGRATIONS)} міграцій для виконання\n")
    
    success_count = 0
    for migration_name in MIGRATIONS:
        migration_file = migrations_dir / migration_name
        print(f"\n{'='*60}")
        print(f"Міграція: {migration_name}")
        print(f"{'='*60}")
        
        if run_migration(migration_file):
            success_count += 1
        else:
            print(f"⚠️  Пропущено міграцію {migration_name}")
    
    print(f"\n{'='*60}")
    print(f"Результат: {success_count}/{len(MIGRATIONS)} міграцій виконано успішно")
    print(f"{'='*60}")
    
    return success_count == len(MIGRATIONS)

if __name__ == "__main__":
    success = run_all_migrations()
    sys.exit(0 if success else 1)

