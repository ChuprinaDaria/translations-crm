"""
Генерація патч-файлу з Excel для оновлення страв.
Обробляє Excel файл з аркушами (категорії) та рядками (страви).
"""

import pandas as pd
from pathlib import Path
from typing import List, Dict
import io


def generate_menu_patch_from_excel(file_path: Path) -> List[Dict[str, str]]:
    """
    Генерує список даних для оновлення страв з Excel файлу.
    
    Логіка:
    - Назва аркуша = категорія
    - Рядки без ціни = підкатегорії (через ffill)
    - Рядки з ціною = страви
    
    Args:
        file_path: Шлях до Excel файлу
        
    Returns:
        Список словників з полями: name, category, subcategory, price
    """
    try:
        # Спробуємо прочитати файл з engine='openpyxl' для підтримки .xlsm
        try:
            sheets = pd.read_excel(file_path, sheet_name=None, header=None, engine='openpyxl')
        except Exception:
            # Якщо не вдалося з openpyxl, спробуємо без engine
            sheets = pd.read_excel(file_path, sheet_name=None, header=None)
    except Exception as e:
        raise ValueError(f"Не вдалося прочитати Excel файл: {e}")
    
    if not sheets:
        raise ValueError("Файл не містить жодних аркушів")
    
    final_data = []
    debug_info = []  # Для діагностики

    for sheet_name, df in sheets.items():
        debug_info.append(f"Аркуш '{sheet_name}': {len(df)} рядків, {len(df.columns) if len(df) > 0 else 0} колонок")
        
        # Показуємо перші 3 рядки для діагностики
        if len(df) > 0:
            sample_rows = []
            for i in range(min(3, len(df))):
                row_data = [str(df.iloc[i, j]) if j < len(df.columns) else "" for j in range(min(5, len(df.columns)))]
                sample_rows.append(f"    Рядок {i+1}: {', '.join(row_data[:3])}")
            debug_info.extend(sample_rows)
        
        # Видаляємо порожні рядки
        df = df.dropna(how='all').reset_index(drop=True)
        
        if len(df) == 0:
            debug_info.append(f"  - Аркуш '{sheet_name}' порожній після видалення пустих рядків")
            continue
        
        # Назва аркуша = категорія
        current_category = sheet_name
        current_subcategory = sheet_name  # Початкова підкатегорія = категорія
        
        items_in_sheet = 0
        for idx, row in df.iterrows():
            # Перша колонка - назва страви/підкатегорії
            name_cell = row[0]
            
            # Пропускаємо порожні рядки
            if pd.isna(name_cell) or str(name_cell).strip() == "":
                continue
            
            name = str(name_cell).strip()
            
            # Перевіряємо, чи є друга колонка
            if len(row) < 2:
                # Немає другої колонки - це підкатегорія
                current_subcategory = name
                continue
            
            # Друга колонка - ціна (якщо є)
            price_cell = row[1]
            
            # Якщо немає ціни або ціна порожня - це підкатегорія
            if pd.isna(price_cell) or str(price_cell).strip() == "":
                current_subcategory = name
                continue
            
            # Якщо є ціна - це страва
            try:
                # Очищаємо ціну від символів
                price_str = str(price_cell).strip()
                clean_price_str = price_str.replace(',', '.').replace(' ', '').replace('грн', '').replace('₴', '').strip()
                
                # Видаляємо всі символи крім цифр, крапки та мінуса
                import re
                clean_price_str = re.sub(r'[^\d.-]', '', clean_price_str)
                
                if not clean_price_str:
                    # Порожня ціна після очищення - це підкатегорія
                    current_subcategory = name
                    continue
                
                # Спробуємо конвертувати в число
                clean_price = float(clean_price_str)
                
                if clean_price <= 0:
                    # Невірна ціна - це підкатегорія
                    current_subcategory = name
                    continue
                
                # Додаємо до результату
                final_data.append({
                    "name": name,
                    "category": current_category,
                    "subcategory": current_subcategory,
                    "price": f"{clean_price:.2f}"
                })
                items_in_sheet += 1
            except (ValueError, TypeError) as e:
                # Якщо не вдалося розпарсити ціну, вважаємо це підкатегорією
                current_subcategory = name
                continue
        
        debug_info.append(f"  - Знайдено страв: {items_in_sheet}")

    if not final_data:
        # Повертаємо діагностичну інформацію
        debug_msg = "Не знайдено жодної страви в Excel файлі.\n\n"
        debug_msg += "Діагностика:\n" + "\n".join(debug_info)
        debug_msg += "\n\nПеревірте:\n"
        debug_msg += "1. Перша колонка (A) містить назви страв\n"
        debug_msg += "2. Друга колонка (B) містить ціни (числа)\n"
        debug_msg += "3. Рядки без ціни вважаються підкатегоріями\n"
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

