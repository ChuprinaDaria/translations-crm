#!/usr/bin/env python3
"""
Міграція: додавання полів booking_terms та gallery_photos до таблиці kps
"""
import sys
sys.path.insert(0, '/home/dchuprina/кафе/app')

from db import engine
from sqlalchemy import text, inspect

def main():
    inspector = inspect(engine)
    
    # Перевіряємо чи таблиця існує
    if 'kps' not in inspector.get_table_names():
        print("❌ Таблиця 'kps' не знайдена!")
        return
    
    columns = [col['name'] for col in inspector.get_columns('kps')]
    print(f"Поточні колонки в таблиці kps: {len(columns)}")
    
    with engine.begin() as conn:
        # Додаємо booking_terms
        if 'booking_terms' not in columns:
            print('Додаю колонку booking_terms...')
            conn.execute(text('ALTER TABLE kps ADD COLUMN booking_terms TEXT'))
            print('✓ booking_terms додано')
        else:
            print('✓ booking_terms вже існує')
        
        # Додаємо gallery_photos
        if 'gallery_photos' not in columns:
            print('Додаю колонку gallery_photos...')
            # Для PostgreSQL
            try:
                conn.execute(text('ALTER TABLE kps ADD COLUMN gallery_photos JSON'))
                print('✓ gallery_photos додано (PostgreSQL JSON)')
            except Exception as e:
                # Для SQLite або інших БД
                try:
                    conn.execute(text('ALTER TABLE kps ADD COLUMN gallery_photos TEXT'))
                    print('✓ gallery_photos додано (TEXT)')
                except Exception as e2:
                    print(f'❌ Помилка додавання gallery_photos: {e2}')
        else:
            print('✓ gallery_photos вже існує')
    
    print('\n✅ Міграція завершена успішно!')

if __name__ == '__main__':
    main()

