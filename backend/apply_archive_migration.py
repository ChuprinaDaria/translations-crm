#!/usr/bin/env python3
"""
Скрипт для застосування міграції is_archived та last_message_at
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from core.config import settings

def check_column_exists(engine, table_name: str, column_name: str) -> bool:
    """Перевірити, чи існує колонка в таблиці"""
    inspector = inspect(engine)
    columns = [col['name'] for col in inspector.get_columns(table_name)]
    return column_name in columns

def apply_archive_migration():
    """Застосувати міграцію для is_archived та last_message_at"""
    print("🚀 Перевірка та застосування міграції для архівації діалогів...")
    
    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    
    # Перевірити, чи існують колонки
    is_archived_exists = check_column_exists(engine, 'communications_conversations', 'is_archived')
    last_message_at_exists = check_column_exists(engine, 'communications_conversations', 'last_message_at')
    
    print(f"\n📊 Статус колонок:")
    print(f"   is_archived: {'✅ Існує' if is_archived_exists else '❌ Відсутня'}")
    print(f"   last_message_at: {'✅ Існує' if last_message_at_exists else '❌ Відсутня'}")
    
    if is_archived_exists and last_message_at_exists:
        print("\n✅ Міграція вже застосована! Колонки існують.")
        return True
    
    # Read migration file
    base_dir = Path(__file__).parent.parent
    migration_file = base_dir / "database" / "migrations" / "migrations_add_archive_fields.sql"
    
    if not migration_file.exists():
        print(f"❌ Файл міграції не знайдено: {migration_file}")
        return False
    
    print(f"\n📄 Читання міграції: {migration_file.name}")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Execute migration
        print("⚙️  Застосування міграції...")
        with engine.begin() as conn:
            conn.execute(text(sql_content))
        
        # Перевірити результат
        is_archived_exists_after = check_column_exists(engine, 'communications_conversations', 'is_archived')
        last_message_at_exists_after = check_column_exists(engine, 'communications_conversations', 'last_message_at')
        
        print(f"\n📊 Статус після міграції:")
        print(f"   is_archived: {'✅ Створено' if is_archived_exists_after else '❌ Помилка'}")
        print(f"   last_message_at: {'✅ Створено' if last_message_at_exists_after else '❌ Помилка'}")
        
        if is_archived_exists_after and last_message_at_exists_after:
            print("\n✅ Міграція успішно застосована!")
            return True
        else:
            print("\n❌ Помилка: не всі колонки були створені")
            return False
        
    except Exception as e:
        error_msg = str(e)
        # Деякі помилки очікувані (наприклад, колонка вже існує)
        if any(ignore in error_msg.lower() for ignore in [
            'already exists', 'duplicate', 'does not exist',
            'relation already exists', 'column already exists',
        ]):
            print(f"⚠️  Попередження: {error_msg[:200]}... (можливо вже застосовано)")
            return True
        else:
            print(f"❌ Помилка при застосуванні міграції: {error_msg}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = apply_archive_migration()
    sys.exit(0 if success else 1)

