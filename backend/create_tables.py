#!/usr/bin/env python3
"""
Скрипт для створення всіх таблиць в базі даних.
Використовується для ручного створення таблиць, якщо автоматичне створення не спрацювало.
"""
from db import Base, engine
import models  # noqa: F401 - імпортуємо всі моделі для реєстрації з Base

def create_all_tables():
    """Створює всі таблиці в базі даних."""
    try:
        print("Creating all database tables...")
        Base.metadata.create_all(bind=engine)
        print("✓ All tables created successfully!")
        
        # Перевіряємо, чи створена таблиця clients
        from sqlalchemy import inspect
        insp = inspect(engine)
        tables = insp.get_table_names()
        
        if "clients" in tables:
            print("✓ Table 'clients' exists")
        else:
            print("✗ Table 'clients' was NOT created!")
            
        print(f"\nTotal tables in database: {len(tables)}")
        print("Tables:", ", ".join(sorted(tables)))
        
    except Exception as e:
        print(f"✗ Error creating tables: {e}")
        raise

if __name__ == "__main__":
    create_all_tables()

