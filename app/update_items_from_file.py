"""
Оновлення існуючих страв в меню з CSV/Excel файлу.

Формат файлу (CSV):
- Заголовок (опціонально): name,category,subcategory,price
- Дані: Назва страви,Категорія,Підкатегорія,Ціна

Приклад:
name,category,subcategory,price
Ніжне філе слабосоленого лосося з олію та кріпом,Холодні рибні закуски,Холодні рибні закуски,865.00

Формат файлу (Excel):
- Перший рядок: заголовок (опціонально)
- Колонки: A=назва, B=категорія, C=підкатегорія, D=ціна

Скрипт:
1. Порівнює страви по назві (нечутливо до регістру)
2. Створює категорії/підкатегорії, якщо їх немає
3. Оновлює ціну та підкатегорію страви

Використання:
    python update_items_from_file.py path/to/items.csv
    python update_items_from_file.py path/to/items.xlsx
"""

import csv
import re
import sys
from pathlib import Path
from typing import Optional
from decimal import Decimal

try:
    import openpyxl
    HAS_OPENPYXL = True
except ImportError:
    HAS_OPENPYXL = False
    print("Увага: openpyxl не встановлено. Excel файли не підтримуються.")
    print("Встановіть: pip install openpyxl")

from db import SessionLocal
import models
import crud


def parse_price(price_str: str | float | int) -> Optional[float]:
    """
    Перетворює рядок типу "865,00" або "865.00" або число на float.
    """
    if price_str is None:
        return None
    
    if isinstance(price_str, (int, float)):
        return float(price_str)
    
    if not isinstance(price_str, str):
        return None
    
    # Забираємо пробіли
    cleaned = price_str.strip()
    if not cleaned:
        return None
    
    # Замінюємо кому на крапку
    cleaned = cleaned.replace(",", ".")
    
    # Забираємо все крім цифр, крапки та мінуса
    cleaned = re.sub(r"[^\d.-]", "", cleaned)
    
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def normalize_name(name: str) -> str:
    """
    Нормалізує назву для порівняння (нижній регістр, видаляє зайві пробіли).
    """
    if not name:
        return ""
    return " ".join(name.lower().split())


def parse_csv(filepath: Path) -> list[dict]:
    """
    Парсить CSV файл.
    Повертає список словників:
    {
        'name': 'Назва страви',
        'category': 'Категорія',
        'subcategory': 'Підкатегорія',
        'price': 865.0
    }
    """
    items = []
    
    with filepath.open("r", encoding="utf-8") as f:
        reader = csv.reader(f)
        rows = list(reader)
    
    # Перевіряємо, чи є заголовок
    header_row = None
    start_idx = 0
    if rows and any(col.lower() in ["name", "назва", "назва страви"] for col in rows[0]):
        header_row = [col.lower() for col in rows[0]]
        start_idx = 1
    
    for i, row in enumerate(rows[start_idx:], start=start_idx + 1):
        if not any(row):
            continue
        
        # Якщо є заголовок, визначаємо індекси колонок
        if header_row:
            name_idx = None
            category_idx = None
            subcategory_idx = None
            price_idx = None
            
            for j, header in enumerate(header_row):
                if "name" in header or "назва" in header:
                    name_idx = j
                elif "category" in header or "категорія" in header:
                    category_idx = j
                elif "subcategory" in header or "підкатегорія" in header or "подкатегория" in header:
                    subcategory_idx = j
                elif "price" in header or "ціна" in header or "цена" in header:
                    price_idx = j
            
            item = {
                "name": row[name_idx].strip() if name_idx is not None and len(row) > name_idx else "",
                "category": row[category_idx].strip() if category_idx is not None and len(row) > category_idx else "",
                "subcategory": row[subcategory_idx].strip() if subcategory_idx is not None and len(row) > subcategory_idx else "",
                "price": parse_price(row[price_idx]) if price_idx is not None and len(row) > price_idx else None,
            }
        else:
            # Без заголовка: очікуємо формат name,category,subcategory,price
            item = {
                "name": row[0].strip() if len(row) > 0 else "",
                "category": row[1].strip() if len(row) > 1 else "",
                "subcategory": row[2].strip() if len(row) > 2 else "",
                "price": parse_price(row[3]) if len(row) > 3 else None,
            }
        
        if item["name"]:
            items.append(item)
        else:
            print(f"Пропущено рядок {i}: відсутня назва страви")
    
    return items


def parse_excel(filepath: Path) -> list[dict]:
    """
    Парсить Excel файл.
    Очікує формат:
    - Перший рядок: опціональний заголовок
    - Колонки: A=назва, B=категорія, C=підкатегорія, D=ціна
    """
    if not HAS_OPENPYXL:
        raise ImportError("openpyxl не встановлено. Встановіть: pip install openpyxl")
    
    items = []
    workbook = openpyxl.load_workbook(filepath, data_only=True)
    sheet = workbook.active
    
    # Перевіряємо, чи є заголовок
    header_row = sheet[1]
    has_header = any(cell.value and ("name" in str(cell.value).lower() or "назва" in str(cell.value).lower()) 
                     for cell in header_row)
    
    start_row = 2 if has_header else 1
    
    for row in sheet.iter_rows(min_row=start_row, values_only=True):
        if not row[0] or not str(row[0]).strip():
            continue
        
        item = {
            "name": str(row[0]).strip() if row[0] else "",
            "category": str(row[1]).strip() if row[1] else "",
            "subcategory": str(row[2]).strip() if row[2] else "",
            "price": parse_price(row[3]) if row[3] is not None else None,
        }
        
        if item["name"]:
            items.append(item)
    
    return items


def get_or_create_category(db, name: str) -> models.Category:
    """Знаходить або створює категорію."""
    if not name:
        return None
    
    category = db.query(models.Category).filter_by(name=name).first()
    if not category:
        category = models.Category(name=name)
        db.add(category)
        db.flush()
    return category


def get_or_create_subcategory(db, category: models.Category, name: str) -> Optional[models.Subcategory]:
    """Знаходить або створює підкатегорію."""
    if not name or not category:
        return None
    
    subcategory = (
        db.query(models.Subcategory)
        .filter_by(name=name, category_id=category.id)
        .first()
    )
    if not subcategory:
        subcategory = models.Subcategory(name=name, category_id=category.id)
        db.add(subcategory)
        db.flush()
    return subcategory


def find_item_by_name(db, name: str) -> Optional[models.Item]:
    """
    Знаходить страву по назві (нечутливо до регістру).
    """
    normalized_search = normalize_name(name)
    
    items = db.query(models.Item).all()
    for item in items:
        if normalize_name(item.name) == normalized_search:
            return item
    
    return None


def update_items_from_data(items_data: list[dict], dry_run: bool = False, db_session = None) -> dict:
    """
    Оновлює страви з даних (список словників).
    Може використовуватися з API.
    
    Args:
        items_data: Список словників з полями name, category, subcategory, price
        dry_run: Чи виконувати в режимі перевірки
        db_session: Опціональна сесія БД (якщо None, створюється нова)
        
    Returns:
        Статистика оновлення
    """
    stats = {
        'found': 0,
        'updated': 0,
        'created_categories': 0,
        'created_subcategories': 0,
        'not_found': [],
        'errors': []
    }
    
    if not items_data:
        return stats
    
    # Використовуємо надану сесію або створюємо нову
    if db_session:
        db = db_session
        should_close = False
    else:
        db = SessionLocal()
        should_close = True
    
    try:
        categories_cache = {}
        subcategories_cache = {}
        
        for item_data in items_data:
            try:
                name = item_data.get('name', '').strip()
                if not name:
                    continue
                    
                category_name = item_data.get('category', '').strip()
                subcategory_name = item_data.get('subcategory', '').strip()
                price_str = item_data.get('price')
                
                # Парсимо ціну
                price = None
                if price_str:
                    price = parse_price(price_str)
                
                # Знаходимо страву
                item = find_item_by_name(db, name)
                
                if not item:
                    stats['not_found'].append(name)
                    continue
                
                stats['found'] += 1
                
                # Оновлюємо категорію та підкатегорію
                category = None
                subcategory = None
                
                if category_name:
                    # Знаходимо або створюємо категорію
                    if category_name not in categories_cache:
                        category = get_or_create_category(db, category_name)
                        categories_cache[category_name] = category
                        if category and category.id:
                            stats['created_categories'] += 1
                    else:
                        category = categories_cache[category_name]
                    
                    # Знаходимо або створюємо підкатегорію
                    if category and subcategory_name:
                        cache_key = f"{category_name}::{subcategory_name}"
                        if cache_key not in subcategories_cache:
                            subcategory = get_or_create_subcategory(db, category, subcategory_name)
                            subcategories_cache[cache_key] = subcategory
                            if subcategory and subcategory.id:
                                stats['created_subcategories'] += 1
                        else:
                            subcategory = subcategories_cache[cache_key]
                
                # Оновлюємо дані страви
                changes = []
                
                if price is not None and price != item.price:
                    old_price = item.price
                    if not dry_run:
                        item.price = price
                    changes.append(f"ціна: {old_price} → {price}")
                
                if subcategory and item.subcategory_id != subcategory.id:
                    old_sub = item.subcategory.name if item.subcategory else "без підкатегорії"
                    if not dry_run:
                        item.subcategory_id = subcategory.id
                    changes.append(f"підкатегорія: {old_sub} → {subcategory.name}")
                
                if changes:
                    stats['updated'] += 1
                    
            except Exception as e:
                error_msg = f"Помилка при обробці '{item_data.get('name', 'невідома страва')}': {e}"
                stats['errors'].append(error_msg)
        
        if not dry_run:
            db.commit()
        
    except Exception as e:
        if not dry_run:
            db.rollback()
        raise e
    finally:
        if should_close:
            db.close()
    
    return stats


def update_items_from_file(filepath: Path, dry_run: bool = False) -> dict:
    """
    Оновлює страви з файлу.
    
    Повертає статистику:
    {
        'found': кількість знайдених страв,
        'updated': кількість оновлених страв,
        'created_categories': кількість створених категорій,
        'created_subcategories': кількість створених підкатегорій,
        'not_found': список не знайдених страв,
        'errors': список помилок
    }
    """
    stats = {
        'found': 0,
        'updated': 0,
        'created_categories': 0,
        'created_subcategories': 0,
        'not_found': [],
        'errors': []
    }
    
    # Парсимо файл
    if filepath.suffix.lower() == '.csv':
        items_data = parse_csv(filepath)
    elif filepath.suffix.lower() in ['.xlsx', '.xls']:
        items_data = parse_excel(filepath)
    else:
        raise ValueError(f"Непідтримуваний формат файлу: {filepath.suffix}")
    
    print(f"\n📄 Знайдено {len(items_data)} страв у файлі\n")
    
    if dry_run:
        print("🔍 РЕЖИМ ПЕРЕВІРКИ (dry-run) - зміни не будуть збережені\n")
    
    db = SessionLocal()
    try:
        categories_cache = {}
        subcategories_cache = {}
        
        for item_data in items_data:
            try:
                name = item_data['name']
                category_name = item_data.get('category', '').strip()
                subcategory_name = item_data.get('subcategory', '').strip()
                price = item_data.get('price')
                
                # Знаходимо страву
                item = find_item_by_name(db, name)
                
                if not item:
                    stats['not_found'].append(name)
                    print(f"❌ Не знайдено: {name}")
                    continue
                
                stats['found'] += 1
                
                # Оновлюємо категорію та підкатегорію
                category = None
                subcategory = None
                
                if category_name:
                    # Знаходимо або створюємо категорію
                    if category_name not in categories_cache:
                        category = get_or_create_category(db, category_name)
                        categories_cache[category_name] = category
                        if category and category.id:
                            stats['created_categories'] += 1
                            if not dry_run:
                                print(f"➕ Створено категорію: {category_name}")
                    else:
                        category = categories_cache[category_name]
                    
                    # Знаходимо або створюємо підкатегорію
                    if category and subcategory_name:
                        cache_key = f"{category_name}::{subcategory_name}"
                        if cache_key not in subcategories_cache:
                            subcategory = get_or_create_subcategory(db, category, subcategory_name)
                            subcategories_cache[cache_key] = subcategory
                            if subcategory and subcategory.id:
                                stats['created_subcategories'] += 1
                                if not dry_run:
                                    print(f"➕ Створено підкатегорію: {subcategory_name} (в категорії {category_name})")
                        else:
                            subcategory = subcategories_cache[cache_key]
                
                # Оновлюємо дані страви
                changes = []
                
                if price is not None and price != item.price:
                    old_price = item.price
                    if not dry_run:
                        item.price = price
                    changes.append(f"ціна: {old_price} → {price}")
                
                if subcategory and item.subcategory_id != subcategory.id:
                    old_sub = item.subcategory.name if item.subcategory else "без підкатегорії"
                    if not dry_run:
                        item.subcategory_id = subcategory.id
                    changes.append(f"підкатегорія: {old_sub} → {subcategory.name}")
                
                if changes:
                    stats['updated'] += 1
                    print(f"✅ {name}")
                    for change in changes:
                        print(f"   - {change}")
                else:
                    print(f"⏭️  {name} (без змін)")
                    
            except Exception as e:
                error_msg = f"Помилка при обробці '{item_data.get('name', 'невідома страва')}': {e}"
                stats['errors'].append(error_msg)
                print(f"❌ {error_msg}")
        
        if not dry_run:
            db.commit()
            print(f"\n💾 Зміни збережено в базу даних")
        else:
            db.rollback()
            print(f"\n⚠️  Зміни НЕ збережено (dry-run режим)")
        
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
    
    return stats


def main():
    if len(sys.argv) < 2:
        print("Використання:")
        print("  python update_items_from_file.py <файл.csv|файл.xlsx> [--dry-run]")
        print("\nПриклади:")
        print("  python update_items_from_file.py items.csv")
        print("  python update_items_from_file.py items.xlsx --dry-run")
        print("\nФормат CSV файлу:")
        print("  name,category,subcategory,price")
        print("  Назва страви,Категорія,Підкатегорія,865.00")
        sys.exit(1)
    
    filepath = Path(sys.argv[1])
    dry_run = '--dry-run' in sys.argv or '-n' in sys.argv
    
    if not filepath.exists():
        print(f"❌ Файл не знайдено: {filepath}")
        sys.exit(1)
    
    try:
        stats = update_items_from_file(filepath, dry_run=dry_run)
        
        print("\n" + "="*60)
        print("📊 СТАТИСТИКА:")
        print("="*60)
        print(f"Знайдено страв в файлі: {stats['found']}")
        print(f"Оновлено страв: {stats['updated']}")
        print(f"Створено категорій: {stats['created_categories']}")
        print(f"Створено підкатегорій: {stats['created_subcategories']}")
        
        if stats['not_found']:
            print(f"\n⚠️  Не знайдено страв ({len(stats['not_found'])}):")
            for name in stats['not_found'][:10]:  # Показуємо перші 10
                print(f"  - {name}")
            if len(stats['not_found']) > 10:
                print(f"  ... та ще {len(stats['not_found']) - 10} страв")
        
        if stats['errors']:
            print(f"\n❌ Помилки ({len(stats['errors'])}):")
            for error in stats['errors'][:5]:  # Показуємо перші 5
                print(f"  - {error}")
            if len(stats['errors']) > 5:
                print(f"  ... та ще {len(stats['errors']) - 5} помилок")
        
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ Критична помилка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

