"""
Генерація патч-файлу з Excel для оновлення страв.
Обробляє Excel файл з аркушами (категорії) та рядками (страви).
Підтримує .xlsm файли з макросами, мерджнуті комірки та динамічне знаходження header.
"""

import pandas as pd
from pathlib import Path
from typing import List, Dict, Optional
import io
import re


def find_header_row(df: pd.DataFrame) -> Optional[int]:
    """
    Знаходить рядок з заголовками (шукає ключові слова: назва, ціна, вага).
    Повертає індекс рядка або None.
    """
    keywords = ['назва', 'ціна', 'вага', 'вихід', 'страва', 'вартість', 'гр', 'кг']
    
    for idx, row in df.iterrows():
        row_str = ' '.join([str(val).lower() for val in row.values if pd.notna(val)])
        if any(keyword in row_str for keyword in keywords):
            return idx
    return None


def find_column_mapping(df: pd.DataFrame, header_row_idx: Optional[int] = None) -> tuple[Dict[str, Optional[str]], pd.DataFrame]:
    """
    Знаходить мапінг колонок на основі назв заголовків.
    Повертає tuple: (мапінг колонок, DataFrame для роботи)
    """
    if header_row_idx is not None and header_row_idx < len(df):
        headers = [str(col).strip().lower() for col in df.iloc[header_row_idx].values]
        df_work = df.iloc[header_row_idx + 1:].copy()
        df_work.columns = headers[:len(df_work.columns)]
    else:
        headers = [str(col).strip().lower() for col in df.columns]
        df_work = df.copy()
    
    mapping = {
        'name': None,
        'price': None,
        'weight': None
    }
    
    for col in headers:
        col_lower = col.lower() if isinstance(col, str) else str(col).lower()
        
        if not mapping['name'] and any(kw in col_lower for kw in ['назва', 'страва', 'блюдо']):
            mapping['name'] = col
        
        if not mapping['price'] and any(kw in col_lower for kw in ['ціна', 'вартість', 'price']):
            mapping['price'] = col
        
        if not mapping['weight'] and any(kw in col_lower for kw in ['вага', 'вихід', 'гр', 'кг', 'weight']):
            mapping['weight'] = col
    
    return mapping, df_work


def parse_price(value) -> Optional[float]:
    """Парсить ціну з різних форматів."""
    if pd.isna(value):
        return None
    
    price_str = str(value).strip()
    if not price_str or price_str == "":
        return None
    
    clean_price_str = price_str.replace(',', '.').replace(' ', '').replace('грн', '').replace('₴', '').strip()
    clean_price_str = re.sub(r'[^\d.-]', '', clean_price_str)
    
    try:
        price = float(clean_price_str)
        return price if price > 0 else None
    except (ValueError, TypeError):
        return None


def parse_weight(value) -> Optional[str]:
    """Парсить вагу, може бути числом або рядком типу '150/75'."""
    if pd.isna(value):
        return None
    
    weight_str = str(value).strip()
    if not weight_str or weight_str == "":
        return None
    
    return weight_str


def generate_menu_patch_from_excel(file_path: Path) -> List[Dict[str, str]]:
    """
    Генерує список даних для оновлення страв з Excel файлу.
    
    Логіка:
    - Назва аркуша = категорія
    - Динамічно знаходить header row
    - Рядки без ціни = підкатегорії
    - Рядки з ціною = страви
    
    Args:
        file_path: Шлях до Excel файлу
        
    Returns:
        Список словників з полями: name, category, subcategory, price, weight
    """
    try:
        sheets = pd.read_excel(file_path, sheet_name=None, header=None, engine='openpyxl')
    except Exception as e:
        raise ValueError(f"Не вдалося прочитати Excel файл: {e}")
    
    if not sheets:
        raise ValueError("Файл не містить жодних аркушів")
    
    final_data = []
    debug_info = []

    for sheet_name, df in sheets.items():
        if df.empty:
            continue
        
        debug_info.append(f"Аркуш '{sheet_name}': {len(df)} рядків, {len(df.columns)} колонок")
        
        # Видаляємо повністю порожні рядки
        df = df.dropna(how='all').reset_index(drop=True)
        
        if len(df) == 0:
            debug_info.append(f"  - Аркуш '{sheet_name}' порожній")
            continue
        
        # Знаходимо header row
        header_row_idx = find_header_row(df)
        
        if header_row_idx is None:
            # Якщо не знайдено header, вважаємо що дані з першого рядка
            # або використовуємо просту логіку: колонка 0 = назва, колонка 1 = ціна
            debug_info.append(f"  - Header не знайдено, використовуємо прості колонки")
            mapping = {'name': 0, 'price': 1, 'weight': 2 if len(df.columns) > 2 else None}
            df_work = df
        else:
            # Знаходимо мапінг колонок
            result = find_column_mapping(df, header_row_idx)
            mapping = result[0]
            df_work = result[1]
            debug_info.append(f"  - Header знайдено в рядку {header_row_idx + 1}, мапінг: {mapping}")
        
        if not mapping.get('name'):
            # Якщо не знайдено колонку з назвою, пропускаємо аркуш
            debug_info.append(f"  - Не знайдено колонку з назвою страви")
            continue
        
        name_col = mapping['name']
        price_col = mapping.get('price')
        weight_col = mapping.get('weight')
        
        # Назва аркуша = категорія
        current_category = sheet_name
        current_subcategory = sheet_name
        
        items_in_sheet = 0
        
        for idx, row in df_work.iterrows():
            # Отримуємо назву
            try:
                if isinstance(name_col, (int, str)) and name_col in row.index:
                    name_value = row[name_col]
                elif isinstance(name_col, int) and name_col < len(row):
                    name_value = row.iloc[name_col]
                else:
                    continue
            except (KeyError, IndexError):
                continue
            
            if pd.isna(name_value) or str(name_value).strip() == "":
                continue
            
            name = str(name_value).strip()
            
            # Отримуємо ціну
            price = None
            if price_col is not None:
                try:
                    if price_col in row.index:
                        price = parse_price(row[price_col])
                    elif isinstance(price_col, int) and price_col < len(row):
                        price = parse_price(row.iloc[price_col])
                except (KeyError, IndexError):
                    pass
            
            # Якщо немає ціни - це підкатегорія
            if price is None:
                current_subcategory = name
                continue
            
            # Отримуємо вагу (опціонально)
            weight = None
            if weight_col is not None:
                try:
                    if weight_col in row.index:
                        weight = parse_weight(row[weight_col])
                    elif isinstance(weight_col, int) and weight_col < len(row):
                        weight = parse_weight(row.iloc[weight_col])
                except (KeyError, IndexError):
                    pass
            
            # Додаємо страву
            item_data = {
                "name": name,
                "category": current_category,
                "subcategory": current_subcategory,
                "price": f"{price:.2f}"
            }
            
            if weight:
                item_data["weight"] = str(weight)
            
            final_data.append(item_data)
            items_in_sheet += 1
        
        debug_info.append(f"  - Знайдено страв: {items_in_sheet}")

    if not final_data:
        debug_msg = "Не знайдено жодної страви в Excel файлі.\n\n"
        debug_msg += "Діагностика:\n" + "\n".join(debug_info)
        debug_msg += "\n\nПеревірте:\n"
        debug_msg += "1. Файл містить аркуші з даними\n"
        debug_msg += "2. Є колонка з назвою (назва, страва, блюдо)\n"
        debug_msg += "3. Є колонка з ціною (ціна, вартість)\n"
        debug_msg += "4. Рядки без ціни вважаються підкатегоріями\n"
        raise ValueError(debug_msg)

    return final_data


def generate_menu_patch_csv(excel_file_path: Path, output_csv_path: Path = None) -> str:
    """
    Генерує CSV файл з патчем для оновлення страв.
    
    Args:
        excel_file_path: Шлях до Excel файлу
        output_csv_path: Шлях для збереження CSV (опціонально)
        
    Returns:
        Шлях до створеного CSV файлу або рядок з CSV вмістом
    """
    data = generate_menu_patch_from_excel(excel_file_path)
    
    if not data:
        raise ValueError("Не знайдено жодної страви в Excel файлі")
    
    df = pd.DataFrame(data)
    
    if output_csv_path:
        df.to_csv(output_csv_path, index=False, encoding='utf-8-sig')
        return str(output_csv_path)
    else:
        # Повертаємо CSV як рядок
        buffer = io.StringIO()
        df.to_csv(buffer, index=False, encoding='utf-8-sig')
        return buffer.getvalue()


if __name__ == "__main__":
    # Тестування
    import sys
    if len(sys.argv) > 1:
        excel_path = Path(sys.argv[1])
        output_path = Path("menu_patch.csv")
        
        csv_content = generate_menu_patch_csv(excel_path, output_path)
        print(f"Створено файл: {output_path}")
        
        df = pd.DataFrame(generate_menu_patch_from_excel(excel_path))
        print(f"\nЗнайдено {len(df)} страв")
        print("\nПерші 10 рядків:")
        print(df.head(10).to_string(index=False))
    else:
        print("Використання: python menu_patch_generator.py path/to/file.xlsx")

