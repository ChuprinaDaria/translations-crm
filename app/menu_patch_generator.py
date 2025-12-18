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
        sheets = pd.read_excel(file_path, sheet_name=None, header=None)
    except Exception as e:
        raise ValueError(f"Не вдалося прочитати Excel файл: {e}")
    
    final_data = []

    for sheet_name, df in sheets.items():
        # Видаляємо порожні рядки
        df = df.dropna(how='all').reset_index(drop=True)
        
        # Назва аркуша = категорія
        current_category = sheet_name
        current_subcategory = sheet_name  # Початкова підкатегорія = категорія
        
        for _, row in df.iterrows():
            # Перша колонка - назва страви/підкатегорії
            name_cell = row[0]
            
            # Пропускаємо порожні рядки
            if pd.isna(name_cell) or str(name_cell).strip() == "":
                continue
            
            name = str(name_cell).strip()
            
            # Друга колонка - ціна (якщо є)
            price_cell = row[1] if len(row) > 1 else None
            
            # Якщо немає ціни або ціна порожня - це підкатегорія
            if pd.isna(price_cell) or str(price_cell).strip() == "":
                current_subcategory = name
                continue
            
            # Якщо є ціна - це страва
            try:
                # Очищаємо ціну від символів
                clean_price_str = str(price_cell).replace(',', '.').replace(' ', '').replace('грн', '').replace('₴', '').strip()
                
                # Спробуємо конвертувати в число
                clean_price = float(clean_price_str)
                
                # Додаємо до результату
                final_data.append({
                    "name": name,
                    "category": current_category,
                    "subcategory": current_subcategory,
                    "price": f"{clean_price:.2f}"
                })
            except (ValueError, TypeError):
                # Якщо не вдалося розпарсити ціну, вважаємо це підкатегорією
                current_subcategory = name
                continue

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

