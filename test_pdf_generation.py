#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Тестовий скрипт для перевірки генерації PDF з шаблону
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from jinja2 import FileSystemLoader, Environment
from weasyprint import HTML

# Додаємо шлях до app
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR / "app"))

# Тестові дані
test_data = {
    "kp": {
        "title": "Корпоративний захід",
        "client_name": "ТОВ \"Тестова компанія\"",
        "client_contact": "+380 50 123 45 67",
        "people_count": 50,
        "notes": "Прохання врахувати алергію на горіхи у трьох гостей",
    },
    "items": [
        {
            "name": "Салат Цезар",
            "description": "Курка, листя салату, помідори черрі, пармезан",
            "price": "250.00 грн",
            "quantity": 10,
            "weight": "0.30 кг",
            "total": "2500.00 грн",
            "total_weight": 3.0,
            "photo_url": None,
            "photo_src": None,
            "category_name": "Салати",
            "subcategory_name": "Теплі салати",
        },
        {
            "name": "Борщ український",
            "description": "Класичний рецепт з яловичиною та сметаною",
            "price": "180.00 грн",
            "quantity": 15,
            "weight": "0.35 кг",
            "total": "2700.00 грн",
            "total_weight": 5.25,
            "photo_url": None,
            "photo_src": None,
            "category_name": "Перші страви",
            "subcategory_name": "Гарячі супи",
        },
        {
            "name": "Котлета по-київськи",
            "description": "Куряча грудка з вершковим маслом та часником",
            "price": "320.00 грн",
            "quantity": 20,
            "weight": "0.25 кг",
            "total": "6400.00 грн",
            "total_weight": 5.0,
            "photo_url": None,
            "photo_src": None,
            "category_name": "Гарячі страви",
            "subcategory_name": "М'ясні страви",
        },
    ],
    "food_total": "11600.00 грн",
    "equipment_total": "2500.00 грн",
    "service_total": "4000.00 грн",
    "transport_total": "1500.00 грн",
    "total_weight": "13.25 кг",
    "total_weight_grams": 13250,
    "weight_per_person": "265 г",
    "total_items": 3,
    "logo_src": None,
    "header_image_src": None,
    "background_image_src": None,
    "primary_color": "#FF5A00",
    "secondary_color": "#ffffff",
    "text_color": "#333333",
    "font_family": "Arial, sans-serif",
    "company_name": "BOX Catering",
    "created_date": datetime.now().strftime("%d.%m.%Y"),
    "event_date": "25.12.2024",
}

def test_pdf_generation():
    """Тестуємо генерацію PDF"""
    
    print("🔍 Перевірка шаблону...")
    
    # Перевіряємо наявність шаблону
    template_path = BASE_DIR / "app" / "uploads" / "commercial-offer.html"
    if not template_path.exists():
        print(f"❌ Шаблон не знайдено: {template_path}")
        return False
    
    print(f"✓ Шаблон знайдено: {template_path}")
    
    # Завантажуємо шаблон
    try:
        template_dir = template_path.parent
        env = Environment(loader=FileSystemLoader(str(template_dir)))
        template = env.get_template(template_path.name)
        print("✓ Шаблон завантажено")
    except Exception as e:
        print(f"❌ Помилка завантаження шаблону: {e}")
        return False
    
    # Рендеримо HTML
    try:
        html_content = template.render(**test_data)
        print("✓ HTML згенеровано")
        
        # Зберігаємо HTML для дебагу
        debug_html = BASE_DIR / "debug_kp.html"
        with open(debug_html, "w", encoding="utf-8") as f:
            f.write(html_content)
        print(f"✓ HTML збережено для дебагу: {debug_html}")
    except Exception as e:
        print(f"❌ Помилка рендерингу HTML: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    # Генеруємо PDF
    try:
        pdf_bytes = HTML(string=html_content, base_url=str(BASE_DIR)).write_pdf(zoom=1)
        print("✓ PDF згенеровано")
        
        # Зберігаємо PDF
        pdf_path = BASE_DIR / "debug_kp.pdf"
        with open(pdf_path, "wb") as f:
            f.write(pdf_bytes)
        print(f"✓ PDF збережено: {pdf_path}")
        print(f"📄 Розмір PDF: {len(pdf_bytes) / 1024:.2f} KB")
        
        return True
    except Exception as e:
        print(f"❌ Помилка генерації PDF: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Тест генерації PDF для комерційних пропозицій")
    print("=" * 60)
    print()
    
    success = test_pdf_generation()
    
    print()
    print("=" * 60)
    if success:
        print("✅ Тест пройдено успішно!")
        print("Відкрийте debug_kp.html в браузері для перевірки")
        print("Відкрийте debug_kp.pdf для перегляду результату")
    else:
        print("❌ Тест провалено!")
        print("Перевірте помилки вище")
    print("=" * 60)

