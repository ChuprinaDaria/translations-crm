"""
Імпорт меню з CSV-файлу Dzyga в базу даних.

1. Парсимо CSV (експорт з Excel-файлу `Загальне_меню_Dzyga_2025 --3.xlsm`).
2. Для кожного запису:
   - створюємо / знаходимо категорію (`categories`)
   - створюємо / знаходимо підкатегорію (`subcategories`)
   - створюємо страву (`items`)

Скрипт запускається окремо від бекенда:

    cd /home/dchuprina/кафе/app
    python import_menu_csv.py "../Загальне_меню_Dzyga_2025 --3.csv"
"""

import csv
import re
import sys
from decimal import Decimal
from pathlib import Path

from db import SessionLocal
import models


def parse_price(price_str: str) -> Decimal | None:
    """
    Перетворює рядок типу "865,00 грн." на Decimal(865.00).
    """
    if not price_str or price_str.strip() == "":
        return None

    # Забираємо все крім цифр і коми
    cleaned = re.sub(r"[^\d,]", "", price_str)
    if not cleaned:
        return None

    # Міняємо кому на крапку
    cleaned = cleaned.replace(",", ".")
    try:
        return Decimal(cleaned)
    except Exception:
        return None


def parse_weight(weight_str: str) -> int | None:
    """
    Перетворює "150/80" на 150 (беремо перше число) або "100" на 100.
    """
    if not weight_str or weight_str.strip() == "":
        return None

    match = re.search(r"\d+", weight_str)
    if match:
        return int(match.group())
    return None


def parse_menu_csv(filepath: Path) -> list[dict]:
    """
    Парсить CSV файл меню і повертає список словників:
    {
        'category': 'Холодні закуски',
        'subcategory': 'Холодні рибні закуски',
        'name': 'Ніжне філе слабосоленого лосося...',
        'weight': 150,
        'price': Decimal('865.00'),
        'allergens': '🍯 Мед та продукти з нього'
    }
    """
    items: list[dict] = []
    current_category: str | None = None
    current_subcategory: str | None = None

    with filepath.open("r", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    i = 0
    while i < len(rows):
        row = rows[i]

        # Пропускаємо порожні рядки
        if not any(row):
            i += 1
            continue

        # Пропускаємо заголовок таблиці
        if len(row) > 1 and "№ п/п" in (row[0] or ""):
            i += 1
            continue

        # Якщо перший стовпець пустий — це категорія або підкатегорія
        if not row[0] or row[0].strip() == "":
            if len(row) > 1 and row[1].strip():
                category_name = row[1].strip()

                # Дивимося, чи наступний рядок — це заголовок таблиці
                is_table_header_next = False
                if i + 1 < len(rows):
                    next_row = rows[i + 1]
                    if len(next_row) > 1 and "№ п/п" in (next_row[0] or ""):
                        is_table_header_next = True

                if is_table_header_next:
                    # Це головна категорія
                    current_category = category_name
                    current_subcategory = None
                else:
                    # Це підкатегорія
                    current_subcategory = category_name

            i += 1
            continue

        # Якщо перший стовпець — число, це страва
        if row[0].strip().isdigit():
            item = {
                "category": current_category,
                "subcategory": current_subcategory,
                "name": row[1].strip() if len(row) > 1 and row[1] else None,
                "weight": parse_weight(row[2]) if len(row) > 2 else None,
                "price": parse_price(row[4]) if len(row) > 4 else None,
                "allergens": row[7].strip() if len(row) > 7 and row[7] else None,
            }

            if item["name"]:
                items.append(item)

        i += 1

    return items


def get_or_create_category(db, name: str) -> models.Category:
    category = db.query(models.Category).filter_by(name=name).first()
    if not category:
        category = models.Category(name=name)
        db.add(category)
        db.flush()  # отримаємо id без повного commit
    return category


def get_or_create_subcategory(db, category: models.Category, name: str | None) -> models.Subcategory | None:
    if not name:
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


def import_to_db(items: list[dict]) -> None:
    """
    Заливає страви в БД, використовуючи справжні моделі.
    """
    from collections import defaultdict

    stats = defaultdict(int)

    with SessionLocal() as db:
        categories_cache: dict[str, models.Category] = {}
        subcategories_cache: dict[str, models.Subcategory] = {}

        for item_data in items:
            try:
                cat_name = item_data.get("category") or "Інше"

                # 1. Категорія
                if cat_name not in categories_cache:
                    categories_cache[cat_name] = get_or_create_category(db, cat_name)
                category = categories_cache[cat_name]

                # 2. Підкатегорія
                subcat_name = item_data.get("subcategory")
                subcategory = None
                if subcat_name:
                    cache_key = f"{cat_name}::{subcat_name}"
                    if cache_key not in subcategories_cache:
                        subcategories_cache[cache_key] = get_or_create_subcategory(
                            db, category, subcat_name
                        )
                    subcategory = subcategories_cache[cache_key]

                # 3. Страва
                price = item_data.get("price")
                weight = item_data.get("weight")

                db_item = models.Item(
                    name=item_data["name"],
                    description=None,
                    price=float(price) if price is not None else None,
                    weight=float(weight) if weight is not None else None,
                    unit="г",  # в меню в нас грами
                    subcategory_id=subcategory.id if subcategory else None,
                    photo_url=None,
                    active=True,
                )
                db.add(db_item)
                stats["created"] += 1
            except Exception as e:
                print(f"Помилка при імпорті '{item_data.get('name')}': {e}")
                stats["errors"] += 1

        db.commit()

    print("\n✅ Імпорт завершено:")
    print(f"  Створено страв: {stats['created']}")
    if stats["errors"]:
        print(f"  Помилок: {stats['errors']}")


def main() -> None:
    if len(sys.argv) < 2:
        print("Використання: python import_menu_csv.py path/to/Загальне_меню_Dzyga_2025 --3.csv")
        sys.exit(1)

    csv_path = Path(sys.argv[1])
    if not csv_path.exists():
        print(f"Файл не знайдено: {csv_path}")
        sys.exit(1)

    items = parse_menu_csv(csv_path)
    print(f"Знайдено {len(items)} страв у файлі {csv_path.name}")

    # Виводимо перші 5 для перевірки
    for i, item in enumerate(items[:5], 1):
        print(f"{i}. {item['name']}")
        print(f"   Категорія: {item['category']}")
        if item["subcategory"]:
            print(f"   Підкатегорія: {item['subcategory']}")
        print(f"   Вага: {item['weight']} г")
        print(f"   Ціна: {item['price']} грн")
        if item["allergens"]:
            print(f"   Алергени: {item['allergens']}")
        print()

    import_to_db(items)


if __name__ == "__main__":
    main()


