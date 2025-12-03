#!/usr/bin/env python3
"""
Скрипт для виправлення порожніх HTML шаблонів.
Копіює вміст commercial-offer.html в порожні або майже порожні шаблони.
"""
import os
from pathlib import Path

UPLOADS_DIR = Path(__file__).parent / "app" / "uploads"
DEFAULT_TEMPLATE = UPLOADS_DIR / "commercial-offer.html"

def fix_empty_templates():
    if not DEFAULT_TEMPLATE.exists():
        print(f"❌ Дефолтний шаблон не знайдено: {DEFAULT_TEMPLATE}")
        return
    
    # Читаємо дефолтний шаблон
    with open(DEFAULT_TEMPLATE, 'r', encoding='utf-8') as f:
        default_content = f.read()
    
    print(f"✓ Завантажено дефолтний шаблон ({len(default_content)} байт)")
    
    # Шукаємо всі HTML файли в uploads
    html_files = list(UPLOADS_DIR.glob("*.html"))
    fixed_count = 0
    
    for html_file in html_files:
        if html_file.name == "commercial-offer.html":
            continue  # Пропускаємо дефолтний шаблон
        
        file_size = html_file.stat().st_size
        
        # Якщо файл менше 500 байт - він швидше за все порожній або пошкоджений
        if file_size < 500:
            print(f"📝 Виправляю {html_file.name} ({file_size} байт) -> {len(default_content)} байт")
            with open(html_file, 'w', encoding='utf-8') as f:
                f.write(default_content)
            fixed_count += 1
    
    print(f"\n✅ Виправлено {fixed_count} шаблонів")

if __name__ == "__main__":
    fix_empty_templates()

