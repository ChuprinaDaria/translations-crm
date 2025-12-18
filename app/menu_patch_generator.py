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
import logging

logger = logging.getLogger(__name__)


def find_header_row(df: pd.DataFrame) -> Optional[int]:
    """
    Знаходить рядок з заголовками колонок.
    Шукає рядок де одночасно є "назва" (або "страва") І "ціна" (або "вартість").
    """
    for idx, row in df.iterrows():
        row_values = [str(val).lower() for val in row.values if pd.notna(val)]
        row_text = " ".join(row_values)
        
        # Шукаємо рядок де є одночасно "назва" (або "страва") І "ціна" (або "вартість")
        has_name = any(kw in row_text for kw in ['назва', 'страва', 'блюдо'])
        has_price = any(kw in row_text for kw in ['ціна', 'вартість', 'price'])
        
        if has_name and has_price:
            print(f"[EXCEL_PARSER] Header знайдено в рядку {idx + 1}: {row_values[:5]}", flush=True)
            return idx
    
    print("[EXCEL_PARSER] Header не знайдено (рядок з 'назва' та 'ціна' одночасно)", flush=True)
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
    
    # Якщо вже число (int або float від pandas)
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    
    price_str = str(value).strip()
    if not price_str or price_str == "":
        return None
    
    # Очищаємо від символів
    clean_price_str = re.sub(r'[^\d.,-]', '', price_str).replace(',', '.')
    
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
    """
    logger.info(f"[EXCEL_PARSER] Початок обробки файлу: {file_path}")
    print(f"[EXCEL_PARSER] Початок обробки файлу: {file_path}", flush=True)
    
    try:
        sheets = pd.read_excel(file_path, sheet_name=None, header=None, engine='openpyxl')
        logger.info(f"[EXCEL_PARSER] Завантажено {len(sheets)} аркушів")
        print(f"[EXCEL_PARSER] Завантажено {len(sheets)} аркушів", flush=True)
    except Exception as e:
        error_msg = f"Не вдалося прочитати Excel файл: {e}"
        print(f"[EXCEL_PARSER] ПОМИЛКА: {error_msg}")
        raise ValueError(error_msg)
    
    if not sheets:
        print("[EXCEL_PARSER] ПОМИЛКА: Файл не містить жодних аркушів")
        raise ValueError("Файл не містить жодних аркушів")
    
    final_data = []

    for sheet_name, df in sheets.items():
        logger.info(f"[EXCEL_PARSER] Обробка аркуша '{sheet_name}': {len(df)} рядків, {len(df.columns)} колонок")
        print(f"\n[EXCEL_PARSER] Обробка аркуша '{sheet_name}': {len(df)} рядків, {len(df.columns)} колонок", flush=True)
        
        df = df.dropna(how='all').reset_index(drop=True)
        if df.empty:
            print(f"[EXCEL_PARSER] Аркуш '{sheet_name}' порожній після очищення", flush=True)
            continue
        
        # Показуємо перші рядки для діагностики
        print(f"[EXCEL_PARSER] Перші 3 рядки:", flush=True)
        for i in range(min(3, len(df))):
            row_preview = [str(df.iloc[i, j])[:30] if j < len(df.columns) else "" for j in range(min(5, len(df.columns)))]
            print(f"  Рядок {i+1}: {row_preview}", flush=True)
        
        header_idx = find_header_row(df)
        
        if header_idx is None:
            print(f"[EXCEL_PARSER] Header не знайдено, спробуємо знайти колонки автоматично", flush=True)
            # Шукаємо колонки в перших 5 рядках
            name_col, price_col, weight_col = None, None, None
            
            for check_idx in range(min(5, len(df))):
                row_values = [str(v).strip().lower() for v in df.iloc[check_idx].values]
                for i, val in enumerate(row_values):
                    if name_col is None and any(kw in val for kw in ['назва', 'страва']):
                        name_col = i
                    if price_col is None and any(kw in val for kw in ['ціна', 'вартість', 'price']):
                        price_col = i
                    if weight_col is None and any(kw in val for kw in ['вага', 'вихід']):
                        weight_col = i
            
            # Якщо не знайдено автоматично, використовуємо типові індекси для цього формату Excel
            # Колонка 1 = Назва, колонка 4 = Ціна, колонка 2 = Вихід (вага)
            if name_col is None:
                name_col = 1  # За замовчуванням колонка 1 = Назва
            if price_col is None:
                price_col = 4  # За замовчуванням колонка 4 = Ціна
            if weight_col is None:
                weight_col = 2 if len(df.columns) > 2 else None  # За замовчуванням колонка 2 = Вихід
            
            print(f"[EXCEL_PARSER] Використовуємо колонки: name={name_col}, price={price_col}, weight={weight_col}", flush=True)
            df_work = df
        else:
            print(f"[EXCEL_PARSER] Header знайдено в рядку {header_idx + 1}", flush=True)
            row_values = [str(v).strip().lower() for v in df.iloc[header_idx].values]
            
            # Знаходимо індекси колонок
            name_col = next((i for i, v in enumerate(row_values) if any(kw in v for kw in ['назва', 'страва'])), None)
            price_col = next((i for i, v in enumerate(row_values) if any(kw in v for kw in ['ціна', 'вартість', 'price'])), None)
            weight_col = next((i for i, v in enumerate(row_values) if any(kw in v for kw in ['вага', 'вихід'])), None)
            
            if name_col is None or price_col is None:
                error_msg = f"Не знайдено обов'язкові колонки в header (рядок {header_idx + 1}). Знайдені колонки: {row_values[:10]}"
                print(f"[EXCEL_PARSER] ПОМИЛКА: {error_msg}", flush=True)
                raise ValueError(error_msg)
            
            df_work = df.iloc[header_idx + 1:].reset_index(drop=True)
            print(f"[EXCEL_PARSER] Колонки: name={name_col}, price={price_col}, weight={weight_col}", flush=True)
        
        current_subcategory = sheet_name
        items_in_sheet = 0
        
        for _, row in df_work.iterrows():
            name_val = row.iloc[name_col] if name_col < len(row) else None
            if pd.isna(name_val) or str(name_val).strip() == "":
                continue
            
            name = str(name_val).strip()
            price_val = row.iloc[price_col] if price_col < len(row) else None
            price = parse_price(price_val)
            
            if price is None:
                current_subcategory = name
                continue
            
            item = {
                "name": name,
                "category": sheet_name,
                "subcategory": current_subcategory,
                "price": f"{price:.2f}"
            }
            
            if weight_col is not None and weight_col < len(row):
                w = row.iloc[weight_col]
                if pd.notna(w):
                    item["weight"] = str(w).strip()
            
            final_data.append(item)
            items_in_sheet += 1
        
        print(f"[EXCEL_PARSER] Знайдено страв в аркуші '{sheet_name}': {items_in_sheet}", flush=True)

    logger.info(f"[EXCEL_PARSER] Всього знайдено страв: {len(final_data)}")
    print(f"\n[EXCEL_PARSER] Всього знайдено страв: {len(final_data)}", flush=True)
    
    if not final_data:
        error_msg = "Не знайдено жодної страви в Excel файлі"
        print(f"[EXCEL_PARSER] ПОМИЛКА: {error_msg}")
        raise ValueError(error_msg)

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

