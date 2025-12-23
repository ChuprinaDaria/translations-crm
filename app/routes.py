from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import Optional, Any, List
import logging

logger = logging.getLogger(__name__)

from db import SessionLocal
from datetime import datetime, timedelta
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

import crud, schema, crud_user, models
import jwt, os, re, json
import shutil
import uuid
from pathlib import Path
import pyotp
from decimal import Decimal
from email_service import send_kp_email
from telegram_service import send_kp_telegram
from import_menu_csv import parse_menu_csv, import_to_db as import_menu_items
from menu_patch_generator import generate_menu_patch_from_excel
from update_items_from_file import update_items_from_data
import loyalty_service
from purchase_service import generate_purchase_excel
from service_excel_service import generate_service_excel
from recipe_service import import_calculations_file, get_all_recipes, calculate_purchase_from_kps
from procurement_excel_service import generate_procurement_excel


router = APIRouter()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# Абсолютні шляхи до директорії `uploads` всередині модуля `app`
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"
CALC_FILES_DIR = UPLOADS_DIR / "calculations_files"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


bearer_scheme = HTTPBearer()


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    token = creds.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # { "sub": "id", "email": "...", "exp": ... }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user_db(
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user),
):
    """
    Повертає поточного користувача з БД (об'єкт models.User).
    Використовується там, де потрібен доступ до полів користувача
    та перевірка is_admin.
    """
    user_id = int(user_payload.get("sub"))
    user = crud_user.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/items", response_model=list[schema.Item])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), user = Depends(get_current_user)):
    items = crud.get_items(db, skip=skip, limit=limit)
    # Фільтруємо items з None name, щоб уникнути помилок валідації
    return [item for item in items if item.name is not None]


@router.get("/items/{item_id}", response_model=schema.Item)
def read_item(item_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    item = crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


# Створюємо директорії для фото, прев'ю та лого якщо не існують (в межах UPLOADS_DIR)
PHOTOS_DIR = UPLOADS_DIR / "photos"
PHOTOS_DIR.mkdir(parents=True, exist_ok=True)

TEMPLATE_PREVIEWS_DIR = UPLOADS_DIR / "template-previews"
TEMPLATE_PREVIEWS_DIR.mkdir(parents=True, exist_ok=True)

BRANDING_DIR = UPLOADS_DIR / "branding"
BRANDING_DIR.mkdir(parents=True, exist_ok=True)

COMPANY_LOGO_FILENAME = "logo.png"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}

def save_uploaded_file(file: UploadFile) -> str:
    """Зберігає завантажений файл та повертає відносний шлях"""
    # Генеруємо унікальне ім'я файлу
    file_ext = Path(file.filename).suffix if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = PHOTOS_DIR / unique_filename
    
    # Зберігаємо файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Повертаємо відносний шлях для зберігання в БД
    return f"uploads/photos/{unique_filename}"

def delete_old_photo(photo_url: str):
    """Видаляє старе фото якщо воно існує"""
    if not photo_url:
        return
    
    # Перевіряємо чи це локальний файл (не URL)
    if photo_url.startswith("uploads/photos/"):
        photo_path = Path(photo_url)
        if photo_path.exists():
            try:
                photo_path.unlink()
            except Exception as e:
                print(f"Error deleting old photo: {e}")

def save_template_preview(file: UploadFile) -> str:
    """Зберігає прев'ю зображення шаблону та повертає відносний шлях"""
    # Генеруємо унікальне ім'я файлу
    file_ext = Path(file.filename).suffix if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = TEMPLATE_PREVIEWS_DIR / unique_filename
    
    # Зберігаємо файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Повертаємо відносний шлях для зберігання в БД
    return f"uploads/template-previews/{unique_filename}"

def delete_old_preview(preview_url: str):
    """Видаляє старе прев'ю якщо воно існує"""
    if not preview_url:
        return
    
    # Перевіряємо чи це локальний файл (не URL)
    if preview_url.startswith("uploads/template-previews/"):
        preview_path = Path(preview_url)
        if preview_path.exists():
            try:
                preview_path.unlink()
            except Exception as e:
                print(f"Error deleting old preview: {e}")


def generate_template_preview_image(
    html_content: str,
    filename: str,
    primary_color: str | None = None,
    secondary_color: str | None = None,
    text_color: str | None = None,
    font_family: str | None = None,
    header_image_url: str | None = None,
    category_separator_image_url: str | None = None,
    background_image_url: str | None = None,
) -> str:
    """
    Генерує прев'ю зображення з HTML шаблону.
    Повертає відносний шлях до збереженого зображення.
    """
    try:
        from pdf2image import convert_from_bytes
        from io import BytesIO
        
        print(f"🔍 Starting preview generation for template: {filename}")
        
        # Конвертуємо URL зображень в file:// URL для WeasyPrint
        header_image_src = None
        if header_image_url:
            try:
                header_path = (BASE_DIR / header_image_url.lstrip('/')).resolve()
                if header_path.exists():
                    header_image_src = f"file://{header_path}"
            except Exception:
                pass
        
        category_separator_src = None
        if category_separator_image_url:
            try:
                sep_path = (BASE_DIR / category_separator_image_url.lstrip('/')).resolve()
                if sep_path.exists():
                    category_separator_src = f"file://{sep_path}"
            except Exception:
                pass
        
        background_image_src = None
        if background_image_url:
            try:
                bg_path = (BASE_DIR / background_image_url.lstrip('/')).resolve()
                if bg_path.exists():
                    background_image_src = f"file://{bg_path}"
            except Exception:
                pass
        
        # Генеруємо PDF з HTML (використовуємо тестові дані)
        # Важливо: дані повинні містити всі поля, які використовує HTML шаблон
        test_data = {
            'kp': {
                'id': 1,
                'title': 'Комерційна пропозиція - Корпоратив',
                'client_name': 'ТОВ "Приклад Компанії"',
                'client_email': 'info@example.com.ua',
                'client_phone': '+380 50 123 45 67',
                'client_contact': None,
                'people_count': 50,
                'status': 'sent',
                'total_price': 40050.0,
                'price_per_person': 801.0,
                'template_id': 1,
                'created_at': None,
                'event_date': '20.12.2025',
                'event_format': 'Корпоратив / Фуршет',
                'event_group': 'Кейтерінг',
                'event_location': 'м. Київ, вул. Хрещатик, 1',
                'event_time': '14:00 - 18:00',
                'coordinator_name': 'Олена Петренко',
                'coordinator_phone': '+380 67 987 65 43',
                'equipment_total': 2500.0,
                'service_total': 4500.0,
                'transport_total': 800.0,
                'total_weight': 49250.0,  # в грамах
                'weight_per_person': 985.0,  # в грамах
                'notes': 'Бажано врахувати вегетаріанське меню для 5 осіб',
                # Знижка та кешбек
                'discount_amount': 0,
                'cashback_amount': 0,
                'cashback_earned': 1201.50,
                'cashback_used': 0,
            },
            'items': [
                {
                    'name': 'Канапе з лососем',
                    'quantity': 50,
                    'weight': '40 г',
                    'weight_raw': 0.04,
                    'unit': 'г',
                    'price': '45.00 грн',
                    'price_raw': 45.0,
                    'total': '2250.00 грн',
                    'total_raw': 2250.0,
                    'total_weight': 2.0,
                    'description': 'Свіжий лосось з крем-сиром на хрусткому хлібі',
                    'category_name': 'Холодні закуски',
                    'subcategory_name': 'Канапе',
                    'photo_url': None,
                    'photo_src': None,
                },
                {
                    'name': 'Салат Цезар з куркою',
                    'quantity': 25,
                    'weight': '250 г',
                    'weight_raw': 0.25,
                    'unit': 'г',
                    'price': '180.00 грн',
                    'price_raw': 180.0,
                    'total': '4500.00 грн',
                    'total_raw': 4500.0,
                    'total_weight': 6.25,
                    'description': 'Класичний салат Цезар з куркою та пармезаном',
                    'category_name': 'Салати',
                    'subcategory_name': 'Класичні салати',
                    'photo_url': None,
                    'photo_src': None,
                },
                {
                    'name': 'Котлета по-київськи',
                    'quantity': 50,
                    'weight': '250 г',
                    'weight_raw': 0.25,
                    'unit': 'г',
                    'price': '320.00 грн',
                    'price_raw': 320.0,
                    'total': '16000.00 грн',
                    'total_raw': 16000.0,
                    'total_weight': 12.5,
                    'description': 'Куряча грудка з вершковим маслом та часником',
                    'category_name': 'Гарячі страви',
                    'subcategory_name': "М'ясні страви",
                    'photo_url': None,
                    'photo_src': None,
                },
                {
                    'name': 'Картопля по-селянськи',
                    'quantity': 50,
                    'weight': '200 г',
                    'weight_raw': 0.2,
                    'unit': 'г',
                    'price': '60.00 грн',
                    'price_raw': 60.0,
                    'total': '3000.00 грн',
                    'total_raw': 3000.0,
                    'total_weight': 10.0,
                    'description': None,
                    'category_name': 'Гарнір',
                    'subcategory_name': None,
                    'photo_url': None,
                    'photo_src': None,
                },
                {
                    'name': 'Тірамісу',
                    'quantity': 50,
                    'weight': '120 г',
                    'weight_raw': 0.12,
                    'unit': 'г',
                    'price': '95.00 грн',
                    'price_raw': 95.0,
                    'total': '4750.00 грн',
                    'total_raw': 4750.0,
                    'total_weight': 6.0,
                    'description': 'Класичний італійський десерт з маскарпоне',
                    'category_name': 'Десерти',
                    'subcategory_name': 'Італійські десерти',
                    'photo_url': None,
                    'photo_src': None,
                },
                {
                    'name': 'Апельсиновий сік',
                    'quantity': 50,
                    'weight': '250 мл',
                    'weight_raw': 0.25,
                    'unit': 'мл',
                    'price': '35.00 грн',
                    'price_raw': 35.0,
                    'total': '1750.00 грн',
                    'total_raw': 1750.0,
                    'total_weight': 12.5,
                    'description': 'Свіжовичавлений',
                    'category_name': 'Напої',
                    'subcategory_name': 'Соки',
                    'photo_url': None,
                    'photo_src': None,
                },
            ],
            'total_items': 6,
            'food_total': '32 250.00 грн',
            'equipment_total': '2 500.00 грн',
            'service_total': '4 500.00 грн',
            'transport_total': '800.00 грн',
            'total_weight': '49.25 кг',
            'total_weight_grams': 49250.0,
            'weight_per_person': '985 г',
            'company_name': 'Дзиґа Кейтерінґ',
            'created_date': '09.12.2025',
            'event_date': '20.12.2025',
            'logo_src': None,
            'header_image_src': header_image_src,
            'category_separator_image_url': category_separator_src,
            'background_image_src': background_image_src,
        }
        
        # Додаткові дані для шаблону
        # Створюємо об'єкт template_config з налаштуваннями відображення
        class TemplateConfig:
            def __init__(self):
                self.show_item_photo = True
                self.show_item_weight = True
                self.show_item_quantity = True
                self.show_item_price = True
                self.show_item_total = True
                self.show_item_description = False
                self.show_weight_summary = True
                self.show_weight_per_person = True
                self.show_discount_block = False
                self.show_equipment_block = True
                self.show_service_block = True
                self.show_transport_block = True
                # Дефолтні категорії, але в реальних КП будуть використовуватися динамічні категорії зі страв
                self.menu_sections = []
                self.menu_title = "Меню"
                self.summary_title = "Підсумок"
                self.footer_text = ""
                self.page_orientation = "portrait"
                self.items_per_page = 20
        
        template_config_obj = TemplateConfig()
        
        # Створюємо тестові формати з items для відображення меню
        test_formats = [
            {
                'name': 'Фуршет',
                'event_time': '14:00 - 18:00',
                'people_count': 50,
                'items': test_data['items'],
                'food_total_formatted': '32 250.00 грн',
                'price_per_person_formatted': '645.00 грн/ос',
                'discount_percent': 0,
                'discount_amount_formatted': None,
                'total_after_discount_formatted': None,
                'price_per_person_after_discount_formatted': None,
            }
        ]
        
        # Динамічно збираємо категорії з тестових даних
        preview_menu_sections = sorted(list(set(
            item['category_name'] for item in test_data['items'] 
            if item.get('category_name')
        )))
        
        # Визначаємо кольори та шрифт для превʼю:
        # якщо явно не передані – використовуємо брендовані значення за замовчуванням
        effective_primary_color = primary_color or "#FF5A00"
        effective_secondary_color = secondary_color or "#ffffff"
        effective_text_color = text_color or "#333333"
        effective_font_family = font_family or "Arial, sans-serif"

        # Рендеримо HTML через Jinja2
        from jinja2 import Template
        template = Template(html_content)
        rendered_html = template.render(
            **test_data,
            template=template_config_obj,
            template_config=template_config_obj,
            primary_color=effective_primary_color,
            secondary_color=effective_secondary_color,
            text_color=effective_text_color,
            font_family=effective_font_family,
            menu_sections=preview_menu_sections,
            formats=test_formats,
            food_total_raw=32250.0,
            price_per_person=801.0,
            # Знижка та кешбек
            discount_amount=0,
            discount_percent=0,
            discount_amount_formatted=None,
            cashback_used=0,
            cashback_used_formatted=None,
            cashback_earned=1201.50,
            cashback_earned_formatted='1 201.50',
            # Підсумки
            grand_total=40050.0,
            grand_total_formatted='40 050.00 грн',
            fop_percent=0,
            fop_extra=0,
            fop_extra_formatted=None,
            grand_total_with_fop=40050.0,
            grand_total_with_fop_formatted='40 050.00 грн',
        )
        
        print(f"📄 HTML rendered successfully, generating PDF...")
        
        # Генеруємо PDF з HTML з правильним base_url
        pdf_bytes = HTML(string=rendered_html, base_url=str(BASE_DIR)).write_pdf(zoom=0.75)
        
        print(f"✓ PDF generated, converting to image...")
        
        # Конвертуємо першу сторінку PDF у зображення
        images = convert_from_bytes(pdf_bytes, first_page=1, last_page=1, dpi=150)
        
        if not images:
            raise Exception("Failed to convert PDF to image")
        
        # Зберігаємо зображення
        preview_image = images[0]
        
        # Зменшуємо розмір для прев'ю (макс. 800px по ширині)
        max_width = 800
        if preview_image.width > max_width:
            ratio = max_width / preview_image.width
            new_height = int(preview_image.height * ratio)
            preview_image = preview_image.resize((max_width, new_height))
        
        # Генеруємо унікальне ім'я файлу
        unique_filename = f"{uuid.uuid4()}.png"
        preview_path = TEMPLATE_PREVIEWS_DIR / unique_filename
        
        # Зберігаємо зображення
        preview_image.save(preview_path, "PNG", optimize=True)
        
        print(f"✓ Template preview generated: {preview_path}")
        return f"uploads/template-previews/{unique_filename}"
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"❌ Error generating template preview: {e}")
        print(f"Full traceback:\n{error_trace}")
        # Повертаємо None якщо не вдалося згенерувати прев'ю
        return None


def get_company_logo_path() -> Path | None:
    """
    Повертає шлях до файлу лого компанії, якщо він існує.
    """
    logo_path = BRANDING_DIR / COMPANY_LOGO_FILENAME
    return logo_path if logo_path.exists() else None

@router.post("/items", response_model=schema.Item)
async def create_item(
    name: str = Form(...),
    description: str = Form(None),
    price: float = Form(None),
    stock_quantity: int = Form(None),
    loss_price: float = Form(None),
    weight: str = Form(None),
    volume: str = Form(None),
    unit: str = Form(None),
    subcategory_id: int = Form(None),
    active: bool = Form(True),
    photo: UploadFile = File(None),
    photo_url: str = Form(None),
    db: Session = Depends(get_db), 
    user = Depends(get_current_user)
):
    # Обробка фото: пріоритет має завантажений файл
    final_photo_url = None
    
    if photo:
        # Перевіряємо тип файлу
        if photo.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF")
        
        # Зберігаємо файл
        final_photo_url = save_uploaded_file(photo)
    elif photo_url:
        # Якщо передано photo_url, використовуємо його
        final_photo_url = photo_url
    
    # Нормалізуємо порожні рядки до None
    weight_normalized = weight if weight and weight.strip() else None
    volume_normalized = volume if volume and volume.strip() else None
    unit_normalized = unit if unit and unit.strip() else None
    description_normalized = description if description and description.strip() else None
    
    # Створюємо об'єкт ItemCreate
    item_data = schema.ItemCreate(
        name=name,
        description=description_normalized,
        price=price,
        stock_quantity=stock_quantity,
        loss_price=loss_price,
        weight=weight_normalized,
        volume=volume_normalized,
        unit=unit_normalized,
        subcategory_id=subcategory_id,
        active=active,
        photo_url=final_photo_url
    )
    
    return crud.create_item(db, item_data)


@router.put("/items/{item_id}", response_model=schema.Item)
async def update_item(
    item_id: int,
    name: str = Form(None),
    description: str = Form(None),
    price: float = Form(None),
    stock_quantity: int = Form(None),
    loss_price: float = Form(None),
    weight: str = Form(None),
    volume: str = Form(None),
    unit: str = Form(None),
    subcategory_id: int = Form(None),
    active: bool = Form(None),
    photo: UploadFile = File(None),
    photo_url: str = Form(None),
    db: Session = Depends(get_db), 
    user = Depends(get_current_user)
):
    # Отримуємо поточну страву для видалення старого фото
    current_item = crud.get_item(db, item_id)
    if not current_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Обробка фото: пріоритет має завантажений файл
    final_photo_url = None
    
    if photo:
        # Перевіряємо тип файлу
        if photo.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF")
        
        # Видаляємо старе фото якщо воно існує
        if current_item.photo_url:
            delete_old_photo(current_item.photo_url)
        
        # Зберігаємо новий файл
        final_photo_url = save_uploaded_file(photo)
    elif photo_url is not None:
        # Якщо передано photo_url (може бути порожнім рядком для видалення фото)
        if current_item.photo_url and photo_url != current_item.photo_url:
            # Видаляємо старе фото якщо воно відрізняється
            delete_old_photo(current_item.photo_url)
        final_photo_url = photo_url if photo_url else None
    else:
        # Якщо не передано ні photo, ні photo_url, залишаємо поточне значення
        final_photo_url = current_item.photo_url
    
    # Нормалізуємо порожні рядки до None
    weight_normalized = weight if weight and weight.strip() else None
    volume_normalized = volume if volume and volume.strip() else None
    unit_normalized = unit if unit and unit.strip() else None
    description_normalized = description if description and description.strip() else None
    
    # Створюємо об'єкт ItemUpdate
    # name обов'язкове поле, тому якщо воно None або порожнє, не передаємо його в оновлення
    # (exclude_none=True в crud.update_item виключить None значення)
    item_data_dict = {
        'description': description_normalized,
        'price': price,
        'stock_quantity': stock_quantity,
        'loss_price': loss_price,
        'weight': weight_normalized,
        'volume': volume_normalized,
        'unit': unit_normalized,
        'subcategory_id': subcategory_id,
        'active': active,
        'photo_url': final_photo_url
    }
    # Додаємо name тільки якщо воно передано і не порожнє
    if name and isinstance(name, str) and name.strip():
        item_data_dict['name'] = name.strip()
    
    item_data = schema.ItemUpdate(**item_data_dict)
    
    # Логуємо дані для оновлення
    print(f"[UPDATE_ITEM] ID: {item_id}, Data: {item_data_dict}")
    
    updated = crud.update_item(db, item_id, item_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Логуємо результат
    print(f"[UPDATE_ITEM] Updated item: id={updated.id}, name={updated.name}, price={updated.price}, subcategory_id={updated.subcategory_id}")
    
    return updated


@router.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    # Отримуємо страву перед видаленням для видалення фото
    item = crud.get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Видаляємо фото якщо воно існує
    if item.photo_url:
        delete_old_photo(item.photo_url)
    
    deleted = crud.delete_item(db, item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"status": "success"}

@router.delete('/kp/{kp_id}')
def delete_kp(kp_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_kp(db, kp_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="KP not found")

    return {"status": "success"}


def generate_kp_pdf_bytes(kp_id: int, template_id: int = None, db: Session = None) -> tuple[bytes, str]:
    """
    Генерує PDF для КП та повертає його як bytes
    
    Args:
        kp_id: ID комерційної пропозиції
        template_id: ID шаблону (опціонально)
        db: Сесія бази даних (якщо None, створюється нова)
    
    Returns:
        tuple: (pdf_bytes, filename)
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True
    
    try:
        return _generate_kp_pdf_internal(kp_id, template_id, db)
    finally:
        if should_close:
            db.close()

def _generate_kp_pdf_internal(kp_id: int, template_id: int = None, db: Session = None) -> tuple[bytes, str]:
    """Внутрішня функція для генерації PDF"""
    # Отримуємо КП разом з позиціями та пов'язаними сутностями
    kp = crud.get_kp_items(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    
    # Дані по стравах (плоский список для старих шаблонів та загальних підрахунків)
    items_data: list[dict] = []
    total_quantity = 0
    total_weight = 0.0
    total_volume_ml = 0.0  # Загальний об'єм в мл

    # Підготовка структур для форматів меню (Welcome drink, Фуршет, тощо)
    formats_map: dict[Any, dict] = {}
    for event_format in getattr(kp, "event_formats", []) or []:
        # Використовуємо people_count формату, якщо він вказаний і > 0, інакше з КП, інакше None
        people = None
        if event_format.people_count and event_format.people_count > 0:
            people = event_format.people_count
        elif kp.people_count and kp.people_count > 0:
            people = kp.people_count
        formats_map[event_format.id] = {
            "id": event_format.id,
            "name": event_format.name,
            "event_time": event_format.event_time,
            "people_count": people,
            "order_index": event_format.order_index or 0,
            "items": [],
            "food_total_raw": 0.0,
            "weight_total_raw": 0.0,
        }
    
    # Основний (дефолтний) формат, якщо у КП немає KPEventFormat або частина страв без прив'язки
    default_format_key = None
    if not formats_map:
        formats_map[default_format_key] = {
            "id": None,
            "name": getattr(kp, "event_format", None) or "Меню",
            "event_time": getattr(kp, "event_time", None),
            "people_count": kp.people_count if kp.people_count and kp.people_count > 0 else None,
            "order_index": 0,
            "items": [],
            "food_total_raw": 0.0,
            "weight_total_raw": 0.0,
        }
    
    for kp_item in kp.items:
        # kp_item.item вже завантажений через selectinload в get_kp_items
        item = kp_item.item
        
        # Обробляємо custom items (equipment/service без item_id)
        if not item:
            # Custom item - може бути обладнанням або сервісом
            # Перевіряємо чи це обладнання чи сервіс через назву або інші поля
            # Поки що додаємо до відповідних списків на основі того, чи є price та loss_price
            if kp_item.name:
                # Якщо є loss_price в KPItem - це обладнання, інакше сервіс
                # Але в KPItem немає loss_price, тому використаємо інший підхід
                # Перевіряємо чи це обладнання через перевірку в equipment_total
                # Поки що додаємо всі custom items до обох списків, а потім відфільтруємо
                pass  # Обробимо нижче
            continue

        item_weight = (item.weight or 0) * kp_item.quantity
        total_weight += item_weight

        # Готуємо дані для фото та категорій
        photo_url = item.photo_url
        photo_src = None
        if photo_url:
            try:
                photo_path = (BASE_DIR / photo_url).resolve()
                if photo_path.exists():
                    # WeasyPrint підтримує file:// шляхи для локальних ресурсів
                    photo_src = f"file://{photo_path}"
            except Exception:
                photo_src = None

        # Допоміжна функція для форматування чисел без нулів
        def format_number_local(num, decimals=2):
            """Форматує число без зайвих нулів після коми"""
            if num is None:
                return "-"
            if isinstance(num, (int, float)):
                # Якщо число ціле, показуємо без коми
                if num == int(num):
                    return str(int(num))
                # Інакше показуємо з комою, але без зайвих нулів
                formatted = f"{num:.{decimals}f}"
                return formatted.rstrip('0').rstrip('.')
            return str(num)
        
        weight_str = f"{format_number_local(item.weight)} {item.unit or 'кг'}" if item.weight else "-"
        price_str = f"{format_number_local(item.price)} грн" if item.price else "-"
        total_str = f"{format_number_local((item.price or 0) * kp_item.quantity)} грн"
        
        # Розраховуємо об'єм для мл на особу (якщо є volume)
        volume_raw = None
        total_volume = 0.0
        if item.volume:
            try:
                # Парсимо об'єм (може бути рядок або число)
                if isinstance(item.volume, str):
                    # Можливо формат "150/75" або просто "150"
                    volume_parts = item.volume.split('/')
                    volume_raw = float(volume_parts[0]) if volume_parts else 0
                else:
                    volume_raw = float(item.volume)
                # Об'єм в мл (якщо одиниця л, множимо на 1000)
                unit_lower = (item.unit or '').lower()
                if unit_lower in ['л', 'l']:
                    volume_ml = volume_raw * 1000
                elif unit_lower in ['мл', 'ml']:
                    volume_ml = volume_raw
                else:
                    volume_ml = 0
                total_volume = volume_ml * kp_item.quantity
                total_volume_ml += total_volume  # Додаємо до загального об'єму
            except (ValueError, TypeError):
                volume_raw = None
                total_volume = 0.0
        
        item_dict = {
            'name': item.name,
            'price': price_str,
            'quantity': kp_item.quantity,
            'total': total_str,
            'description': item.description,
            'unit': item.unit,
            # Вага однієї одиниці страви
            'weight': weight_str,          # форматований текст, напр. "0.50 кг"
            'weight_raw': item.weight or 0,  # числове значення ваги 1 одиниці (float, кг)
            'total_weight': item_weight,
            # Об'єм для розрахунку мл на особу
            'volume': item.volume,
            'volume_raw': volume_raw,
            'total_volume': total_volume,  # Загальний об'єм в мл
            'photo_url': photo_url,  # Відносний шлях (наприклад, uploads/photos/...)
            'photo_src': photo_src,  # Повний file:// шлях для використання в <img src="...">
            'category_name': item.subcategory.category.name if getattr(item, "subcategory", None) and getattr(item.subcategory, "category", None) else None,
            'subcategory_name': item.subcategory.name if getattr(item, "subcategory", None) else None,
            # Формат (Welcome drink / Фуршет / тощо)
            'format_id': kp_item.event_format_id,
            'format_name': kp_item.event_format.name if getattr(kp_item, "event_format", None) else None,
            'format_time': kp_item.event_format.event_time if getattr(kp_item, "event_format", None) else None,
            'format_people_count': kp_item.event_format.people_count if getattr(kp_item, "event_format", None) and kp_item.event_format.people_count else None,
            # Зберігаємо також числові значення для підрахунків
            'price_raw': item.price or 0,
            'total_raw': (item.price or 0) * kp_item.quantity,
        }
        items_data.append(item_dict)
        total_quantity += kp_item.quantity
        
        # Додаємо позицію до відповідного формату меню
        fmt_key = kp_item.event_format_id if kp_item.event_format_id in formats_map else default_format_key
        # Якщо формат ще не ініціалізовано (наприклад, страва прив'язана до формату, якого немає в kp.event_formats)
        if fmt_key not in formats_map:
            # Використовуємо people_count з формату події, якщо він є і > 0, інакше з КП, інакше None
            people = None
            if getattr(kp_item, "event_format", None) and kp_item.event_format.people_count and kp_item.event_format.people_count > 0:
                people = kp_item.event_format.people_count
            elif kp.people_count and kp.people_count > 0:
                people = kp.people_count
            formats_map[fmt_key] = {
                "id": fmt_key,
                "name": kp_item.event_format.name if getattr(kp_item, "event_format", None) else "Меню",
                "event_time": kp_item.event_format.event_time if getattr(kp_item, "event_format", None) else None,
                "people_count": people,
                "order_index": getattr(kp_item.event_format, "order_index", 0) if getattr(kp_item, "event_format", None) else 0,
                "items": [],
                "food_total_raw": 0.0,
                "weight_total_raw": 0.0,
            }
        
        fmt = formats_map[fmt_key]
        fmt["items"].append(item_dict)
        fmt["food_total_raw"] += item_dict["total_raw"]
        fmt["weight_total_raw"] += item_weight

    # Визначаємо який шаблон використовувати
    selected_template = None
    if template_id:
        selected_template = crud.get_template(db, template_id)
        if not selected_template:
            raise HTTPException(404, "Template not found")
    elif kp.template_id:
        selected_template = crud.get_template(db, kp.template_id)
    else:
        selected_template = crud.get_default_template(db)
    
    # Якщо шаблон не знайдено, використовуємо дефолтний
    if not selected_template:
        template_filename = "commercial-offer.html"
    else:
        template_filename = selected_template.filename

    # Render template with data
    env = Environment(loader=FileSystemLoader(str(UPLOADS_DIR)))
    try:
        template = env.get_template(template_filename)
    except Exception as e:
        raise HTTPException(500, f"Template file not found: {template_filename}")
    
    # Підготуємо шлях до лого, щоб його можна було вставити в HTML
    logo_path = get_company_logo_path()
    logo_src = None
    if logo_path:
        # WeasyPrint підтримує file:// шляхи для локальних ресурсів
        logo_src = f"file://{logo_path.resolve()}"
    
    # Отримаємо шляхи до зображень шапки та фону (якщо задані в шаблоні)
    header_image_src = None
    background_image_src = None
    category_separator_image_url = None
    if selected_template:
        if getattr(selected_template, "header_image_url", None):
            try:
                header_path = (BASE_DIR / selected_template.header_image_url).resolve()
                if header_path.exists():
                    header_image_src = f"file://{header_path}"
            except Exception:
                header_image_src = None
        if getattr(selected_template, "background_image_url", None):
            try:
                bg_path = (BASE_DIR / selected_template.background_image_url).resolve()
                if bg_path.exists():
                    background_image_src = f"file://{bg_path}"
            except Exception:
                background_image_src = None
        if getattr(selected_template, "category_separator_image_url", None):
            try:
                separator_path = (BASE_DIR / selected_template.category_separator_image_url).resolve()
                if separator_path.exists():
                    category_separator_image_url = f"file://{separator_path}"
            except Exception:
                category_separator_image_url = None
    
    # Отримуємо назву компанії з налаштувань або використовуємо дефолтну
    company_name = crud.get_setting(db, "company_name") or "Дзиґа Кейтерінґ"
    
    # Форматуємо дати для шаблону
    created_date = kp.created_at.strftime("%d.%m.%Y") if kp.created_at else ""
    event_date = ""
    # Використовуємо окреме поле дати події, якщо воно є
    if getattr(kp, "event_date", None):
        try:
            event_date = kp.event_date.strftime("%d.%m.%Y")
        except Exception:
            event_date = ""
    
    # Визначаємо ефективну кількість гостей:
    #  - якщо в kp.people_count є значення > 0 — використовуємо його
    #  - інакше беремо максимальне people_count серед форматів (якщо там задано)
    #  - якщо ніде не вказано — вважаємо 0 (без розрахунку на людину)
    effective_people_count = kp.people_count or 0
    if not effective_people_count and formats_map:
        max_from_formats = max((fmt.get("people_count") or 0) for fmt in formats_map.values())
        effective_people_count = max_from_formats or 0

    # Допоміжна функція для форматування чисел без нулів
    def format_number(num, decimals=2):
        """Форматує число без зайвих нулів після коми"""
        if num is None:
            return "0"
        if isinstance(num, (int, float)):
            # Якщо число ціле, показуємо без коми
            if num == int(num):
                return str(int(num))
            # Інакше показуємо з комою, але без зайвих нулів
            formatted = f"{num:.{decimals}f}"
            # Прибираємо зайві нулі в кінці
            return formatted.rstrip('0').rstrip('.')
        return str(num)
    
    # Форматуємо ціни та вагу (загальні по КП)
    food_total_raw = sum(item["total_raw"] for item in items_data)
    formatted_food_total = f"{format_number(food_total_raw)} грн"
    
    # Використовуємо вагу з бази даних, якщо вона є, інакше розраховуємо
    kp_total_weight = getattr(kp, "total_weight", None)
    kp_weight_per_person = getattr(kp, "weight_per_person", None)
    
    # total_weight з розрахунку в кг, конвертуємо в грами для порівняння
    calculated_total_weight_grams = total_weight * 1000 if total_weight else 0
    
    if kp_total_weight is not None:
        # Вага зберігається в грамах
        total_weight_grams_value = kp_total_weight
        formatted_total_weight = f"{format_number(kp_total_weight, 0)} г"
        calculated_weight_per_person = (
            kp_weight_per_person
            if kp_weight_per_person is not None
            else (kp_total_weight / effective_people_count if effective_people_count else 0)
        )
    else:
        # Якщо ваги немає в БД, використовуємо розраховану (в кг, конвертуємо в г)
        total_weight_grams_value = calculated_total_weight_grams
        formatted_total_weight = f"{format_number(calculated_total_weight_grams, 0)} г"
        calculated_weight_per_person = (
            calculated_total_weight_grams / effective_people_count
            if effective_people_count
            else 0
        )
    
    # Форматуємо вагу на особу
    formatted_weight_per_person = f"{format_number(calculated_weight_per_person, 0)} г" if calculated_weight_per_person else None
    
    # Конвертуємо Decimal з БД в float для уникнення помилок типів
    equipment_total = float(getattr(kp, "equipment_total", None) or 0)
    service_total = float(getattr(kp, "service_total", None) or 0)
    transport_total = float(getattr(kp, "transport_total", None) or 0)
    
    # Знижка по КП (як відсоток), якщо налаштована
    discount_percent: float | None = None
    if getattr(kp, "discount_benefit", None) and kp.discount_benefit.type == "discount":
        discount_percent = kp.discount_benefit.value
    
    # Підсумки по кожному формату меню
    formats: list[dict] = []
    for fmt in formats_map.values():
        # Використовуємо people_count формату, якщо він вказаний і > 0, інакше використовуємо effective_people_count
        people = fmt["people_count"] if fmt["people_count"] and fmt["people_count"] > 0 else effective_people_count
        food_total_fmt = fmt["food_total_raw"]
        fmt["food_total"] = food_total_fmt
        fmt["food_total_formatted"] = f"{format_number(food_total_fmt)} грн"
        fmt["price_per_person"] = (
            (food_total_fmt / people) if people and people > 0 else None
        )
        fmt["price_per_person_formatted"] = (
            f"{format_number(fmt['price_per_person'])} грн/люд" if fmt["price_per_person"] is not None else None
        )
        
        # Знижка по формату, якщо увімкнено блок знижки
        if discount_percent:
            discount_amount = food_total_fmt * discount_percent / 100.0
            total_after_discount = food_total_fmt - discount_amount
            fmt["discount_percent"] = discount_percent
            fmt["discount_amount"] = discount_amount
            fmt["discount_amount_formatted"] = f"{format_number(discount_amount)} грн"
            fmt["total_after_discount"] = total_after_discount
            fmt["total_after_discount_formatted"] = f"{format_number(total_after_discount)} грн"
            fmt["price_per_person_after_discount"] = (
                (total_after_discount / people) if people and people > 0 else None
            )
            fmt["price_per_person_after_discount_formatted"] = (
                f"{format_number(fmt['price_per_person_after_discount'])} грн/люд"
                if fmt["price_per_person_after_discount"] is not None
                else None
            )
        else:
            fmt["discount_percent"] = None
            fmt["discount_amount"] = None
            fmt["discount_amount_formatted"] = None
            fmt["total_after_discount"] = None
            fmt["total_after_discount_formatted"] = None
            fmt["price_per_person_after_discount"] = None
            fmt["price_per_person_after_discount_formatted"] = None
        
        formats.append(fmt)
    
    # Сортуємо формати за порядком
    formats = sorted(formats, key=lambda f: f.get("order_index", 0))

    # Загальний підсумок по меню з урахуванням знижки (якщо є)
    total_menu_after_discount = 0.0
    for fmt in formats:
        if discount_percent and fmt.get("total_after_discount") is not None:
            total_menu_after_discount += fmt["total_after_discount"]
        else:
            total_menu_after_discount += fmt["food_total"]

    # Розраховуємо загальну знижку (якщо є)
    total_discount_amount = 0.0
    if discount_percent:
        # Сума знижки = різниця між сумою меню до та після знижки
        total_menu_before_discount = sum(fmt["food_total"] for fmt in formats)
        total_discount_amount = total_menu_before_discount - total_menu_after_discount
    
    # Загальна сума до оплати (меню + обладнання + сервіс + доставка)
    grand_total = total_menu_after_discount + equipment_total + service_total + transport_total
    fop_percent = 7.0  # Комісія ФОП 3-ї категорії
    fop_extra = grand_total * fop_percent / 100.0
    grand_total_with_fop = grand_total + fop_extra

    # Розраховуємо ціну на особу, вагу на особу, мл на особу
    price_per_person_total = grand_total / effective_people_count if effective_people_count and grand_total > 0 else None
    formatted_price_per_person_total = f"{format_number(price_per_person_total)} грн" if price_per_person_total else None
    
    # Вага на особу (вже розрахована вище)
    formatted_weight_per_person = f"{format_number(calculated_weight_per_person, 0)} г" if calculated_weight_per_person else None
    
    # Мл на особу
    ml_per_person = total_volume_ml / effective_people_count if effective_people_count and total_volume_ml > 0 else None
    formatted_ml_per_person = f"{format_number(ml_per_person, 0)} мл" if ml_per_person else None
    
    # Форматовані рядки для шаблону (без нулів після коми)
    grand_total_formatted = f"{format_number(grand_total)} грн"
    fop_extra_formatted = f"{format_number(fop_extra)} грн" if fop_extra else None
    grand_total_with_fop_formatted = f"{format_number(grand_total_with_fop)} грн"
    total_discount_amount_formatted = f"{format_number(total_discount_amount)} грн" if total_discount_amount > 0 else None
    
    # Сума сервісу та обладнання разом
    equipment_service_total = equipment_total + service_total
    equipment_service_total_formatted = f"{format_number(equipment_service_total)} грн" if equipment_service_total > 0 else None
    
    # Розраховуємо ціну на особу (загальна сума / кількість людей)
    price_per_person_total = grand_total / effective_people_count if effective_people_count and grand_total > 0 else None
    formatted_price_per_person_total = f"{format_number(price_per_person_total)} грн" if price_per_person_total else None
    
    # Розраховуємо мл на особу
    ml_per_person = total_volume_ml / effective_people_count if effective_people_count and total_volume_ml > 0 else None
    formatted_ml_per_person = f"{format_number(ml_per_person, 0)} мл" if ml_per_person else None
    
    # Налаштування теми шаблону (з дефолтами)
    primary_color = "#FF5A00"
    secondary_color = "#1a1a2e"
    text_color = "#333333"
    font_family = "Segoe UI, Tahoma, Geneva, Verdana, sans-serif"

    # Конфігурація відображення шаблону
    template_config = {
        'show_item_photo': True,
        'show_item_weight': True,
        'show_item_quantity': True,
        'show_item_price': True,
        'show_item_total': True,
        'show_item_description': False,
        'show_weight_summary': True,
        'show_weight_per_person': True,
        'show_discount_block': False,
        'show_equipment_block': True,
        'show_service_block': True,
        'show_transport_block': True,
        'menu_title': "Меню",
        'summary_title': "Підсумок",
        'footer_text': None,
        'page_orientation': 'portrait',
    }
    
    # Секції меню (категорії) – БЕЗ хардкоду, тільки з реальних страв КП.
    # 1) Збираємо всі унікальні category_name зі всіх форматів.
    all_categories: set[str] = set()
    for fmt in formats_map.values():
        for item in fmt["items"]:
            category_name = item.get("category_name")
            if category_name:
                all_categories.add(str(category_name))

    # 2) Формуємо список секцій. Якщо у страв немає категорій – залишаємо список порожнім.
    #    (у такому випадку шаблон може виводити всі страви без поділу на секції, якщо це потрібно)
    menu_sections = sorted(all_categories) if all_categories else []

    # 3) Формуємо підсумки по категоріях для відображення у підсумковій таблиці
    category_summaries = {}
    for category in menu_sections:
        category_summaries[category] = {
            "total_weight": 0.0,  # Загальна вага по категорії в кг
            "total_quantity": 0,  # Загальна кількість порцій
            "item_count": 0,      # Кількість різних страв у категорії
        }
    
    # Підраховуємо дані по категоріях з усіх форматів
    for fmt in formats_map.values():
        for item in fmt["items"]:
            category_name = item.get("category_name")
            if category_name and category_name in category_summaries:
                category_summaries[category_name]["total_weight"] += item.get("total_weight", 0)
                category_summaries[category_name]["total_quantity"] += item.get("quantity", 0)
                category_summaries[category_name]["item_count"] += 1
    
    # Конвертуємо ваги в грами та форматуємо для відображення
    category_summaries_formatted = []
    for category in menu_sections:
        data = category_summaries[category]
        weight_grams = data["total_weight"] * 1000  # Конвертуємо кг в г
        category_summaries_formatted.append({
            "name": category,
            "total_weight_grams": weight_grams,
            "total_weight_formatted": f"{weight_grams:.0f} г",
            "total_quantity": data["total_quantity"],
            "item_count": data["item_count"],
        })

    # Кольори елементів PDF (дефолтні)
    format_bg_color = "#FF8C00"
    table_header_bg_color = "#FFA500"
    category_bg_color = "#FFB84D"
    summary_bg_color = "#F3F4F6"
    total_bg_color = "#FF8C00"
    
    # Налаштування тексту категорій та страв (дефолтні)
    category_text_align = "center"
    category_text_color = None
    dish_text_align = "left"
    dish_text_color = None
    
    # Шрифти (дефолтні)
    title_font = "Montserrat, Arial, sans-serif"
    header_font = "Montserrat, Arial, sans-serif"
    body_font = "Inter, Arial, sans-serif"
    table_font = "Inter, Arial, sans-serif"
    
    # Заголовок КП (дефолтні)
    title_text = "КОМЕРЦІЙНА ПРОПОЗИЦІЯ"
    template_company_name = "ДЗИҐА КЕЙТЕРІНҐ"
    
    if selected_template:
        primary_color = getattr(selected_template, "primary_color", None) or primary_color
        secondary_color = getattr(selected_template, "secondary_color", None) or secondary_color
        text_color = getattr(selected_template, "text_color", None) or text_color
        font_family = getattr(selected_template, "font_family", None) or font_family
        # Шрифти з шаблону
        title_font = getattr(selected_template, "title_font", None) or title_font
        header_font = getattr(selected_template, "header_font", None) or header_font
        body_font = getattr(selected_template, "body_font", None) or body_font
        table_font = getattr(selected_template, "table_font", None) or table_font
        # Заголовок КП з шаблону
        title_text = getattr(selected_template, "title_text", None) or title_text
        template_company_name = getattr(selected_template, "company_name", None) or template_company_name
        # Кольори елементів PDF з шаблону
        format_bg_color = getattr(selected_template, "format_bg_color", None) or format_bg_color
        table_header_bg_color = getattr(selected_template, "table_header_bg_color", None) or table_header_bg_color
        category_bg_color = getattr(selected_template, "category_bg_color", None) or category_bg_color
        summary_bg_color = getattr(selected_template, "summary_bg_color", None) or summary_bg_color
        total_bg_color = getattr(selected_template, "total_bg_color", None) or total_bg_color
        
        # Налаштування тексту категорій та страв з шаблону
        category_text_align = getattr(selected_template, "category_text_align", None) or category_text_align
        category_text_color = getattr(selected_template, "category_text_color", None) or category_text_color
        dish_text_align = getattr(selected_template, "dish_text_align", None) or dish_text_align
        dish_text_color = getattr(selected_template, "dish_text_color", None) or dish_text_color
        
        # Оновлюємо конфігурацію з налаштувань шаблону
        # ВАЖЛИВО: menu_sections тепер завжди приходять з реальних категорій страв
        # і не можуть бути перезаписані хардкодженим списком з шаблону.
        template_config.update({
            'show_item_photo': getattr(selected_template, 'show_item_photo', True),
            'show_item_weight': getattr(selected_template, 'show_item_weight', True),
            'show_item_quantity': getattr(selected_template, 'show_item_quantity', True),
            'show_item_price': getattr(selected_template, 'show_item_price', True),
            'show_item_total': getattr(selected_template, 'show_item_total', True),
            'show_item_description': getattr(selected_template, 'show_item_description', False),
            'show_weight_summary': getattr(selected_template, 'show_weight_summary', True),
            'show_weight_per_person': getattr(selected_template, 'show_weight_per_person', True),
            'show_discount_block': getattr(selected_template, 'show_discount_block', False),
            'show_equipment_block': getattr(selected_template, 'show_equipment_block', True),
            'show_service_block': getattr(selected_template, 'show_service_block', True),
            'show_transport_block': getattr(selected_template, 'show_transport_block', True),
            'menu_title': getattr(selected_template, 'menu_title', None) or "Меню",
            'summary_title': getattr(selected_template, 'summary_title', None) or "Підсумок",
            'footer_text': getattr(selected_template, 'footer_text', None),
            'page_orientation': getattr(selected_template, 'page_orientation', None) or 'portrait',
            'summary_lines': getattr(selected_template, 'summary_lines', None),
        })

    # Конвертуємо dict в простий об'єкт для доступу через крапку в Jinja2
    class TemplateConfig:
        def __init__(self, config_dict):
            for key, value in config_dict.items():
                setattr(self, key, value)
    
    template_config_obj = TemplateConfig(template_config)

    # Форматуємо вагу на людину (округлюємо до 2 знаків)
    formatted_weight_per_person = f"{round(calculated_weight_per_person, 2):.2f} г" if calculated_weight_per_person else None
    
    # Обробляємо фото галереї (конвертуємо в file:// URLs для WeasyPrint)
    # Беремо фото з шаблону (а не з КП)
    gallery_photos_src = []
    if selected_template and getattr(selected_template, "gallery_photos", None):
        for photo_url in selected_template.gallery_photos:
            if photo_url:
                try:
                    # Якщо це вже абсолютний URL або data URL, залишаємо як є
                    if photo_url.startswith('http') or photo_url.startswith('data:') or photo_url.startswith('file://'):
                        gallery_photos_src.append(photo_url)
                    else:
                        # Інакше конвертуємо відносний шлях в file:// URL
                        photo_path = (BASE_DIR / photo_url).resolve()
                        if photo_path.exists():
                            gallery_photos_src.append(f"file://{photo_path}")
                except Exception:
                    pass
    
    # Умови бронювання з шаблону (якщо є)
    booking_terms = None
    if selected_template and getattr(selected_template, "booking_terms", None):
        booking_terms = selected_template.booking_terms
    
    # Парсимо event_format якщо це JSON
    event_format_display = None
    if kp.event_format:
        try:
            import json
            parsed = json.loads(kp.event_format)
            if isinstance(parsed, list):
                # Формуємо читабельний рядок з масиву форматів
                parts = []
                for fmt in parsed:
                    if isinstance(fmt, dict):
                        part = fmt.get("format", "")
                        if fmt.get("time"):
                            part += f" ({fmt['time']})"
                        if part:
                            parts.append(part)
                event_format_display = ", ".join(parts) if parts else kp.event_format
            else:
                event_format_display = kp.event_format
        except (json.JSONDecodeError, TypeError):
            event_format_display = kp.event_format
    
    # Отримуємо дані менеджера (координатора) з created_by
    manager_name = None
    manager_phone = None
    manager_email = None
    if kp.created_by:
        # Формуємо ім'я з first_name та last_name
        name_parts = []
        if getattr(kp.created_by, "first_name", None):
            name_parts.append(kp.created_by.first_name)
        if getattr(kp.created_by, "last_name", None):
            name_parts.append(kp.created_by.last_name)
        if name_parts:
            manager_name = " ".join(name_parts)
        else:
            # Якщо немає first_name/last_name, використовуємо email
            manager_name = getattr(kp.created_by, "email", None) or "—"
        manager_email = getattr(kp.created_by, "email", None)
        # Телефон менеджера (якщо є поле phone в User)
        manager_phone = getattr(kp.created_by, "phone", None)
    
    # Фільтруємо обладнання та сервіс з kp.items
    equipment_items = []
    service_items = []
    
    # Знаходимо категорії "Обладнання" та "Обслуговування"
    equipment_category_name = "Обладнання"
    service_category_name = "Обслуговування"
    
    # Розділяємо суми обладнання та сервісу для розподілу custom items
    equipment_total_from_items = 0.0
    service_total_from_items = 0.0
    
    # Спочатку обробляємо items з категоріями
    for kp_item in kp.items:
        item = kp_item.item
        if not item:
            continue  # Custom items обробимо окремо
        
        # Перевіряємо категорію через subcategory
        category_name = None
        if item.subcategory and item.subcategory.category:
            category_name = item.subcategory.category.name
        
        # Формуємо дані для обладнання
        if category_name == equipment_category_name:
            item_total = (item.price or 0) * kp_item.quantity
            equipment_item = {
                "name": item.name,
                "rental_price": item.price or 0,  # Ціна прокату
                "loss_price": item.loss_price or 0,  # Ціна втрати
                "quantity": kp_item.quantity,
                "total": item_total,
            }
            equipment_items.append(equipment_item)
            equipment_total_from_items += item_total
        
        # Формуємо дані для сервісу
        elif category_name == service_category_name:
            item_total = (item.price or 0) * kp_item.quantity
            service_item = {
                "name": item.name,
                "total": item_total,
            }
            service_items.append(service_item)
            service_total_from_items += item_total
    
    # Тепер обробляємо custom items (без item_id) - це обладнання або сервіс
    for kp_item in kp.items:
        item = kp_item.item
        if not item and kp_item.name:
            # Custom item - визначаємо тип на основі того, чи сума відповідає equipment_total чи service_total
            item_total = (kp_item.price or 0) * kp_item.quantity
            
            # Якщо ще не досягли equipment_total, то це обладнання
            if equipment_total_from_items + item_total <= equipment_total + 0.01:  # Допуск на округлення
                equipment_item = {
                    "name": kp_item.name,
                    "rental_price": kp_item.price or 0,
                    "loss_price": 0,  # Для custom items loss_price не зберігається
                    "quantity": kp_item.quantity,
                    "total": item_total,
                }
                equipment_items.append(equipment_item)
                equipment_total_from_items += item_total
            else:
                # Інакше це сервіс
                service_item = {
                    "name": kp_item.name,
                    "total": item_total,
                }
                service_items.append(service_item)
                service_total_from_items += item_total
    
    html_content = template.render(
        kp=kp,
        people_count=effective_people_count,
        items=items_data,
        formats=formats,
        # Підсумки по кухні та додаткових блоках
        food_total=formatted_food_total,
        equipment_total=f"{format_number(equipment_total)} грн" if equipment_total else None,
        service_total=f"{format_number(service_total)} грн" if service_total else None,
        transport_total=f"{format_number(transport_total)} грн" if transport_total else None,
        total_weight=formatted_total_weight,
        total_weight_grams=total_weight_grams_value,
        weight_per_person=formatted_weight_per_person,
        total_items=len(items_data),
        logo_src=logo_src,
        header_image_src=header_image_src,
        background_image_src=background_image_src,
        category_separator_image_url=category_separator_image_url,
        primary_color=primary_color,
        secondary_color=secondary_color,
        text_color=text_color,
        font_family=font_family,
        # Шрифти
        title_font=title_font,
        header_font=header_font,
        body_font=body_font,
        table_font=table_font,
        # Заголовок КП
        title_text=title_text,
        template_company_name=template_company_name,
        # Кольори елементів PDF
        format_bg_color=format_bg_color,
        table_header_bg_color=table_header_bg_color,
        category_bg_color=category_bg_color,
        summary_bg_color=summary_bg_color,
        total_bg_color=total_bg_color,
        # Налаштування тексту категорій та страв
        category_text_align=category_text_align,
        category_text_color=category_text_color,
        dish_text_align=dish_text_align,
        dish_text_color=dish_text_color,
        company_name=company_name,
        created_date=created_date,
        event_date=event_date,
        # Конфігурація та секції шаблону
        template_config=template_config_obj,
        menu_sections=menu_sections,
        category_summaries=category_summaries_formatted,
        # Загальні фінансові підсумки
        grand_total=grand_total,
        grand_total_formatted=grand_total_formatted,
        fop_percent=fop_percent,
        fop_extra=fop_extra,
        fop_extra_formatted=fop_extra_formatted,
        grand_total_with_fop=grand_total_with_fop,
        grand_total_with_fop_formatted=grand_total_with_fop_formatted,
        # Фото галереї
        gallery_photos=gallery_photos_src,
        # Умови бронювання
        booking_terms=booking_terms,
        # Форматований формат заходу (якщо був JSON)
        event_format_display=event_format_display,
        # Дані менеджера (координатора)
        manager_name=manager_name,
        manager_phone=manager_phone,
        manager_email=manager_email,
        # Обладнання та сервіс
        equipment_items=equipment_items,
        service_items=service_items,
        # Детальний підсумок
        total_discount_amount=total_discount_amount,
        total_discount_amount_formatted=total_discount_amount_formatted,
        discount_percent=discount_percent,
        equipment_service_total_formatted=equipment_service_total_formatted,
        # Дані для summary (використовуються в шаблоні)
        items_total=food_total_raw,
        items_total_formatted=formatted_food_total,
        services_total=service_total,
        services_total_formatted=f"{service_total:.2f} грн" if service_total else None,
        equipment_total_value=equipment_total,
        equipment_total_formatted=f"{format_number(equipment_total)} грн" if equipment_total else None,
        # Підсумок на особу
        price_per_person_total=price_per_person_total,
        price_per_person_total_formatted=formatted_price_per_person_total,
        ml_per_person=ml_per_person,
        ml_per_person_formatted=formatted_ml_per_person,
    )
    
    # base_url потрібен, щоб WeasyPrint коректно розумів відносні шляхи
    # Використовуємо BASE_DIR як base_url, щоб WeasyPrint міг знайти зображення та інші ресурси
    pdf_bytes = HTML(string=html_content, base_url=str(BASE_DIR)).write_pdf(zoom=1)
    filename = f"{kp.title}.pdf"
    
    return pdf_bytes, filename

@router.get("/kp/{kp_id}/pdf")
def generate_kp_pdf(kp_id: int, template_id: int = None, db: Session = Depends(get_db), user = Depends(get_current_user)):
    pdf_bytes, filename = generate_kp_pdf_bytes(kp_id, template_id, db)

    # Starlette кодує заголовки як latin-1, тому кирилиця в filename викликає UnicodeEncodeError.
    # Робимо безпечне ASCII-ім'я файлу.
    safe_filename = re.sub(r'[^A-Za-z0-9_.-]+', '_', filename)
    if not safe_filename or safe_filename == '.pdf':
        safe_filename = f'kp_{kp_id}.pdf'

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={'Content-Disposition': f'attachment; filename="{safe_filename}"'}
    )


@router.post("/kp", response_model=schema.KP)
def create_kp(kp_in: schema.KPCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    try:
        # Валідація клієнта
        client = None
        if kp_in.client_id:
            client = db.query(models.Client).filter(models.Client.id == kp_in.client_id).first()
            if not client:
                raise HTTPException(404, "Client not found")
        
        created_by_id = int(user.get("sub")) if user and user.get("sub") else None
        
        # Створення КП (без cashback_to_use, бо це не поле моделі)
        kp_data = kp_in.dict(exclude={"cashback_to_use"})
        
        # Розрахунок сум якщо не вказано
        if not kp_data.get("total_amount"):
            menu_total = Decimal(str(kp_data.get("menu_total", 0) or 0))
            equipment_total = Decimal(str(kp_data.get("equipment_total", 0) or 0))
            service_total = Decimal(str(kp_data.get("service_total", 0) or 0))
            transport_total = Decimal(str(kp_data.get("transport_total", 0) or 0))
            kp_data["total_amount"] = float(menu_total + equipment_total + service_total + transport_total)
            kp_data["final_amount"] = kp_data["total_amount"]
        
        kp = crud.create_kp(db, schema.KPCreate(**kp_data), created_by_id=created_by_id)
        
        # Оновити total_amount та final_amount в БД
        if kp_data.get("total_amount"):
            kp.total_amount = kp_data["total_amount"]
            kp.final_amount = kp_data["final_amount"]
            db.commit()
            db.refresh(kp)
        
        # Автоматично створюємо / оновлюємо клієнта на основі даних КП
        try:
            crud.upsert_client_from_kp(db, kp)
            # Оновити client_id якщо він був переданий
            if kp_in.client_id:
                kp.client_id = kp_in.client_id
                db.commit()
                db.refresh(kp)
                # Оновити client об'єкт
                client = db.query(models.Client).filter(models.Client.id == kp_in.client_id).first()
        except Exception as e:
            # Не ламаємо створення КП, якщо щось пішло не так з клієнтом
            print(f"Error upserting client from KP: {e}")
        
        # Використання кешбеку (якщо клієнт хоче)
        if client and kp_in.cashback_to_use and kp_in.cashback_to_use > 0:
            try:
                cashback_to_use_decimal = Decimal(str(kp_in.cashback_to_use))
                loyalty_service.apply_cashback_to_kp(db, kp, cashback_to_use_decimal)
                db.refresh(kp)
            except ValueError as e:
                raise HTTPException(400, str(e))
        
        # Нарахування кешбеку (якщо КП підтверджено)
        if client and kp.status == "confirmed":
            try:
                # Переконатися що client об'єкт пов'язаний з KP
                if not kp.client:
                    kp.client = client
                loyalty_service.earn_cashback_from_kp(db, kp)
                db.refresh(kp)
            except Exception as e:
                print(f"Error earning cashback from KP: {e}")
        
        # Якщо вказано email та потрібно відправити одразу
        if kp_in.send_email and kp_in.client_email:
            try:
                pdf_bytes, pdf_filename = generate_kp_pdf_bytes(kp.id, kp_in.template_id, db)
                send_kp_email(
                    to_email=kp_in.client_email,
                    kp_title=kp.title,
                    pdf_content=pdf_bytes,
                    pdf_filename=pdf_filename,
                    message=kp_in.email_message
                )
            except Exception as e:
                # Не викидаємо помилку, але логуємо
                print(f"Error sending email after KP creation: {e}")
                # Можна додати логування в базу даних або повернути попередження
        
        # Якщо вказано відправку в Telegram
        if kp_in.send_telegram and kp_in.client_phone:
            try:
                pdf_bytes, pdf_filename = generate_kp_pdf_bytes(kp.id, kp_in.template_id, db)
                
                # Обираємо Telegram акаунт за замовчуванням
                account = crud.get_first_active_telegram_account(db)
                if not account:
                    print("No active Telegram account configured; skipping Telegram send.")
                else:
                    send_kp_telegram(
                        session_string=account.session_string,
                        to_phone=kp_in.client_phone,
                        pdf_content=pdf_bytes,
                        pdf_filename=pdf_filename,
                        message=kp_in.telegram_message,
                    )
            except Exception as e:
                print(f"Error sending Telegram after KP creation: {e}")
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return kp

@router.get("/kp", response_model=list[schema.KP])
def list_kp(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_all_kps(db)


@router.get("/kp/{kp_id}", response_model=schema.KP)
def get_kp(kp_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """Отримати один КП за ID"""
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(status_code=404, detail="KP not found")
    return kp


@router.put("/kp/{kp_id}", response_model=schema.KP)
def update_kp(
    kp_id: int,
    kp_in: schema.KPCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Оновити існуючий КП"""
    kp = crud.update_kp(db, kp_id, kp_in)
    if not kp:
        raise HTTPException(status_code=404, detail="KP not found")
    
    # Якщо вказано email та потрібно відправити одразу
    if kp_in.send_email and kp_in.client_email:
        try:
            pdf_bytes, pdf_filename = generate_kp_pdf_bytes(kp.id, kp_in.template_id, db)
            send_kp_email(
                to_email=kp_in.client_email,
                kp_title=kp.title,
                pdf_content=pdf_bytes,
                pdf_filename=pdf_filename,
                message=kp_in.email_message
            )
        except Exception as e:
            print(f"Error sending email after KP update: {e}")
    
    # Якщо вказано відправку в Telegram
    if kp_in.send_telegram and kp_in.client_phone:
        try:
            pdf_bytes, pdf_filename = generate_kp_pdf_bytes(kp.id, kp_in.template_id, db)
            # Обираємо Telegram акаунт за замовчуванням
            account = crud.get_first_active_telegram_account(db)
            if not account:
                print("No active Telegram account configured; skipping Telegram send.")
            else:
                send_kp_telegram(
                    session_string=account.session_string,
                    to_phone=kp_in.client_phone,
                    pdf_content=pdf_bytes,
                    pdf_filename=pdf_filename,
                    message=kp_in.telegram_message,
                )
        except Exception as e:
            print(f"Error sending Telegram after KP update: {e}")


@router.post("/purchase/export")
def export_purchase_excel(
    export_in: schema.PurchaseExportRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Експорт файлу закупки на основі вибраних КП.

    Підтримує два типи розрахунку:
    - **catering**: кейтерінг (формула: вага × порції)
    - **box**: бокси (формула: вага × компоненти × порції)
    - **auto**: автовизначення на основі event_group КП
    """
    if not export_in.kp_ids:
        raise HTTPException(status_code=400, detail="Список KP ID порожній")

    if export_in.format != "excel":
        raise HTTPException(status_code=400, detail="Поки що підтримується лише формат 'excel'")

    try:
        excel_bytes, filename = generate_purchase_excel(
            db, 
            export_in.kp_ids,
            export_in.calculation_type
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[PURCHASE EXPORT ERROR] {error_trace}")
        raise HTTPException(status_code=500, detail=f"Помилка генерації закупки: {str(e)}")

    safe_filename = re.sub(r'[^A-Za-z0-9_.-]+', '_', filename)
    if not safe_filename or safe_filename == '.xlsx':
        safe_filename = 'purchase.xlsx'

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={'Content-Disposition': f'attachment; filename=\"{safe_filename}\"'},
    )


@router.post("/service/export")
def export_service_excel(
    export_in: schema.ServiceExportRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Експорт файлу для відділу сервісу на основі вибраних КП.

    Включає: обладнання, послуги, транспорт для кожного заходу.
    """
    if not export_in.kp_ids:
        raise HTTPException(status_code=400, detail="Список KP ID порожній")

    if export_in.format != "excel":
        raise HTTPException(status_code=400, detail="Поки що підтримується лише формат 'excel'")

    try:
        excel_bytes, filename = generate_service_excel(db, export_in.kp_ids)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[SERVICE EXPORT ERROR] {error_trace}")
        raise HTTPException(status_code=500, detail=f"Помилка генерації Excel для сервісу: {str(e)}")

    safe_filename = re.sub(r'[^A-Za-z0-9_.-]+', '_', filename)
    if not safe_filename or safe_filename == '.xlsx':
        safe_filename = 'service.xlsx'

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={'Content-Disposition': f'attachment; filename=\"{safe_filename}\"'},
    )


@router.post("/procurement/generate")
def generate_procurement(
    request: schema.ProcurementGenerateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Генерує Excel-файл закупки на основі вибраних КП.
    
    Формат файлу відповідає закупка.ods з трьома типами аркушів:
    1. "список продуктов" - зведений список продуктів з категоріями
    2. "Меню {Назва КП}" - меню для кухарів БЕЗ ЦІН
    3. "техкарта {Назва КП}" - техкарти страв з інгредієнтами
    """
    if not request.kp_ids:
        raise HTTPException(status_code=400, detail="Список KP ID порожній")

    try:
        excel_bytes, filename = generate_procurement_excel(db, request.kp_ids)
        
        # Використовуємо надану назву файлу або стандартну
        if request.filename:
            safe_filename = re.sub(r'[^A-Za-z0-9_.-]+', '_', request.filename)
            if not safe_filename.endswith('.xlsx'):
                safe_filename += '.xlsx'
        else:
            safe_filename = re.sub(r'[^A-Za-z0-9_.-]+', '_', filename)
            if not safe_filename or safe_filename == '.xlsx':
                safe_filename = 'procurement.xlsx'
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"[PROCUREMENT GENERATE ERROR] {error_trace}")
        raise HTTPException(status_code=500, detail=f"Помилка генерації Excel закупки: {str(e)}")

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={'Content-Disposition': f'attachment; filename=\"{safe_filename}\"'},
    )


# ============ Техкарти (Калькуляції) ============

@router.post("/recipes/import", response_model=schema.CalcImportResult)
async def import_calculations(
    file: UploadFile = File(...),
    recipe_type: str = "catering",
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Імпортує файл калькуляцій (техкарт) у форматі Excel.
    
    **Типи техкарт:**
    - **catering** (за замовчуванням): проста структура (страва → інгредієнти)
    - **box**: трирівнева структура (страва → компоненти → інгредієнти)
    
    **Очікуваний формат файлу:** "Оновлена закупка 2024" з листами:
    - "калькуляции" - техкарти страв
    - "список продуктов" - словник продуктів
    
    **Маркери в Excel:**
    - `point` - початок нової страви
    - `in` - початок компонента боксу (тільки для типу box)
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Файл має бути у форматі Excel (.xlsx)")
    
    if recipe_type not in ["catering", "box"]:
        raise HTTPException(status_code=400, detail="recipe_type має бути 'catering' або 'box'")
    
    content = await file.read()

    # Зберігаємо файл на диск та в БД, щоб можна було показати в UI/скачати/видалити
    try:
        CALC_FILES_DIR.mkdir(parents=True, exist_ok=True)
        file_uuid = str(uuid.uuid4())
        safe_ext = ".xlsx" if (file.filename or "").lower().endswith(".xlsx") else ".xls"
        stored_rel = f"calculations_files/{file_uuid}{safe_ext}"
        stored_abs = (UPLOADS_DIR / stored_rel).resolve()
        stored_abs.write_bytes(content)

        calc_file = models.CalculationsFile(
            filename=file.filename or f"calculations{safe_ext}",
            stored_path=stored_rel,
            recipe_type=recipe_type,
            size_bytes=len(content) if content else 0,
        )
        db.add(calc_file)
        db.flush()

        result = import_calculations_file(db, content, recipe_type)
        return result
    except Exception as e:
        db.rollback()
        # пробуємо прибрати файл, якщо він був створений
        try:
            if "stored_abs" in locals() and stored_abs.exists():
                stored_abs.unlink()
        except Exception:
            pass

        import traceback
        error_trace = traceback.format_exc()
        print(f"[IMPORT ERROR] {error_trace}")
        raise HTTPException(status_code=400, detail=f"Помилка імпорту: {str(e)}")


@router.get("/recipes", response_model=list[schema.Recipe])
def list_recipes(
    recipe_type: str = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Отримати список всіх техкарт.
    
    **Фільтри:**
    - recipe_type: 'catering', 'box' або None (всі)
    """
    recipes = get_all_recipes(db, recipe_type)
    # Фільтруємо техкарти з None name, щоб уникнути помилок валідації
    return [r for r in recipes if r.name is not None]


@router.get("/recipes/stats")
def get_recipes_stats(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Отримати статистику техкарт."""
    all_recipes = get_all_recipes(db)
    catering_count = sum(1 for r in all_recipes if r.recipe_type == "catering")
    box_count = sum(1 for r in all_recipes if r.recipe_type == "box")
    
    return {
        "total": len(all_recipes),
        "catering_count": catering_count,
        "box_count": box_count
    }


@router.get("/recipes/files", response_model=list[schema.CalculationsFile])
def list_calculations_files(
    recipe_type: Optional[str] = None,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Список завантажених файлів калькуляцій (для UI)."""
    q = db.query(models.CalculationsFile).order_by(models.CalculationsFile.id.desc())
    # Фільтруємо тільки файли з валідним recipe_type (catering або box)
    q = q.filter(models.CalculationsFile.recipe_type.in_(["catering", "box"]))
    if recipe_type in ["catering", "box"]:
        q = q.filter(models.CalculationsFile.recipe_type == recipe_type)
    return q.all()


@router.get("/recipes/{recipe_id}", response_model=schema.Recipe)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Отримати техкарту за ID."""
    from recipe_service import get_recipe_by_id
    recipe = get_recipe_by_id(db, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Техкарта не знайдена")
    return recipe


@router.post("/recipes/auto-link", response_model=schema.RecipeAutoLinkResult)
def auto_link_recipes_to_items_endpoint(
    recipe_type: Optional[str] = None,
    threshold: float = 0.80,
    update_item_weight: bool = True,
    force_relink: bool = False,
    create_missing_items: bool = False,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Автоматично зв'язує позиції меню (items) з техкартами (recipes) по схожості назв.
    Потрібно для швидкого розрахунку закупки по КП.
    """
    from recipe_service import auto_link_recipes_to_items

    rt = recipe_type if recipe_type in ["catering", "box"] else None
    result = auto_link_recipes_to_items(
        db,
        recipe_type=rt,
        threshold=threshold,
        update_item_weight=update_item_weight,
        force_relink=force_relink,
        create_missing_items=create_missing_items,
    )
    db.commit()
    return result


@router.get("/recipes/files/{file_id}/download")
def download_calculations_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Скачати завантажений файл калькуляцій."""
    rec = db.query(models.CalculationsFile).filter(models.CalculationsFile.id == file_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    abs_path = (UPLOADS_DIR / rec.stored_path).resolve()
    if not abs_path.exists():
        raise HTTPException(status_code=404, detail="Файл відсутній на диску")
    return FileResponse(
        path=str(abs_path),
        filename=rec.filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.delete("/recipes/files/{file_id}")
def delete_calculations_file(
    file_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Видалити запис про файл та сам файл з диску."""
    rec = db.query(models.CalculationsFile).filter(models.CalculationsFile.id == file_id).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    abs_path = (UPLOADS_DIR / rec.stored_path).resolve()
    try:
        if abs_path.exists():
            abs_path.unlink()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Не вдалося видалити файл: {e}")
    db.delete(rec)
    db.commit()
    return {"success": True, "id": file_id}


@router.post("/recipes", response_model=schema.Recipe)
def create_recipe_endpoint(
    recipe_in: schema.RecipeCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Створити техкарту вручну (з фронтенду)."""
    from recipe_service import create_recipe

    return create_recipe(
        db,
        name=recipe_in.name,
        recipe_type=recipe_in.recipe_type,
        category=recipe_in.category,
        weight_per_portion=recipe_in.weight_per_portion,
        notes=recipe_in.notes,
        ingredients=[i.model_dump() for i in (recipe_in.ingredients or [])],
        components=[c.model_dump() for c in (recipe_in.components or [])],
    )


@router.put("/recipes/{recipe_id}", response_model=schema.Recipe)
def update_recipe_endpoint(
    recipe_id: int,
    recipe_in: schema.RecipeCreate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Оновити техкарту вручну (замінює інгредієнти/компоненти)."""
    from recipe_service import update_recipe

    updated = update_recipe(
        db,
        recipe_id,
        name=recipe_in.name,
        recipe_type=recipe_in.recipe_type,
        category=recipe_in.category,
        weight_per_portion=recipe_in.weight_per_portion,
        notes=recipe_in.notes,
        ingredients=[i.model_dump() for i in (recipe_in.ingredients or [])],
        components=[c.model_dump() for c in (recipe_in.components or [])],
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Техкарта не знайдена")
    return updated


@router.patch("/recipes/{recipe_id}/link-item")
def link_recipe_to_item(
    recipe_id: int,
    item_id: Optional[int] = Body(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Підв'язати техкарту до страви (або відв'язати, якщо item_id=None)."""
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Техкарта не знайдена")
    
    if item_id is not None:
        # Перевіряємо, чи існує страва
        item = db.query(models.Item).filter(models.Item.id == item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail="Страва не знайдена")
        recipe.item_id = item_id
    else:
        # Відв'язуємо
        recipe.item_id = None
    
    db.commit()
    db.refresh(recipe)
    
    # Завантажуємо item для відповіді
    if recipe.item_id:
        recipe = (
            db.query(models.Recipe)
            .options(joinedload(models.Recipe.item))
            .filter(models.Recipe.id == recipe_id)
            .first()
        )
    
    return recipe


@router.delete("/recipes/{recipe_id}")
def delete_recipe_endpoint(
    recipe_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Видалити техкарту за ID."""
    from recipe_service import delete_recipe
    success = delete_recipe(db, recipe_id)
    if not success:
        raise HTTPException(status_code=404, detail="Техкарта не знайдена")
    return {"success": True, "message": "Техкарта видалена"}


@router.post("/purchase/calculate", response_model=schema.PurchaseCalculateResult)
def calculate_purchase(
    export_in: schema.PurchaseExportRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Розраховує закупку продуктів на основі вибраних КП та техкарт.
    
    **Типи розрахунку:**
    - **catering**: формула `вага × порції`
    - **box**: формула `вага × компоненти × порції`
    - **auto**: автовизначення на основі event_group КП
    
    Повертає список продуктів з кількостями та інформацію про страви без техкарт.
    """
    if not export_in.kp_ids:
        raise HTTPException(status_code=400, detail="Список KP ID порожній")
    
    try:
        result = calculate_purchase_from_kps(
            db, 
            export_in.kp_ids,
            export_in.calculation_type
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Помилка розрахунку: {str(e)}")


@router.patch("/kp/{kp_id}/status", response_model=schema.KP)
def update_kp_status(
    kp_id: int,
    status_in: schema.KPStatusUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Оновлення статусу КП (sent / approved / rejected / completed).
    """
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")

    kp.status = status_in.status
    db.commit()
    db.refresh(kp)
    return kp

@router.post("/kp/{kp_id}/send-email")
def send_kp_by_email(
    kp_id: int,
    email_request: schema.EmailSendRequest,
    template_id: int = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Відправляє КП на email клієнта
    """
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    
    # Генеруємо PDF
    try:
        pdf_bytes, pdf_filename = generate_kp_pdf_bytes(kp_id, template_id, db)
    except Exception as e:
        raise HTTPException(500, f"Error generating PDF: {str(e)}")
    
    # Відправляємо email
    try:
        send_kp_email(
            to_email=email_request.to_email,
            kp_title=kp.title,
            pdf_content=pdf_bytes,
            pdf_filename=pdf_filename,
            message=email_request.message
        )
        
        # Оновлюємо email в КП якщо він не був встановлений
        if not kp.client_email:
            kp.client_email = email_request.to_email
            db.commit()
        
        return {"status": "success", "message": f"КП відправлено на {email_request.to_email}"}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error sending email: {str(e)}")
        
@router.post("/kp/{kp_id}/send-telegram")
def send_kp_by_telegram(
    kp_id: int,
    telegram_request: schema.TelegramSendRequest,
    template_id: int = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Відправляє КП в Telegram клієнту за номером телефону.
    """
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    
    # Генеруємо PDF
    try:
        pdf_bytes, pdf_filename = generate_kp_pdf_bytes(kp_id, template_id, db)
    except Exception as e:
        raise HTTPException(500, f"Error generating PDF: {str(e)}")
    
    # Обираємо Telegram акаунт
    account = None
    if telegram_request.telegram_account_id is not None:
        account = crud.get_telegram_account(db, telegram_request.telegram_account_id)
    else:
        account = crud.get_first_active_telegram_account(db)
    
    if not account:
        raise HTTPException(400, "Не налаштовано жодного Telegram акаунта для відправки")
    
    # Відправляємо повідомлення
    try:
        send_kp_telegram(
            session_string=account.session_string,
            to_phone=telegram_request.to_phone,
            pdf_content=pdf_bytes,
            pdf_filename=pdf_filename,
            message=telegram_request.message,
        )
        
        # Зберігаємо телефон клієнта в КП, якщо його ще не було
        if not kp.client_phone:
            kp.client_phone = telegram_request.to_phone
            db.commit()
        
        return {"status": "success", "message": f"КП відправлено в Telegram на {telegram_request.to_phone}"}
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(500, f"Error sending Telegram message: {str(e)}")

@router.post("/kp/{kp_id}/upload-gallery-photo")
async def upload_kp_gallery_photo(
    kp_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Завантажує фото до галереї КП (максимум 9 фото).
    """
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    
    # Валідація типу файлу
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF"
        )
    
    # Перевіряємо, чи не перевищено ліміт фото
    # ВАЖЛИВО: для JSON-полів SQLAlchemy in-place зміни списку можуть не трекатись.
    current_photos = list(kp.gallery_photos or [])
    if len(current_photos) >= 9:
        raise HTTPException(400, "Максимум 9 фото для КП")
    
    # Створюємо унікальне ім'я файлу
    ext = Path(photo.filename).suffix.lower() if photo.filename else ".jpg"
    unique_filename = f"kp_{kp_id}_gallery_{len(current_photos) + 1}_{uuid.uuid4().hex[:8]}{ext}"
    
    # Створюємо директорію для фото КП, якщо її немає
    kp_gallery_dir = UPLOADS_DIR / "kp-gallery"
    kp_gallery_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = kp_gallery_dir / unique_filename
    
    # Зберігаємо файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)
    
    # Додаємо шлях до фото в БД
    relative_path = f"uploads/kp-gallery/{unique_filename}"
    current_photos.append(relative_path)
    kp.gallery_photos = current_photos
    
    db.commit()
    db.refresh(kp)
    
    return {
        "status": "success",
        "photo_url": relative_path,
        "gallery_photos": kp.gallery_photos
    }

@router.delete("/kp/{kp_id}/gallery-photo/{photo_index}")
def delete_kp_gallery_photo(
    kp_id: int,
    photo_index: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Видаляє фото з галереї КП за індексом (0-2).
    """
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")
    
    # ВАЖЛИВО: працюємо з копією (див. коментар вище)
    current_photos = list(kp.gallery_photos or [])
    if photo_index < 0 or photo_index >= len(current_photos):
        raise HTTPException(400, "Невірний індекс фото")
    
    # Видаляємо файл
    photo_path = BASE_DIR / current_photos[photo_index]
    try:
        if photo_path.exists():
            photo_path.unlink()
    except Exception as e:
        print(f"Error deleting photo file: {e}")
    
    # Видаляємо шлях з БД
    current_photos.pop(photo_index)
    kp.gallery_photos = current_photos
    
    db.commit()
    db.refresh(kp)
    
    return {
        "status": "success",
        "gallery_photos": kp.gallery_photos
    }

@router.get("/settings/booking-terms")
def get_default_booking_terms(db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    Повертає останні використані умови бронювання.
    """
    booking_terms = crud.get_setting(db, "default_booking_terms")
    return {"booking_terms": booking_terms or ""}

@router.post("/settings/booking-terms")
def save_default_booking_terms(
    booking_terms: str = Form(""),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Зберігає умови бронювання як дефолтні для майбутніх КП.
    """
    crud.set_setting(db, "default_booking_terms", booking_terms)
    return {"status": "success", "booking_terms": booking_terms}

@router.get("/settings/logo")
def get_company_logo(user = Depends(get_current_user)):
    """
    Повертає поточне лого компанії (якщо воно завантажене).
    """
    logo_path = get_company_logo_path()
    if not logo_path:
        return {"logo_url": None}
    
    # Віддаємо відносний шлях, який фронт може перетворити через /uploads
    rel_path = logo_path.relative_to(UPLOADS_DIR)
    return {"logo_url": f"/uploads/{rel_path.as_posix()}"}


@router.post("/settings/logo")
async def upload_company_logo(
    logo: UploadFile = File(...),
    user = Depends(get_current_user)
):
    """
    Завантажує / оновлює лого компанії.
    Очікується PNG з прозорим фоном, але технічно дозволяємо всі ALLOWED_IMAGE_TYPES.
    """
    if logo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF"
        )
    
    # Визначаємо розширення файлу (зберігаємо як logo.<ext>)
    ext = Path(logo.filename).suffix.lower() if logo.filename else ".png"
    if ext not in [".png", ".jpg", ".jpeg", ".webp", ".gif"]:
        ext = ".png"
    
    global COMPANY_LOGO_FILENAME
    COMPANY_LOGO_FILENAME = f"logo{ext}"
    logo_path = BRANDING_DIR / COMPANY_LOGO_FILENAME
    
    # Зберігаємо файл
    with open(logo_path, "wb") as buffer:
        shutil.copyfileobj(logo.file, buffer)
    
    rel_path = logo_path.relative_to(UPLOADS_DIR)
    return {"logo_url": f"/uploads/{rel_path.as_posix()}"}


@router.get("/settings/smtp")
def get_smtp_settings(db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    Повертає поточні SMTP налаштування.
    Пароль повертаємо як є (потрібно захищати доступ до налаштувань ролями на рівні додатку / nginx).
    """
    settings = crud.get_smtp_settings(db)
    return {
        "host": settings.get("smtp_host") or "",
        "port": settings.get("smtp_port") or "",
        "user": settings.get("smtp_user") or "",
        "password": settings.get("smtp_password") or "",
        "from_email": settings.get("smtp_from_email") or "",
        "from_name": settings.get("smtp_from_name") or "",
    }


@router.post("/settings/smtp")
def update_smtp_settings(
    host: str = Form(None),
    port: str = Form(None),
    user: str = Form(None),
    password: str = Form(None),
    from_email: str = Form(None),
    from_name: str = Form(None),
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user),
):
    """
    Оновлює SMTP налаштування, які використовуються при відправці КП.
    """
    try:
        # Нормалізуємо значення (замінюємо None на порожній рядок)
        host = host if host is not None else ""
        port = port if port is not None else ""
        user = user if user is not None else ""
        password = password if password is not None else ""
        from_email = from_email if from_email is not None else ""
        from_name = from_name if from_name is not None else ""
        
        crud.set_setting(db, "smtp_host", host)
        crud.set_setting(db, "smtp_port", port)
        crud.set_setting(db, "smtp_user", user)
        crud.set_setting(db, "smtp_password", password)
        crud.set_setting(db, "smtp_from_email", from_email)
        crud.set_setting(db, "smtp_from_name", from_name)
        
        return {"status": "success"}
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"❌ Error updating SMTP settings: {e}")
        print(f"Full traceback:\n{error_traceback}")
        raise HTTPException(
            status_code=500,
            detail=f"Помилка збереження SMTP налаштувань: {str(e)}"
        )


@router.get("/settings/telegram-config")
def get_telegram_config(db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    Повертає налаштування Telegram API (API ID, HASH, ім'я відправника).
    """
    settings = crud.get_telegram_api_settings(db)
    return {
        "api_id": settings.get("telegram_api_id") or "",
        "api_hash": settings.get("telegram_api_hash") or "",
        "sender_name": settings.get("telegram_sender_name") or "",
    }


@router.post("/settings/telegram-config")
def update_telegram_config(
    api_id: str = Form(""),
    api_hash: str = Form(""),
    sender_name: str = Form(""),
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user),
):
    """
    Оновлює налаштування Telegram API.
    """
    crud.set_setting(db, "telegram_api_id", api_id)
    crud.set_setting(db, "telegram_api_hash", api_hash)
    crud.set_setting(db, "telegram_sender_name", sender_name)
    return {"status": "success"}


@router.post("/settings/import-menu-csv")
async def import_menu_csv_endpoint(
    file: UploadFile = File(...),
    user = Depends(get_current_user),
):
    """
    Імпорт меню з CSV-файлу в базу даних.

    З frontend завантажується CSV (експорт з Excel меню),
    файл тимчасово зберігається в uploads/imports, парситься
    та імпортується в таблиці categories / subcategories / items.
    """
    # Зберігаємо тимчасовий файл
    imports_dir = UPLOADS_DIR / "imports"
    imports_dir.mkdir(parents=True, exist_ok=True)

    temp_path = imports_dir / file.filename
    contents = await file.read()
    with temp_path.open("wb") as f:
        f.write(contents)

    # Парсимо та імпортуємо в БД
    items = parse_menu_csv(temp_path)
    import_menu_items(items)

    return {"status": "success", "created": len(items)}


@router.post("/items/update-from-excel")
async def update_items_from_excel_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Оновлює існуючі страви з Excel файлу.
    
    Обробляє Excel файл з аркушами (категорії) та рядками (страви):
    - Назва аркуша = категорія
    - Рядки без ціни = підкатегорії
    - Рядки з ціною = страви
    
    Оновлює: ціну, категорію, підкатегорію для існуючих страв по назві.
    """
    # Перевіряємо формат файлу
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xls') or file.filename.endswith('.xlsm')):
        raise HTTPException(status_code=400, detail="Файл має бути у форматі Excel (.xlsx, .xls або .xlsm)")
    
    # Зберігаємо тимчасовий файл
    imports_dir = UPLOADS_DIR / "imports"
    imports_dir.mkdir(parents=True, exist_ok=True)
    
    temp_path = imports_dir / f"update_{uuid.uuid4().hex[:8]}_{file.filename}"
    contents = await file.read()
    with temp_path.open("wb") as f:
        f.write(contents)
    
    try:
        file_size = temp_path.stat().st_size
        logger.info(f"[UPDATE_EXCEL] Початок обробки файлу: {file.filename}, розмір: {file_size} bytes")
        print(f"[UPDATE_EXCEL] Початок обробки файлу: {file.filename}, розмір: {file_size} bytes", flush=True)
        
        # Генеруємо дані для оновлення з Excel
        logger.info(f"[UPDATE_EXCEL] Виклик generate_menu_patch_from_excel для файлу: {temp_path}")
        print(f"[UPDATE_EXCEL] Виклик generate_menu_patch_from_excel", flush=True)
        
        items_data = generate_menu_patch_from_excel(temp_path)
        
        logger.info(f"[UPDATE_EXCEL] Отримано {len(items_data)} страв для оновлення")
        print(f"[UPDATE_EXCEL] Отримано {len(items_data)} страв для оновлення", flush=True)
        
        if not items_data:
            error_msg = "Не знайдено жодної страви в Excel файлі. Перевірте формат файлу: перша колонка - назва, друга - ціна"
            print(f"[UPDATE_EXCEL] ПОМИЛКА: {error_msg}", flush=True)
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Оновлюємо страви в БД
        stats = update_items_from_data(items_data, dry_run=False, db_session=db)
        
        print(f"[UPDATE_EXCEL] Оновлено страв: {stats['updated']}, знайдено: {stats['found']}")
        
        # Формуємо результат
        result = {
            "status": "success",
            "found": stats['found'],
            "updated": stats['updated'],
            "created_categories": stats['created_categories'],
            "created_subcategories": stats['created_subcategories'],
            "not_found_count": len(stats['not_found']),
            "errors_count": len(stats['errors']),
            "not_found": stats['not_found'][:50],  # Перші 50 для не перевантаження відповіді
            "errors": stats['errors'][:20]  # Перші 20 помилок
        }
        
        return result
        
    except ValueError as e:
        import traceback
        error_detail = str(e)
        print(f"[UPDATE_EXCEL] ValueError: {error_detail}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=400, detail=error_detail)
    except Exception as e:
        import traceback
        error_detail = f"Помилка обробки файлу: {str(e)}"
        print(f"[UPDATE_EXCEL] Exception: {error_detail}", flush=True)
        print(traceback.format_exc(), flush=True)
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        # Видаляємо тимчасовий файл
        try:
            if temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass


@router.get("/settings/telegram-accounts", response_model=list[schema.TelegramAccount])
def list_telegram_accounts(db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    Повертає всі активні Telegram акаунти, з яких можна надсилати КП.
    """
    return crud.get_telegram_accounts(db)


@router.post("/settings/telegram-accounts", response_model=schema.TelegramAccount)
def create_telegram_account(
    account_in: schema.TelegramAccountCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Додає Telegram акаунт для відправки КП (звичайний акаунт, не бот).
    Очікується, що session_string вже згенерований окремим інструментом.
    """
    return crud.create_telegram_account(db, account_in)


@router.delete("/settings/telegram-accounts/{account_id}")
def delete_telegram_account(
    account_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """
    Видаляє/деактивує Telegram акаунт.
    """
    deleted = crud.delete_telegram_account(db, account_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Telegram account not found")
    return {"status": "success"}

# Categories
@router.get("/categories", response_model=list[schema.Category])
def get_categories(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_categories(db)

@router.post("/categories", response_model=schema.Category)
def create_category(category: schema.CategoryCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_category(db, category.name)

@router.delete('/categories/{category_id}')
def delete_category(category_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_category(db, category_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"status": "success"}

# Subcategories
@router.get("/subcategories", response_model=list[schema.Subcategory])
def get_subcategories(category_id: int = None, db: Session = Depends(get_db), user = Depends(get_current_user)):
    subcategories = crud.get_subcategories(db, category_id)
    # Фільтруємо subcategories з None name, щоб уникнути помилок валідації
    return [sc for sc in subcategories if sc.name is not None]

@router.post("/subcategories", response_model=schema.Subcategory)
def create_subcategory(subcategory: schema.SubcategoryCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_subcategory(db, subcategory.name, subcategory.category_id)

@router.delete("/subcategories/{subcategory_id}")
def delete_subcategory(subcategory_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_subcategory(db, subcategory_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Subcategory not found")
    return {"status": "success"}

@router.post("/categories/bulk-delete")
def bulk_delete_categories(
    request: schema.BulkDeleteRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Видаляє кілька категорій одразу."""
    if not request.ids:
        raise HTTPException(status_code=400, detail="Список ID порожній")
    deleted = crud.delete_categories(db, request.ids)
    if not deleted:
        raise HTTPException(status_code=404, detail="Категорії не знайдено")
    return {"status": "success", "deleted_count": len(request.ids)}

@router.post("/subcategories/bulk-delete")
def bulk_delete_subcategories(
    request: schema.BulkDeleteRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Видаляє кілька підкатегорій одразу."""
    if not request.ids:
        raise HTTPException(status_code=400, detail="Список ID порожній")
    deleted = crud.delete_subcategories(db, request.ids)
    if not deleted:
        raise HTTPException(status_code=404, detail="Підкатегорії не знайдено")
    return {"status": "success", "deleted_count": len(request.ids)}


############################################################
# Users (admin only)
############################################################

@router.get("/users", response_model=list[schema.UserOut])
def list_users(db: Session = Depends(get_db), current_user = Depends(get_current_user_db)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    return crud_user.get_users(db)


@router.put("/users/{user_id}", response_model=schema.UserOut)
def update_user(
    user_id: int,
    user_in: schema.UserUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_db),
):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    updated = crud_user.update_user(db, user_id, user_in)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return updated


############################################################
# Menus
############################################################

@router.get("/menus", response_model=list[schema.Menu])
def list_menus(db: Session = Depends(get_db), user = Depends(get_current_user)):
    menus = crud.get_menus(db)
    # Фільтруємо menus з None name, щоб уникнути помилок валідації
    return [menu for menu in menus if menu.name is not None]


@router.get("/menus/{menu_id}", response_model=schema.Menu)
def get_menu(menu_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    menu = crud.get_menu(db, menu_id)
    if not menu:
        raise HTTPException(status_code=404, detail="Menu not found")
    return menu


@router.post("/menus", response_model=schema.Menu)
def create_menu(menu_in: schema.MenuCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    try:
        return crud.create_menu(db, menu_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/menus/{menu_id}", response_model=schema.Menu)
def update_menu(
    menu_id: int,
    menu_in: schema.MenuUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    try:
        updated = crud.update_menu(db, menu_id, menu_in)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Menu not found")
    return updated


@router.delete("/menus/{menu_id}")
def delete_menu(menu_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    deleted = crud.delete_menu(db, menu_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Menu not found")
    return {"status": "success"}


############################################################
# Clients
# Note: Client endpoints are defined later in the file (around line 3396)
# to provide extended functionality with questionnaires and stats
############################################################


@router.post("/auth/register", response_model=schema.UserOut)
def register(user_in: schema.UserCreate, db: Session = Depends(get_db)):
    existing = crud_user.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    role = user_in.role or "user"
    user = crud_user.create_user(
        db,
        user_in.email,
        role,
        user_in.password,
        user_in.first_name,
        user_in.last_name,
    )

    return {"id": user.id, 
            "email": user.email, 
            "is_active": user.is_active, 
            "is_admin": user.is_admin, 
            "created_at": user.created_at, 
            "otpauth_url": None,
            "role": user.role
            }

@router.post("/auth/login")
def login(payload: schema.LoginRequest, db: Session = Depends(get_db)):
    user = crud_user.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.hashed_password:
        raise HTTPException(status_code=401, detail="User account has no password set. Please contact administrator.")
    
    # Verify password
    if not crud_user.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")
    
    crud_user.update_last_login(db, user)
    to_encode = {
        "sub": str(user.id), 
        "email": user.email, 
        "role": user.role,
        "is_admin": user.is_admin,
        "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/auth/forgot-password")
def forgot_password(
    request: schema.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Запит на скидання пароля. Відправляє email з 6-значним кодом.
    """
    import random
    from datetime import datetime, timezone, timedelta
    from email_service import send_password_reset_code
    
    # Перевіряємо чи існує користувач з таким email
    user = crud_user.get_user_by_email(db, request.email)
    if not user:
        # Не розкриваємо чи існує користувач (security best practice)
        return {"message": "Якщо email існує, код скидання пароля відправлено на вашу пошту"}
    
    # Генеруємо 6-значний код
    code = str(random.randint(100000, 999999))
    
    # Код дійсний 15 хвилин
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    # Створюємо запис коду в БД
    crud.create_password_reset_code(db, request.email, code, expires_at)
    
    # Відправляємо email
    try:
        send_password_reset_code(request.email, code)
    except Exception as e:
        error_detail = str(e)
        print(f"Error sending password reset email: {e}")
        # Якщо помилка містить деталі про підключення, показуємо їх
        if "підключення" in error_detail.lower() or "connection" in error_detail.lower():
            raise HTTPException(status_code=500, detail=error_detail)
        raise HTTPException(status_code=500, detail=f"Помилка відправки email: {error_detail}. Перевірте налаштування SMTP.")
    
    return {"message": "Якщо email існує, код скидання пароля відправлено на вашу пошту"}


@router.post("/auth/verify-reset-code")
def verify_reset_code(
    request: schema.VerifyResetCodeRequest,
    db: Session = Depends(get_db)
):
    """
    Перевіряє код скидання пароля.
    """
    reset_code = crud.get_valid_reset_code(db, request.email, request.code)
    if not reset_code:
        raise HTTPException(status_code=400, detail="Невірний або прострочений код")
    
    return {"message": "Код валідний"}


@router.post("/auth/reset-password")
def reset_password(
    request: schema.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Встановлює новий пароль після перевірки коду.
    """
    # Перевіряємо код
    reset_code = crud.get_valid_reset_code(db, request.email, request.code)
    if not reset_code:
        raise HTTPException(status_code=400, detail="Невірний або прострочений код")
    
    # Знаходимо користувача
    user = crud_user.get_user_by_email(db, request.email)
    if not user:
        raise HTTPException(status_code=404, detail="Користувач не знайдений")
    
    # Оновлюємо пароль
    crud_user.update_user_password(db, user, request.new_password)
    
    # Позначаємо код як використаний
    crud.mark_reset_code_as_used(db, reset_code)
    
    return {"message": "Пароль успішно змінено"}


# Template endpoints
@router.get("/templates", response_model=list[schema.Template])
def get_templates(db: Session = Depends(get_db), user = Depends(get_current_user)):
    templates = crud.get_templates(db)
    # Фільтруємо templates з None name, щоб уникнути помилок валідації
    return [template for template in templates if template.name is not None]

@router.get("/templates/{template_id}", response_model=schema.Template)
def get_template(template_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    """
    Повертає один шаблон КП.
    Додатково підтягує html_content з відповідного файлу, якщо він існує.
    """
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Підтягуємо HTML з файлу, якщо є filename
    if template.filename:
        template_path = UPLOADS_DIR / template.filename
        if template_path.exists():
            try:
                with template_path.open("r", encoding="utf-8") as f:
                    # Додаємо динамічне поле, яке зчитає Pydantic
                    template.html_content = f.read()
            except Exception as e:
                # Не падаємо, просто не віддаємо html_content
                print(f"Error reading template HTML file '{template_path}': {e}")

    return template

@router.post("/templates", response_model=schema.Template)
async def create_template(
    name: str = Form(...),
    filename: str = Form(None),
    description: str = Form(None),
    is_default: bool = Form(False),
    preview_image: UploadFile = File(None),
    preview_image_url: str = Form(None),
    html_content: str = Form(None),
    header_image: UploadFile = File(None),
    header_image_url: str = Form(None),
    background_image: UploadFile = File(None),
    background_image_url: str = Form(None),
    category_separator_image: UploadFile = File(None),
    category_separator_image_url: str = Form(None),
    # Налаштування теми (за замовчуванням — брендовані значення)
    primary_color: str = Form("#FF5A00"),
    secondary_color: str = Form("#1a1a2e"),
    text_color: str = Form("#333333"),
    font_family: str = Form("Segoe UI, Tahoma, Geneva, Verdana, sans-serif"),
    # Налаштування відображення колонок
    show_item_photo: bool = Form(True),
    show_item_weight: bool = Form(True),
    show_item_quantity: bool = Form(True),
    show_item_price: bool = Form(True),
    show_item_total: bool = Form(True),
    show_item_description: bool = Form(False),
    # Підсумкові блоки
    show_weight_summary: bool = Form(True),
    show_weight_per_person: bool = Form(True),
    show_discount_block: bool = Form(False),
    show_equipment_block: bool = Form(True),
    show_service_block: bool = Form(True),
    show_transport_block: bool = Form(True),
    # Секції меню та тексти
    menu_sections: str = Form(None),  # JSON-рядок масиву категорій
    menu_title: str = Form("Меню"),
    summary_title: str = Form("Підсумок"),
    footer_text: str = Form(None),
    summary_lines: str = Form(None),  # JSON-рядок масиву налаштувань summary
    # Layout
    page_orientation: str = Form("portrait"),
    items_per_page: int = Form(20),
    # Заголовок КП
    title_text: str = Form(None),
    company_name: str = Form(None),
    # Шрифти
    title_font: str = Form(None),
    header_font: str = Form(None),
    body_font: str = Form(None),
    table_font: str = Form(None),
    # Кольори PDF
    format_bg_color: str = Form(None),
    table_header_bg_color: str = Form(None),
    category_bg_color: str = Form(None),
    summary_bg_color: str = Form(None),
    total_bg_color: str = Form(None),
    # Налаштування тексту категорій та страв
    category_text_align: str = Form("center"),  # left, center, right
    category_text_color: str = Form(None),
    dish_text_align: str = Form("left"),  # left, center, right
    dish_text_color: str = Form(None),
    # Умови бронювання
    booking_terms: str = Form(None),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Створення шаблону КП.

    Варіанти:
    - Клієнт завантажує готовий HTML‑файл у файлову систему (старий варіант, через filename).
    - Клієнт вставляє HTML напряму (html_content) — ми створюємо / перезаписуємо файл uploads/{filename}
      всередині директорії `app/uploads`.
    - Якщо filename не передано або невалідний, автоматично генерується унікальний filename на основі ID.
    """

    # Валідація filename: якщо не передано або невалідний, використовуємо тимчасовий
    # Після створення в БД згенеруємо правильний на основі ID
    if filename and filename not in ['-', '-.html', '.html', '']:
        temp_filename = filename
    else:
        temp_filename = "temp_template.html"
    template_path = UPLOADS_DIR / temp_filename

    # Якщо html_content передано – створюємо / перезаписуємо файл
    template_path.parent.mkdir(parents=True, exist_ok=True)
    if html_content:
        try:
            with template_path.open("w", encoding="utf-8") as f:
                f.write(html_content)
            print(f"✓ Template file created successfully: {template_path}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error writing template file: {e}")
    else:
        # Якщо HTML не передали, копіюємо вміст дефолтного шаблону,
        # щоб PDF не був порожнім і шаблон можна було відредагувати пізніше з фронта
        try:
            default_template_path = UPLOADS_DIR / "commercial-offer.html"
            default_html = ""
            if default_template_path.exists():
                with default_template_path.open("r", encoding="utf-8") as df:
                    default_html = df.read()
            else:
                default_html = "<!-- KP template is empty. Please edit this template in the web UI. -->"

            with template_path.open("w", encoding="utf-8") as f:
                f.write(default_html)
            print(f"✓ Empty template file created from default: {template_path}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating empty template file: {e}")
    
    # ВАЛІДАЦІЯ: перевіряємо, що шаблон можна завантажити через Jinja2
    try:
        env = Environment(loader=FileSystemLoader(str(UPLOADS_DIR)))
        test_template = env.get_template(temp_filename)
        print(f"✓ Template validation passed: {temp_filename}")
    except Exception as e:
        # Видаляємо файл, якщо валідація не пройшла
        if template_path.exists():
            template_path.unlink()
        error_msg = str(e)
        # Якщо помилка про відсутність базового шаблону (extends/include)
        if "does not exist" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(
                status_code=400, 
                detail=f"Template file not found: {temp_filename}. Можливо, ваш HTML використовує extends або include з файлом, якого не існує в директорії uploads."
            )
        raise HTTPException(status_code=400, detail=f"Template validation error: {error_msg}")
    
    # Обробка прев'ю: пріоритет має завантажений файл
    final_preview_url = preview_image_url
    
    if preview_image:
        # Перевіряємо тип файлу
        if preview_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF")
        
        # Зберігаємо файл
        final_preview_url = save_template_preview(preview_image)
    else:
        # Якщо окремий файл прев'ю не завантажено – намагаємось
        # автоматично згенерувати прев'ю з HTML шаблону.
        # Раніше це працювало лише коли html_content приходив у запиті,
        # через що для шаблонів, створених з UI без явного HTML,
        # прев'ю взагалі не генерувалось.
        html_for_preview = None

        if html_content:
            # Якщо HTML передано в цьому запиті – використовуємо його напряму.
            html_for_preview = html_content
        else:
            # Інакше читаємо HTML з файлу, який ми щойно створили / скопіювали вище.
            try:
                if template_path.exists():
                    with template_path.open("r", encoding="utf-8") as f:
                        html_for_preview = f.read()
            except Exception as e:
                # Не падаємо, просто логуємо попередження
                print(f"⚠ Warning: failed to read template file for preview '{template_path}': {e}")

    # Обробка зображень шапки та фону
    final_header_url = header_image_url
    final_background_url = background_image_url
    final_separator_url = category_separator_image_url

    if header_image:
        if header_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу шапки. Дозволені: JPEG, PNG, WebP, GIF")
        final_header_url = save_template_preview(header_image)

    if background_image:
        if background_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу фону. Дозволені: JPEG, PNG, WebP, GIF")
        final_background_url = save_template_preview(background_image)

    if category_separator_image:
        if category_separator_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу розділювача. Дозволені: JPEG, PNG, WebP, GIF")
        final_separator_url = save_template_preview(category_separator_image)
    
    # Генеруємо прев'ю після обробки зображень (щоб мати актуальні URL)
    if html_for_preview:
        # Автоматично генеруємо прев'ю з HTML, якщо немає окремого файлу прев'ю.
        # (незалежно від того, чи передано preview_image_url)
        print(f"Generating automatic preview for template: {temp_filename}")
        auto_preview = generate_template_preview_image(
            html_for_preview,
            temp_filename,
            primary_color=primary_color,
            secondary_color=secondary_color,
            text_color=text_color,
            font_family=font_family,
            header_image_url=final_header_url,
            category_separator_image_url=final_separator_url,
            background_image_url=final_background_url,
        )
        if auto_preview:
            final_preview_url = auto_preview
        else:
            print(f"⚠ Warning: Failed to generate preview for template {temp_filename}")
    
    # Створюємо об'єкт TemplateCreate
    # Якщо menu_sections передані як JSON‑рядок – конвертуємо в список
    menu_sections_list = None
    if menu_sections:
        try:
            menu_sections_list = json.loads(menu_sections)
        except Exception:
            menu_sections_list = None

    # Якщо summary_lines передані як JSON‑рядок – конвертуємо в список
    summary_lines_list = None
    if summary_lines:
        try:
            parsed = json.loads(summary_lines)
            if isinstance(parsed, list):
                summary_lines_list = parsed
        except Exception:
            summary_lines_list = None

    template_data = schema.TemplateCreate(
        name=name,
        filename=temp_filename,  # Тимчасовий filename, буде оновлено після створення
        description=description,
        preview_image_url=final_preview_url,
        is_default=is_default,
        html_content=html_content,
        header_image_url=final_header_url,
        background_image_url=final_background_url,
        category_separator_image_url=final_separator_url,
        primary_color=primary_color or None,
        secondary_color=secondary_color or None,
        text_color=text_color or None,
        font_family=font_family or None,
        title_text=title_text if title_text is not None else None,
        company_name=company_name if company_name is not None else None,
        title_font=title_font if title_font is not None else None,
        header_font=header_font if header_font is not None else None,
        body_font=body_font if body_font is not None else None,
        table_font=table_font if table_font is not None else None,
        format_bg_color=format_bg_color if format_bg_color is not None else None,
        table_header_bg_color=table_header_bg_color if table_header_bg_color is not None else None,
        category_bg_color=category_bg_color if category_bg_color is not None else None,
        summary_bg_color=summary_bg_color if summary_bg_color is not None else None,
        total_bg_color=total_bg_color if total_bg_color is not None else None,
        category_text_align=category_text_align if category_text_align is not None else "center",
        category_text_color=category_text_color if category_text_color is not None else None,
        dish_text_align=dish_text_align if dish_text_align is not None else "left",
        dish_text_color=dish_text_color if dish_text_color is not None else None,
        show_item_photo=show_item_photo,
        show_item_weight=show_item_weight,
        show_item_quantity=show_item_quantity,
        show_item_price=show_item_price,
        show_item_total=show_item_total,
        show_item_description=show_item_description,
        show_weight_summary=show_weight_summary,
        show_weight_per_person=show_weight_per_person,
        show_discount_block=show_discount_block,
        show_equipment_block=show_equipment_block,
        show_service_block=show_service_block,
        show_transport_block=show_transport_block,
        menu_sections=menu_sections_list,
        menu_title=menu_title,
        summary_title=summary_title,
        footer_text=footer_text,
        summary_lines=summary_lines_list,
        page_orientation=page_orientation,
        items_per_page=items_per_page,
        booking_terms=booking_terms,
    )
    
    # Створюємо шаблон в БД
    new_template = crud.create_template(db, template_data)
    
    # Генеруємо унікальний filename на основі ID
    final_filename = f"template_{new_template.id}.html"
    final_template_path = UPLOADS_DIR / final_filename
    
    # Перейменовуємо файл з тимчасового на фінальний
    if template_path.exists():
        try:
            # Якщо фінальний файл вже існує (малоймовірно, але на всяк випадок)
            if final_template_path.exists() and final_template_path != template_path:
                final_template_path.unlink()
            template_path.rename(final_template_path)
            print(f"✓ Template file renamed from {temp_filename} to {final_filename}")
        except Exception as e:
            print(f"⚠ Warning: Failed to rename template file: {e}")
            # Якщо перейменування не вдалося, копіюємо базовий шаблон
            base_template_path = UPLOADS_DIR / "commercial-offer.html"
            if base_template_path.exists():
                shutil.copy(base_template_path, final_template_path)
                template_path.unlink()  # Видаляємо тимчасовий файл
            else:
                # Якщо базового шаблону немає, створюємо порожній
                with final_template_path.open("w", encoding="utf-8") as f:
                    f.write("<!-- KP template is empty. Please edit this template in the web UI. -->")
                template_path.unlink()
    else:
        # Якщо файл не існує, копіюємо базовий шаблон
        base_template_path = UPLOADS_DIR / "commercial-offer.html"
        if base_template_path.exists():
            shutil.copy(base_template_path, final_template_path)
            print(f"✓ Template file copied from base template to {final_filename}")
        else:
            # Якщо базового шаблону немає, створюємо порожній
            with final_template_path.open("w", encoding="utf-8") as f:
                f.write("<!-- KP template is empty. Please edit this template in the web UI. -->")
            print(f"✓ Empty template file created: {final_filename}")
    
    # Оновлюємо filename в БД
    new_template.filename = final_filename
    db.commit()
    db.refresh(new_template)
    
    return new_template

@router.put("/templates/{template_id}", response_model=schema.Template)
async def update_template(
    template_id: int,
    name: str = Form(None),
    filename: str = Form(None),
    description: str = Form(None),
    is_default: bool = Form(None),
    preview_image: UploadFile = File(None),
    preview_image_url: str = Form(None),
    html_content: str = Form(None),
    header_image: UploadFile = File(None),
    header_image_url: str = Form(None),
    background_image: UploadFile = File(None),
    background_image_url: str = Form(None),
    category_separator_image: UploadFile = File(None),
    category_separator_image_url: str = Form(None),
    primary_color: str = Form(None),
    secondary_color: str = Form(None),
    text_color: str = Form(None),
    font_family: str = Form(None),
    # Налаштування відображення колонок
    show_item_photo: bool = Form(None),
    show_item_weight: bool = Form(None),
    show_item_quantity: bool = Form(None),
    show_item_price: bool = Form(None),
    show_item_total: bool = Form(None),
    show_item_description: bool = Form(None),
    # Підсумкові блоки
    show_weight_summary: bool = Form(None),
    show_weight_per_person: bool = Form(None),
    show_discount_block: bool = Form(None),
    show_equipment_block: bool = Form(None),
    show_service_block: bool = Form(None),
    show_transport_block: bool = Form(None),
    # Секції меню та тексти
    menu_sections: str = Form(None),  # JSON-рядок
    menu_title: str = Form(None),
    summary_title: str = Form(None),
    footer_text: str = Form(None),
    summary_lines: str = Form(None),  # JSON-рядок масиву налаштувань summary
    # Layout
    page_orientation: str = Form(None),
    items_per_page: int = Form(None),
    # Заголовок КП
    title_text: str = Form(None),
    company_name: str = Form(None),
    # Шрифти
    title_font: str = Form(None),
    header_font: str = Form(None),
    body_font: str = Form(None),
    table_font: str = Form(None),
    # Кольори PDF
    format_bg_color: str = Form(None),
    table_header_bg_color: str = Form(None),
    category_bg_color: str = Form(None),
    summary_bg_color: str = Form(None),
    total_bg_color: str = Form(None),
    # Налаштування тексту категорій та страв
    category_text_align: str = Form(None),  # left, center, right
    category_text_color: str = Form(None),
    dish_text_align: str = Form(None),  # left, center, right
    dish_text_color: str = Form(None),
    # Умови бронювання
    booking_terms: str = Form(None),
    # Галерея фото
    gallery_photos: str = Form(None),  # JSON-рядок масиву URL
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Оновлення шаблону КП.
    Дозволяє як змінювати метадані, так і оновлювати HTML‑вміст файлу шаблону.
    """

    # Отримуємо поточний шаблон для видалення старого прев'ю
    current_template = crud.get_template(db, template_id)
    if not current_template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Ініціалізуємо змінні для URL зображень значеннями з БД
    final_header_url = current_template.header_image_url
    final_background_url = current_template.background_image_url
    final_separator_url = getattr(current_template, "category_separator_image_url", None)
    
    # Визначаємо фінальне ім'я файлу (якщо не передано нове — залишаємо старе)
    final_filename = filename or current_template.filename
    filename_was_generated = False
    
    # Валідація filename: якщо невалідний, генеруємо новий
    if not final_filename or final_filename in ['-', '-.html', '.html', '']:
        final_filename = f"template_{template_id}.html"
        filename_was_generated = True
        print(f"⚠ Invalid filename detected, generating new: {final_filename}")
        # Копіюємо базовий шаблон якщо файл не існує
        final_template_path = UPLOADS_DIR / final_filename
        if not final_template_path.exists():
            base_template_path = UPLOADS_DIR / "commercial-offer.html"
            if base_template_path.exists():
                shutil.copy(base_template_path, final_template_path)
                print(f"✓ Base template copied to {final_filename}")
            else:
                # Якщо базового шаблону немає, створюємо порожній
                with final_template_path.open("w", encoding="utf-8") as f:
                    f.write("<!-- KP template is empty. Please edit this template in the web UI. -->")
                print(f"✓ Empty template file created: {final_filename}")
    
    template_path = UPLOADS_DIR / final_filename

    # Оновлюємо файл шаблону:
    # - якщо є html_content — перезаписуємо його
    # - якщо немає, але файлу ще не існує — створюємо порожній шаблон
    template_path.parent.mkdir(parents=True, exist_ok=True)
    if html_content:
        try:
            with template_path.open("w", encoding="utf-8") as f:
                f.write(html_content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error writing template file: {e}")
    elif not os.path.exists(template_path):
        try:
            with template_path.open("w", encoding="utf-8") as f:
                f.write("<!-- KP template is empty. Please edit this template in the web UI. -->")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error creating empty template file: {e}")
    
    # Обробка прев'ю:
    # 1) Якщо завантажено новий файл прев'ю — використовуємо його.
    # 2) Якщо прев'ю не завантажено, намагаємось автоматично
    #    згенерувати його з актуального HTML (або з html_content, або з файлу).
    final_preview_url = current_template.preview_image_url
    
    if preview_image:
        # Перевіряємо тип файлу
        if preview_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF")
        
        # Видаляємо старе прев'ю якщо воно існує
        if current_template.preview_image_url:
            delete_old_preview(current_template.preview_image_url)
        # Зберігаємо новий файл
        final_preview_url = save_template_preview(preview_image)
    else:
        # Прагнемо мати прев'ю навіть якщо html_content не передали напряму.
        html_for_preview = None

        if html_content:
            # Якщо HTML оновлено в цьому запиті — використовуємо його.
            html_for_preview = html_content
        else:
            # Інакше читаємо HTML з фактичного файлу шаблону.
            try:
                if template_path.exists():
                    with template_path.open("r", encoding="utf-8") as f:
                        html_for_preview = f.read()
            except Exception as e:
                print(f"⚠ Warning: failed to read template file for preview '{template_path}': {e}")

        # Завжди регенеруємо прев'ю при оновленні шаблону, якщо є HTML
        if html_for_preview:
            # Автоматично (пере)генеруємо прев'ю з актуального HTML.
            print(f"Regenerating automatic preview for template: {final_filename}")
            # Видаляємо старе прев'ю
            if current_template.preview_image_url:
                delete_old_preview(current_template.preview_image_url)
            # Генеруємо нове превʼю з актуальними кольорами / шрифтом
            auto_preview = generate_template_preview_image(
                html_for_preview,
                final_filename,
                primary_color=primary_color if primary_color is not None else current_template.primary_color,
                secondary_color=secondary_color if secondary_color is not None else current_template.secondary_color,
                text_color=text_color if text_color is not None else current_template.text_color,
                font_family=font_family if font_family is not None else current_template.font_family,
                header_image_url=final_header_url,
                category_separator_image_url=final_separator_url,
                background_image_url=final_background_url,
            )
            if auto_preview:
                final_preview_url = auto_preview
                print(f"✓ Preview regenerated successfully: {auto_preview}")
            else:
                print(f"⚠ Warning: Failed to regenerate preview for template {final_filename}")
        elif template_path.exists():
            # Якщо html_content не передано, але файл існує - читаємо його та регенеруємо прев'ю
            try:
                with template_path.open("r", encoding="utf-8") as f:
                    html_for_preview = f.read()
                if html_for_preview:
                    print(f"Regenerating preview from template file: {final_filename}")
                    if current_template.preview_image_url:
                        delete_old_preview(current_template.preview_image_url)
                    auto_preview = generate_template_preview_image(
                        html_for_preview,
                        final_filename,
                        primary_color=primary_color if primary_color is not None else current_template.primary_color,
                        secondary_color=secondary_color if secondary_color is not None else current_template.secondary_color,
                        text_color=text_color if text_color is not None else current_template.text_color,
                        font_family=font_family if font_family is not None else current_template.font_family,
                        header_image_url=final_header_url,
                        category_separator_image_url=final_separator_url,
                        background_image_url=final_background_url,
                    )
                    if auto_preview:
                        final_preview_url = auto_preview
                        print(f"✓ Preview regenerated successfully: {auto_preview}")
            except Exception as e:
                print(f"⚠ Warning: failed to regenerate preview from file '{template_path}': {e}")
    
    # Обробка зображень шапки та фону
    if header_image:
        if header_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу шапки. Дозволені: JPEG, PNG, WebP, GIF")
        if current_template.header_image_url:
            delete_old_preview(current_template.header_image_url)
        final_header_url = save_template_preview(header_image)
    elif header_image_url is not None:
        # Можемо обнулити / змінити URL напряму
        # Якщо передано порожній рядок - обнуляємо, інакше використовуємо значення
        final_header_url = header_image_url.strip() if header_image_url and header_image_url.strip() else None

    if background_image:
        if background_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу фону. Дозволені: JPEG, PNG, WebP, GIF")
        if current_template.background_image_url:
            delete_old_preview(current_template.background_image_url)
        final_background_url = save_template_preview(background_image)
    elif background_image_url is not None:
        final_background_url = background_image_url.strip() if background_image_url and background_image_url.strip() else None

    if category_separator_image:
        if category_separator_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу розділювача. Дозволені: JPEG, PNG, WebP, GIF")
        if getattr(current_template, "category_separator_image_url", None):
            delete_old_preview(current_template.category_separator_image_url)
        final_separator_url = save_template_preview(category_separator_image)
    elif category_separator_image_url is not None:
        final_separator_url = category_separator_image_url.strip() if category_separator_image_url and category_separator_image_url.strip() else None

    # Створюємо об'єкт TemplateUpdate
    # Якщо menu_sections передані як JSON‑рядок – конвертуємо в список
    menu_sections_list = None
    if menu_sections is not None:
        try:
            parsed = json.loads(menu_sections)
            # Переконуємося, що це список
            if isinstance(parsed, list):
                menu_sections_list = parsed
            else:
                menu_sections_list = None
        except Exception:
            menu_sections_list = None

    # Якщо gallery_photos передані як JSON‑рядок – конвертуємо в список
    gallery_photos_list = None
    if gallery_photos is not None:
        try:
            parsed = json.loads(gallery_photos)
            # Переконуємося, що це список
            if isinstance(parsed, list):
                gallery_photos_list = parsed
            else:
                gallery_photos_list = None
        except Exception:
            gallery_photos_list = None

    # Якщо summary_lines передані як JSON‑рядок – конвертуємо в список
    summary_lines_list = None
    if summary_lines is not None:
        try:
            parsed = json.loads(summary_lines)
            # Переконуємося, що це список
            if isinstance(parsed, list):
                summary_lines_list = parsed
            else:
                summary_lines_list = None
        except Exception:
            summary_lines_list = None

    template_data = schema.TemplateUpdate(
        name=name,
        filename=final_filename if (filename or filename_was_generated) else None,
        description=description,
        preview_image_url=final_preview_url,
        is_default=is_default,
        html_content=html_content,
        header_image_url=final_header_url,
        background_image_url=final_background_url,
        category_separator_image_url=final_separator_url,
        primary_color=primary_color if primary_color is not None else None,
        secondary_color=secondary_color if secondary_color is not None else None,
        text_color=text_color if text_color is not None else None,
        font_family=font_family if font_family is not None else None,
        title_text=title_text if title_text is not None else None,
        company_name=company_name if company_name is not None else None,
        title_font=title_font if title_font is not None else None,
        header_font=header_font if header_font is not None else None,
        body_font=body_font if body_font is not None else None,
        table_font=table_font if table_font is not None else None,
        format_bg_color=format_bg_color if format_bg_color is not None else None,
        table_header_bg_color=table_header_bg_color if table_header_bg_color is not None else None,
        category_bg_color=category_bg_color if category_bg_color is not None else None,
        summary_bg_color=summary_bg_color if summary_bg_color is not None else None,
        total_bg_color=total_bg_color if total_bg_color is not None else None,
        category_text_align=category_text_align,
        category_text_color=category_text_color,
        dish_text_align=dish_text_align if dish_text_align is not None else None,
        dish_text_color=dish_text_color if dish_text_color is not None else None,
        show_item_photo=show_item_photo,
        show_item_weight=show_item_weight,
        show_item_quantity=show_item_quantity,
        show_item_price=show_item_price,
        show_item_total=show_item_total,
        show_item_description=show_item_description,
        show_weight_summary=show_weight_summary,
        show_weight_per_person=show_weight_per_person,
        show_discount_block=show_discount_block,
        show_equipment_block=show_equipment_block,
        show_service_block=show_service_block,
        show_transport_block=show_transport_block,
        menu_sections=menu_sections_list,
        menu_title=menu_title,
        summary_title=summary_title,
        footer_text=footer_text,
        summary_lines=summary_lines_list,
        page_orientation=page_orientation,
        items_per_page=items_per_page,
        booking_terms=booking_terms,
        gallery_photos=gallery_photos_list,
    )
    
    updated = crud.update_template(db, template_id, template_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Template not found")
    return updated

@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    # Отримуємо шаблон перед видаленням для перевірок та видалення прев'ю
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # ВАЖЛИВО:
    # Дозволяємо видаляти будь-який шаблон, навіть якщо він:
    #  - позначений як is_default
    #  - вже використовується в існуючих КП
    #
    # Для існуючих КП ми просто обнуляємо template_id.
    # Під час генерації PDF для такого КП код автоматично:
    #  - спробує взяти шаблон за заданим template_id (який тепер None),
    #  - потім fallback на шаблон за замовчуванням (якщо він є),
    #  - або на базовий файл `commercial-offer.html`.

    # Обнуляємо template_id у всіх КП, які посилаються на цей шаблон,
    # щоб уникнути помилок зовнішнього ключа та коректно перейти на дефолтний шаблон.
    db.query(models.KP).filter(models.KP.template_id == template_id).update(
        {models.KP.template_id: None}
    )
    db.commit()

    # Видаляємо прев'ю якщо воно існує
    if template.preview_image_url:
        delete_old_preview(template.preview_image_url)
    # Також видаляємо зображення шапки та фону, якщо вони збережені локально
    if getattr(template, "header_image_url", None):
        delete_old_preview(template.header_image_url)
    if getattr(template, "background_image_url", None):
        delete_old_preview(template.background_image_url)

    deleted = crud.delete_template(db, template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "success"}



############################################################
# Benefits (admin only)
############################################################

@router.get("/benefits", response_model=list[schema.Benefit])
def list_benefits(
    type: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    """Отримати список рівнів знижок/кешбеку. Можна фільтрувати за типом та активністю."""
    benefits = crud.get_benefits(db, type_filter=type, active_only=active_only)
    # Фільтруємо benefits з None name, щоб уникнути помилок валідації
    return [benefit for benefit in benefits if benefit.name is not None]


@router.get("/benefits/{benefit_id}", response_model=schema.Benefit)
def get_benefit(
    benefit_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    benefit = crud.get_benefit(db, benefit_id)
    if not benefit:
        raise HTTPException(status_code=404, detail="Benefit not found")
    return benefit


@router.post("/benefits", response_model=schema.Benefit)
def create_benefit(
    benefit_in: schema.BenefitCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_db),
):
    """Створити новий рівень знижки або кешбеку. Тільки для адмінів."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    if benefit_in.type not in ["discount", "cashback"]:
        raise HTTPException(status_code=400, detail="Type must be 'discount' or 'cashback'")
    
    return crud.create_benefit(db, benefit_in)


@router.put("/benefits/{benefit_id}", response_model=schema.Benefit)
def update_benefit(
    benefit_id: int,
    benefit_in: schema.BenefitUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_db),
):
    """Оновити рівень знижки або кешбеку. Тільки для адмінів."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    updated = crud.update_benefit(db, benefit_id, benefit_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Benefit not found")
    return updated


@router.delete("/benefits/{benefit_id}")
def delete_benefit(
    benefit_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user_db),
):
    """Видалити рівень знижки або кешбеку. Тільки для адмінів."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    deleted = crud.delete_benefit(db, benefit_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Benefit not found")
    return {"status": "success"}


# ============================================================
# Template Preview and Image Upload Endpoints
# ============================================================

@router.post("/templates/preview")
def generate_template_preview(
    request: dict = Body(...),
    db: Session = Depends(get_db),
):
    """
    Генерує PDF preview шаблону з тестовими даними.
    """
    try:
        design = request.get("design", {})
        sample_data = request.get("sample_data", {})
        
        # Завантажуємо шаблон HTML
        # Спочатку перевіряємо, чи є html_content в design
        html_content = design.get("html_content")
        if html_content:
            # Використовуємо HTML контент напряму
            from jinja2 import Template
            template = Template(html_content)
        else:
            # Використовуємо файл з UPLOADS_DIR
            template_dir = UPLOADS_DIR
            env = Environment(loader=FileSystemLoader(str(template_dir)))
            template_filename = design.get("filename", "commercial-offer.html")
            try:
                template = env.get_template(template_filename)
            except Exception as e:
                # Якщо файл не знайдено, використовуємо дефолтний
                template = env.get_template("commercial-offer.html")
        
        # Підготовка конфігурації шаблону
        template_config = {
            'show_item_photo': design.get('show_item_photo', True),
            'show_item_weight': design.get('show_item_weight', True),
            'show_item_quantity': design.get('show_item_quantity', True),
            'show_item_price': design.get('show_item_price', True),
            'show_item_total': design.get('show_item_total', True),
            'show_item_description': design.get('show_item_description', False),
            'show_weight_summary': design.get('show_weight_summary', True),
            'show_weight_per_person': design.get('show_weight_per_person', True),
            'show_equipment_block': design.get('show_equipment_block', True),
            'show_service_block': design.get('show_service_block', True),
            'show_transport_block': design.get('show_transport_block', True),
            'menu_title': design.get('menu_title', 'Меню'),
            'summary_title': design.get('summary_title', 'Підсумок'),
            'footer_text': design.get('footer_text'),
            'page_orientation': design.get('page_orientation', 'portrait'),
        }
        
        # Конфігурація як об'єкт
        class TemplateConfig:
            def __init__(self, config_dict):
                for key, value in config_dict.items():
                    setattr(self, key, value)
        
        template_config_obj = TemplateConfig(template_config)
        
        # Секції меню - динамічно збираємо з items sample_data (БЕЗ хардкоду)
        items_for_preview = sample_data.get('items', [])
        if items_for_preview:
            # Збираємо всі унікальні категорії зі страв
            menu_sections = sorted(list({
                str(item.get('category_name'))
                for item in items_for_preview
                if item.get('category_name')
            }))
        else:
            # Якщо в sample_data немає категорій, залишаємо список порожнім.
            # У такому випадку шаблон може виводити всі страви без секцій.
            menu_sections = []
        
        # Формуємо підсумки по категоріях для preview
        category_summaries = {}
        for category in menu_sections:
            category_summaries[category] = {
                "total_weight": 0.0,
                "total_quantity": 0,
                "item_count": 0,
            }
        
        # Підраховуємо дані по категоріях
        for item in items_for_preview:
            category_name = item.get('category_name')
            if category_name and category_name in category_summaries:
                # Вага може бути передана як weight_raw (в кг) або total_weight (загальна вага в кг)
                item_weight = item.get('total_weight', 0) or (item.get('weight_raw', 0) * item.get('quantity', 0))
                category_summaries[category_name]["total_weight"] += item_weight
                category_summaries[category_name]["total_quantity"] += item.get('quantity', 0)
                category_summaries[category_name]["item_count"] += 1
        
        # Форматуємо для відображення
        category_summaries_formatted = []
        for category in menu_sections:
            data = category_summaries[category]
            weight_grams = data["total_weight"] * 1000
            category_summaries_formatted.append({
                "name": category,
                "total_weight_grams": weight_grams,
                "total_weight_formatted": f"{weight_grams:.0f} г",
                "total_quantity": data["total_quantity"],
                "item_count": data["item_count"],
            })
        
        # Рендеримо HTML
        # Конвертуємо суми з рядків в числа
        def parse_amount(value):
            if isinstance(value, (int, float)):
                return float(value)
            if isinstance(value, str):
                return float(value.replace(' грн', '').replace(' ', '').replace(',', '.')) if 'грн' in value else 0.0
            return 0.0
        
        food_total_str = sample_data.get('food_total', '0 грн')
        food_total_raw = parse_amount(food_total_str)
        equipment_total = parse_amount(sample_data.get('equipment_total', 0))
        service_total = parse_amount(sample_data.get('service_total', 0))
        transport_total = parse_amount(sample_data.get('transport_total', 0))
        
        # Читаємо URL зображень з design
        header_image_url_from_design = design.get("header_image_url")
        category_separator_image_url_from_design = design.get("category_separator_image_url")
        background_image_url_from_design = design.get("background_image_url")
        
        # Отримуємо зображення з design (можуть бути base64 data URLs або file:// шляхи)
        logo_src = design.get('logo_image') or None
        header_image_src = design.get('header_image') or None
        background_image_src = design.get('background_image') or None
        category_separator_image_url = design.get('category_separator_image') or None
        
        # Конвертуємо URL зображень в file:// URL для WeasyPrint
        if header_image_url_from_design and not header_image_src:
            try:
                header_path = (BASE_DIR / header_image_url_from_design.lstrip('/')).resolve()
                if header_path.exists():
                    header_image_src = f"file://{header_path}"
            except Exception:
                pass
        
        if category_separator_image_url_from_design and not category_separator_image_url:
            try:
                sep_path = (BASE_DIR / category_separator_image_url_from_design.lstrip('/')).resolve()
                if sep_path.exists():
                    category_separator_image_url = f"file://{sep_path}"
            except Exception:
                pass
        
        if background_image_url_from_design and not background_image_src:
            try:
                bg_path = (BASE_DIR / background_image_url_from_design.lstrip('/')).resolve()
                if bg_path.exists():
                    background_image_src = f"file://{bg_path}"
            except Exception:
                pass
        
        # Перевіряємо, чи це base64 data URL, і якщо так, залишаємо як є (WeasyPrint підтримує)
        # Якщо це file:// шлях, також залишаємо як є
        # Якщо це відносний шлях, конвертуємо в абсолютний
        def process_image_src(src):
            if not src:
                return None
            if isinstance(src, str):
                # Якщо це вже data URL або file:// URL, залишаємо як є
                if src.startswith('data:') or src.startswith('file://'):
                    return src
                # Якщо це відносний шлях, конвертуємо в абсолютний file:// URL
                if not src.startswith('/') and not src.startswith('http'):
                    try:
                        img_path = (BASE_DIR / src).resolve()
                        if img_path.exists():
                            return f"file://{img_path}"
                    except Exception:
                        pass
            return src
        
        logo_src = process_image_src(logo_src)
        header_image_src = process_image_src(header_image_src)
        background_image_src = process_image_src(background_image_src)
        category_separator_image_url = process_image_src(category_separator_image_url)
        
        # Готуємо формати для прев'ю (для простоти – один формат на основі sample_data.kp)
        sample_kp = sample_data.get('kp', {})
        preview_people = sample_kp.get('people_count', 0)
        preview_format_name = sample_kp.get('event_format', 'Меню')
        preview_event_time = sample_kp.get('event_time')
        
        formats = [{
            "id": None,
            "name": preview_format_name,
            "event_time": preview_event_time,
            "people_count": preview_people,
            "order_index": 0,
            "items": sample_data.get('items', []),
            "food_total_raw": food_total_raw,
            "food_total": food_total_raw,
            "food_total_formatted": sample_data.get('food_total', '0 грн'),
            "price_per_person": (food_total_raw / preview_people) if preview_people else None,
        }]
        
        if formats[0]["price_per_person"] is not None:
            formats[0]["price_per_person_formatted"] = f"{formats[0]['price_per_person']:.2f} грн/люд"
        else:
            formats[0]["price_per_person_formatted"] = None
        
        # Для прев'ю можемо змоделювати знижку, якщо в design вказано show_discount_block
        discount_percent = None
        if design.get('show_discount_block'):
            discount_percent = 5.0
        
        if discount_percent:
            discount_amount = food_total_raw * discount_percent / 100.0
            total_after_discount = food_total_raw - discount_amount
            formats[0]["discount_percent"] = discount_percent
            formats[0]["discount_amount"] = discount_amount
            formats[0]["discount_amount_formatted"] = f"{discount_amount:.2f} грн"
            formats[0]["total_after_discount"] = total_after_discount
            formats[0]["total_after_discount_formatted"] = f"{total_after_discount:.2f} грн"
            if preview_people:
                price_after = total_after_discount / preview_people
                formats[0]["price_per_person_after_discount"] = price_after
                formats[0]["price_per_person_after_discount_formatted"] = f"{price_after:.2f} грн/люд"
            else:
                formats[0]["price_per_person_after_discount"] = None
                formats[0]["price_per_person_after_discount_formatted"] = None
        else:
            formats[0]["discount_percent"] = None
            formats[0]["discount_amount"] = None
            formats[0]["discount_amount_formatted"] = None
            formats[0]["total_after_discount"] = None
            formats[0]["total_after_discount_formatted"] = None
            formats[0]["price_per_person_after_discount"] = None
            formats[0]["price_per_person_after_discount_formatted"] = None

        # Загальний підсумок та FOP 7% для прев'ю
        total_menu_after_discount = (
            formats[0]["total_after_discount"]
            if discount_percent and formats[0].get("total_after_discount") is not None
            else formats[0]["food_total"]
        )
        grand_total = total_menu_after_discount + equipment_total + service_total + transport_total
        fop_percent = 7.0
        fop_extra = grand_total * fop_percent / 100.0
        grand_total_with_fop = grand_total + fop_extra
        grand_total_formatted = f"{grand_total:.2f} грн"
        fop_extra_formatted = f"{fop_extra:.2f} грн" if fop_extra else None
        grand_total_with_fop_formatted = f"{grand_total_with_fop:.2f} грн"
        
        # Розраховуємо price_per_person для відображення у верхньому блоці
        price_per_person_value = formats[0]["price_per_person"] if formats[0]["price_per_person"] is not None else None
        
        # Умови бронювання для прев'ю
        booking_terms_preview = design.get('booking_terms', None)
        print(f"[PREVIEW] booking_terms: {booking_terms_preview[:100] if booking_terms_preview else 'None'}...")
        
        # Галерея фото для прев'ю
        gallery_photos_preview = design.get('gallery_photos', [])
        print(f"[PREVIEW] gallery_photos from design: {gallery_photos_preview}")
        gallery_photos_src = []
        if gallery_photos_preview:
            for photo_url in gallery_photos_preview:
                if photo_url:
                    try:
                        if photo_url.startswith('http') or photo_url.startswith('data:') or photo_url.startswith('file://'):
                            gallery_photos_src.append(photo_url)
                            print(f"[PREVIEW] Photo URL (direct): {photo_url[:80]}...")
                        else:
                            # Спробуємо різні варіанти шляхів
                            photo_path = (BASE_DIR / photo_url).resolve()
                            print(f"[PREVIEW] Trying path: {photo_path}, exists: {photo_path.exists()}")
                            if photo_path.exists():
                                gallery_photos_src.append(f"file://{photo_path}")
                            else:
                                # Спробуємо з app/ директорії
                                alt_path = (BASE_DIR / "app" / photo_url).resolve()
                                print(f"[PREVIEW] Trying alt path: {alt_path}, exists: {alt_path.exists()}")
                                if alt_path.exists():
                                    gallery_photos_src.append(f"file://{alt_path}")
                    except Exception as e:
                        print(f"[PREVIEW] Error processing photo {photo_url}: {e}")
        print(f"[PREVIEW] Final gallery_photos_src: {gallery_photos_src}")
        
        html_content = template.render(
            kp=sample_kp,
            people_count=preview_people,
            price_per_person=price_per_person_value,
            items=sample_data.get('items', []),
            formats=formats,
            food_total=sample_data.get('food_total', '0 грн'),
            food_total_raw=food_total_raw,
            equipment_total=f"{equipment_total:.2f} грн" if equipment_total else None,
            service_total=f"{service_total:.2f} грн" if service_total else None,
            transport_total=f"{transport_total:.2f} грн" if transport_total else None,
            total_weight=sample_data.get('total_weight', '0 кг'),
            weight_per_person=sample_data.get('weight_per_person', '0 г'),
            total_items=sample_data.get('total_items', 0),
            logo_src=logo_src,
            header_image_src=header_image_src,
            background_image_src=background_image_src,
            primary_color=design.get('primary_color', '#FF5A00'),
            secondary_color=design.get('secondary_color', '#ffffff'),
            text_color=design.get('text_color', '#333333'),
            font_family=design.get('font_family', 'Inter, Arial, sans-serif'),
            # Шрифти для різних елементів
            title_font=design.get('title_font', 'Montserrat, Arial, sans-serif'),
            header_font=design.get('header_font', 'Montserrat, Arial, sans-serif'),
            body_font=design.get('body_font', 'Inter, Arial, sans-serif'),
            table_font=design.get('table_font', 'Inter, Arial, sans-serif'),
            # Заголовок КП
            title_text=design.get('title_text', 'КОМЕРЦІЙНА ПРОПОЗИЦІЯ'),
            template_company_name=design.get('company_name', 'ДЗИҐА КЕЙТЕРІНҐ'),
            # Кольори елементів PDF
            format_bg_color=design.get('format_bg_color', '#FF8C00'),
            table_header_bg_color=design.get('table_header_bg_color', '#FFA500'),
            category_bg_color=design.get('category_bg_color', '#FFB84D'),
            summary_bg_color=design.get('summary_bg_color', '#F3F4F6'),
            total_bg_color=design.get('total_bg_color', '#FF8C00'),
            # Налаштування тексту категорій та страв
            category_text_align=design.get('category_text_align', 'center'),
            category_text_color=design.get('category_text_color', '#FFFFFF'),
            dish_text_align=design.get('dish_text_align', 'left'),
            dish_text_color=design.get('dish_text_color', '#333333'),
            # Розділювач категорій
            category_separator_image_url=category_separator_image_url,
            company_name=sample_data.get('company_name', 'ДЗИҐА КЕЙТЕРІНҐ'),
            created_date=sample_data.get('created_date', ''),
            event_date=sample_data.get('event_date', ''),
            template=template_config_obj,
            template_config=template_config_obj,
            menu_sections=menu_sections,
            category_summaries=category_summaries_formatted,
            grand_total=grand_total,
            grand_total_formatted=grand_total_formatted,
            fop_percent=fop_percent,
            fop_extra=fop_extra,
            fop_extra_formatted=fop_extra_formatted,
            grand_total_with_fop=grand_total_with_fop,
            grand_total_with_fop_formatted=grand_total_with_fop_formatted,
            # Умови бронювання та галерея
            booking_terms=booking_terms_preview,
            gallery_photos=gallery_photos_src,
        )
        
        # Генеруємо PDF
        pdf_bytes = HTML(string=html_content, base_url=str(BASE_DIR)).write_pdf(zoom=1)
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=template-preview.pdf"
            }
        )
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error generating template preview: {e}")
        print(f"Traceback: {error_traceback}")
        # Повертаємо детальну інформацію про помилку для дебагу
        error_detail = f"Error generating preview: {str(e)}"
        if hasattr(e, '__cause__') and e.__cause__:
            error_detail += f" | Cause: {str(e.__cause__)}"
        raise HTTPException(status_code=500, detail=error_detail)


@router.post("/templates/upload-image")
async def upload_template_image(
    file: UploadFile = File(...),
    image_type: str = Form(...),  # 'logo' | 'header' | 'background' | 'separator'
    current_user = Depends(get_current_user),
):
    """
    Завантажити зображення для шаблону.
    """
    # ДОДАНО ДЛЯ ДІАГНОСТИКИ
    print(f"🔐 Current user: {current_user}")
    print(f"📁 Uploading {image_type} image: {file.filename}")
    print(f"📦 File size: {file.size if hasattr(file, 'size') else 'unknown'} bytes")
    
    # Валідація типу файлу
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Only images allowed")
    
    # Валідація розміру (5MB)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")
    
    # Створюємо директорію якщо не існує
    templates_dir = UPLOADS_DIR / "templates"
    templates_dir.mkdir(parents=True, exist_ok=True)
    
    # Генеруємо унікальне ім'я файлу
    file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    user_id = current_user.get("sub") if isinstance(current_user, dict) else current_user.id
    filename = f"{image_type}_{user_id}_{int(datetime.now().timestamp())}.{file_extension}"
    filepath = templates_dir / filename
    
    # Зберігаємо файл
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Повертаємо URL
    return {"url": f"/uploads/templates/{filename}"}


@router.post("/templates/{template_id}/upload-gallery-photo")
async def upload_template_gallery_photo(
    template_id: int,
    photo: UploadFile = File(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Завантажує фото до галереї шаблону (максимум 9 фото).
    """
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    
    # Валідація типу файлу
    if photo.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF"
        )
    
    # Перевіряємо, чи не перевищено ліміт фото
    # ВАЖЛИВО: для JSON-полів SQLAlchemy in-place зміни списку можуть не трекатись.
    # Тому завжди працюємо з копією списку й присвоюємо новий об'єкт.
    current_photos = list(template.gallery_photos or [])
    if len(current_photos) >= 9:
        raise HTTPException(400, "Максимум 9 фото для шаблону")
    
    # Створюємо унікальне ім'я файлу
    ext = Path(photo.filename).suffix.lower() if photo.filename else ".jpg"
    unique_filename = f"template_{template_id}_gallery_{len(current_photos) + 1}_{uuid.uuid4().hex[:8]}{ext}"
    
    # Створюємо директорію для фото галереї шаблонів
    gallery_dir = UPLOADS_DIR / "template-gallery"
    gallery_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = gallery_dir / unique_filename
    
    # Зберігаємо файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(photo.file, buffer)
    
    # Додаємо шлях до фото в БД
    relative_path = f"uploads/template-gallery/{unique_filename}"
    current_photos.append(relative_path)
    template.gallery_photos = current_photos
    
    db.commit()
    db.refresh(template)
    
    return {
        "status": "success",
        "photo_url": relative_path,
        "gallery_photos": template.gallery_photos
    }


@router.delete("/templates/{template_id}/gallery-photo/{photo_index}")
def delete_template_gallery_photo(
    template_id: int,
    photo_index: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Видаляє фото з галереї шаблону.
    """
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(404, "Template not found")
    
    # ВАЖЛИВО: працюємо з копією (див. коментар вище)
    current_photos = list(template.gallery_photos or [])
    
    if photo_index < 0 or photo_index >= len(current_photos):
        raise HTTPException(400, "Invalid photo index")
    
    # Видаляємо файл з диска
    photo_path = current_photos[photo_index]
    full_path = Path("app") / photo_path
    if full_path.exists():
        full_path.unlink()
    
    # Видаляємо з масиву
    current_photos.pop(photo_index)
    template.gallery_photos = current_photos
    
    db.commit()
    
    return {
        "status": "success",
        "gallery_photos": template.gallery_photos
    }


# ==================== CLIENTS ====================

@router.get("/clients")
def get_clients(
    skip: int = 0, 
    limit: int = 100,
    search: str = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # Сортуємо клієнтів за датою створення (нові зверху),
    # щоб щойно створені клієнти завжди потрапляли в першу сторінку.
    query = db.query(models.Client)
    
    if search:
        query = query.filter(
            or_(
                models.Client.name.ilike(f"%{search}%"),
                models.Client.company_name.ilike(f"%{search}%"),
                models.Client.phone.ilike(f"%{search}%"),
                models.Client.email.ilike(f"%{search}%")
            )
        )
    
    query = query.order_by(models.Client.created_at.desc())
    
    total = query.count()
    clients = query.offset(skip).limit(limit).all()
    
    # Додаємо questionnaire_id до кожного клієнта
    clients_with_questionnaires = []
    for client in clients:
        # Знаходимо останню анкету клієнта
        latest_questionnaire = db.query(models.ClientQuestionnaire).filter(
            models.ClientQuestionnaire.client_id == client.id
        ).order_by(models.ClientQuestionnaire.created_at.desc()).first()
        
        client_dict = {
            "id": client.id,
            "name": client.name,
            "company_name": client.company_name,
            "phone": client.phone,
            "email": client.email,
            "total_orders": client.total_orders,
            "lifetime_spent": client.lifetime_spent,
            "current_year_spent": client.current_year_spent,
            "cashback_balance": client.cashback_balance,
            "cashback_earned_total": client.cashback_earned_total,
            "cashback_used_total": client.cashback_used_total,
            "cashback_expires_at": client.cashback_expires_at,
            "loyalty_tier": client.loyalty_tier,
            "cashback_rate": client.cashback_rate,
            "is_custom_rate": client.is_custom_rate,
            "yearly_photographer_used": client.yearly_photographer_used,
            "yearly_robot_used": client.yearly_robot_used,
            "bonus_year": client.bonus_year,
            "notes": client.notes,
            "created_at": client.created_at,
            "updated_at": client.updated_at,
            "questionnaire_id": latest_questionnaire.id if latest_questionnaire else None
        }
        clients_with_questionnaires.append(client_dict)
    
    return {
        "total": total,
        "clients": clients_with_questionnaires
    }


@router.get("/clients/{client_id}")
def get_client(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Завантаж КП клієнта
    kps = db.query(models.KP).filter(models.KP.client_id == client_id).all()
    
    # Завантаж анкету
    questionnaire = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.client_id == client_id
    ).first()
    
    return {
        "client": client,
        "kps": kps,
        "questionnaire": questionnaire
    }


@router.post("/clients")
def create_client(
    client: schema.ClientCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # Перевірка чи існує клієнт з таким телефоном
    existing = db.query(models.Client).filter(models.Client.phone == client.phone).first()
    if existing:
        raise HTTPException(400, "Client with this phone already exists")
    
    new_client = models.Client(**client.dict())
    db.add(new_client)
    db.commit()
    db.refresh(new_client)
    
    return new_client


@router.put("/clients/{client_id}")
def update_client(
    client_id: int,
    client: schema.ClientUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not db_client:
        raise HTTPException(404, "Client not found")
    
    for key, value in client.dict(exclude_unset=True).items():
        setattr(db_client, key, value)
    
    db_client.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_client)
    
    return db_client


@router.delete("/clients/{client_id}")
def delete_client(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_db)
):
    # Логування для діагностики
    print(f"[DELETE CLIENT] User: {user.email}, is_admin: {user.is_admin}, role: {user.role}")
    
    # Перевірка прав доступу: тільки адміни та керівники відділів можуть видаляти клієнтів
    is_admin = user.is_admin is True or user.is_admin == 1
    is_lead = user.role and user.role.endswith("-lead")
    
    print(f"[DELETE CLIENT] is_admin={is_admin}, is_lead={is_lead}")
    
    if not is_admin and not is_lead:
        raise HTTPException(
            status_code=403, 
            detail=f"Доступ заборонено. Тільки адміністратори та керівники відділів можуть видаляти клієнтів. Ваш статус: is_admin={user.is_admin}, role={user.role}"
        )
    
    db_client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not db_client:
        raise HTTPException(404, "Client not found")
    
    # Видаляємо клієнта (каскадне видалення залежних записів налаштовано в моделі)
    db.delete(db_client)
    db.commit()
    
    return {"status": "deleted", "id": client_id}


# ==================== QUESTIONNAIRE ====================

@router.post("/clients/{client_id}/questionnaire")
def create_or_update_questionnaire(
    client_id: int,
    questionnaire: schema.ClientQuestionnaireUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    # Перевірка чи існує клієнт
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Перевірка чи існує анкета
    existing = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.client_id == client_id
    ).first()
    
    if existing:
        # Оновлення
        for key, value in questionnaire.dict(exclude_unset=True).items():
            setattr(existing, key, value)
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Створення
        new_questionnaire = models.ClientQuestionnaire(
            client_id=client_id,
            **questionnaire.dict(exclude_unset=True)
        )
        db.add(new_questionnaire)
        db.commit()
        db.refresh(new_questionnaire)
        return new_questionnaire


@router.get("/clients/{client_id}/questionnaire")
def get_questionnaire(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати останню анкету клієнта (для зворотньої сумісності)"""
    questionnaire = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.client_id == client_id
    ).order_by(models.ClientQuestionnaire.created_at.desc()).first()
    
    if not questionnaire:
        raise HTTPException(404, "Questionnaire not found")
    
    return questionnaire


@router.get("/clients/{client_id}/questionnaires")
def get_client_questionnaires(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати всі анкети клієнта"""
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    questionnaires = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.client_id == client_id
    ).order_by(models.ClientQuestionnaire.created_at.desc()).all()
    
    return {"questionnaires": questionnaires, "total": len(questionnaires)}


@router.get("/questionnaires")
def get_all_questionnaires(
    skip: int = 0,
    limit: int = 100,
    manager_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати всі анкети з фільтрацією"""
    query = db.query(models.ClientQuestionnaire)
    
    if manager_id:
        query = query.filter(models.ClientQuestionnaire.manager_id == manager_id)
    
    total = query.count()
    questionnaires = query.order_by(
        models.ClientQuestionnaire.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Додаємо інформацію про клієнта та менеджера
    result = []
    for q in questionnaires:
        client = db.query(models.Client).filter(models.Client.id == q.client_id).first()
        manager = db.query(models.User).filter(models.User.id == q.manager_id).first() if q.manager_id else None
        
        # Формуємо повне ім'я менеджера
        manager_name = None
        if manager:
            if manager.first_name and manager.last_name:
                manager_name = f"{manager.first_name} {manager.last_name}"
            elif manager.first_name:
                manager_name = manager.first_name
            elif manager.last_name:
                manager_name = manager.last_name
            else:
                manager_name = manager.email
        
        q_dict = {
            **q.__dict__,
            "client_name": client.name if client else None,
            "client_phone": client.phone if client else None,
            "client_company": client.company_name if client else None,
            "manager_name": manager_name,
            "manager_email": manager.email if manager else None,
        }
        result.append(q_dict)
    
    return {"questionnaires": result, "total": total}


@router.get("/questionnaires/{questionnaire_id}")
def get_questionnaire_by_id(
    questionnaire_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати анкету за ID"""
    questionnaire = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.id == questionnaire_id
    ).first()
    
    if not questionnaire:
        raise HTTPException(404, "Questionnaire not found")
    
    return questionnaire


@router.put("/questionnaires/{questionnaire_id}")
def update_questionnaire_by_id(
    questionnaire_id: int,
    questionnaire_update: schema.ClientQuestionnaireUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Оновити анкету за ID"""
    questionnaire = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.id == questionnaire_id
    ).first()
    
    if not questionnaire:
        raise HTTPException(404, "Questionnaire not found")
    
    for key, value in questionnaire_update.dict(exclude_unset=True).items():
        setattr(questionnaire, key, value)
    
    questionnaire.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(questionnaire)
    
    return questionnaire


@router.delete("/questionnaires/{questionnaire_id}")
def delete_questionnaire(
    questionnaire_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Видалити анкету"""
    questionnaire = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.id == questionnaire_id
    ).first()
    
    if not questionnaire:
        raise HTTPException(404, "Questionnaire not found")
    
    db.delete(questionnaire)
    db.commit()
    
    return {"message": "Questionnaire deleted successfully"}


@router.post("/questionnaires")
def create_questionnaire(
    questionnaire_data: schema.ClientQuestionnaireCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Створити нову анкету"""
    # Перевірка чи існує клієнт
    client = db.query(models.Client).filter(models.Client.id == questionnaire_data.client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Створюємо анкету
    new_questionnaire = models.ClientQuestionnaire(
        **questionnaire_data.dict(exclude_unset=True)
    )
    
    # Якщо manager_id не вказано, використовуємо поточного користувача
    if not new_questionnaire.manager_id:
        new_questionnaire.manager_id = int(user.get("sub"))
    
    db.add(new_questionnaire)
    db.commit()
    db.refresh(new_questionnaire)
    
    return new_questionnaire


@router.get("/questionnaires/{questionnaire_id}/pdf")
def generate_questionnaire_pdf(
    questionnaire_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Генерувати PDF анкети"""
    from io import BytesIO
    from weasyprint import HTML
    from jinja2 import Template
    
    questionnaire = db.query(models.ClientQuestionnaire).filter(
        models.ClientQuestionnaire.id == questionnaire_id
    ).first()
    
    if not questionnaire:
        raise HTTPException(404, "Questionnaire not found")
    
    # Отримуємо клієнта та менеджера
    client = db.query(models.Client).filter(models.Client.id == questionnaire.client_id).first()
    manager = db.query(models.User).filter(models.User.id == questionnaire.manager_id).first() if questionnaire.manager_id else None
    
    # Формуємо повне ім'я менеджера
    manager_full_name = None
    if manager:
        if manager.first_name and manager.last_name:
            manager_full_name = f"{manager.first_name} {manager.last_name}"
        elif manager.first_name:
            manager_full_name = manager.first_name
        elif manager.last_name:
            manager_full_name = manager.last_name
        else:
            manager_full_name = manager.email
    
    # Простий HTML шаблон для анкети
    html_template = """
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4; margin: 2cm; }
            body { font-family: Arial, sans-serif; font-size: 10pt; }
            h1 { color: #FF5A00; font-size: 20pt; margin-bottom: 5mm; }
            h2 { color: #FF5A00; font-size: 14pt; margin-top: 8mm; margin-bottom: 3mm; background: #FFF3E0; padding: 3mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 5mm; }
            td { padding: 3mm; vertical-align: top; border-bottom: 1pt solid #eee; }
            td:first-child { font-weight: bold; width: 40%; color: #555; }
            .value { color: #000; }
        </style>
    </head>
    <body>
        <h1>Анкета клієнта №{{ questionnaire.id }}</h1>
        
        {% if client %}
        <table>
            <tr><td>Клієнт:</td><td class="value">{{ client.name }}</td></tr>
            <tr><td>Телефон:</td><td class="value">{{ client.phone }}</td></tr>
            {% if client.email %}<tr><td>Email:</td><td class="value">{{ client.email }}</td></tr>{% endif %}
            {% if client.company_name %}<tr><td>Компанія:</td><td class="value">{{ client.company_name }}</td></tr>{% endif %}
        </table>
        {% endif %}
        
        {% if manager_name %}
        <table>
            <tr><td>Менеджер:</td><td class="value">{{ manager_name }}</td></tr>
        </table>
        {% endif %}
        
        <h2>Сервіс</h2>
        <table>
            {% if event_formats %}
            <tr>
                <td>Формати заходу:</td>
                <td class="value">
                    {% for fmt in event_formats %}
                        <div style="margin-bottom: 3mm;">
                            <strong>{{ fmt.format }}</strong>
                            {% if fmt.time %}<br><span style="color: #666;">⏰ {{ fmt.time }}</span>{% endif %}
                        </div>
                    {% endfor %}
                </td>
            </tr>
            {% endif %}
            {% if questionnaire.event_date %}<tr><td>Дата заходу:</td><td class="value">{{ questionnaire.event_date }}</td></tr>{% endif %}
            {% if questionnaire.location %}<tr><td>Точна локація:</td><td class="value">{{ questionnaire.location }}</td></tr>{% endif %}
            {% if questionnaire.contact_person %}<tr><td>Контакт замовника:</td><td class="value">{{ questionnaire.contact_person }}</td></tr>{% endif %}
            {% if questionnaire.contact_phone %}<tr><td>Телефон контакту:</td><td class="value">{{ questionnaire.contact_phone }}</td></tr>{% endif %}
            {% if questionnaire.on_site_contact %}<tr><td>Головний на локації:</td><td class="value">{{ questionnaire.on_site_contact }}</td></tr>{% endif %}
            {% if questionnaire.on_site_phone %}<tr><td>Телефон на локації:</td><td class="value">{{ questionnaire.on_site_phone }}</td></tr>{% endif %}
            {% if questionnaire.arrival_time %}<tr><td>Час заїзду:</td><td class="value">{{ questionnaire.arrival_time }}</td></tr>{% endif %}
            {% if questionnaire.event_start_time %}<tr><td>Час початку:</td><td class="value">{{ questionnaire.event_start_time }}</td></tr>{% endif %}
            {% if questionnaire.event_end_time %}<tr><td>Час кінця:</td><td class="value">{{ questionnaire.event_end_time }}</td></tr>{% endif %}
            {% if questionnaire.additional_services_timing %}<tr><td>Додаткові таймінги:</td><td class="value">{{ questionnaire.additional_services_timing }}</td></tr>{% endif %}
            {% if questionnaire.equipment_notes %}<tr><td>Обладнання:</td><td class="value">{{ questionnaire.equipment_notes }}</td></tr>{% endif %}
            {% if questionnaire.payment_method %}<tr><td>Спосіб оплати:</td><td class="value">{{ questionnaire.payment_method }}</td></tr>{% endif %}
            {% if questionnaire.textile_color %}<tr><td>Колір текстилю:</td><td class="value">{{ questionnaire.textile_color }}</td></tr>{% endif %}
            {% if questionnaire.banquet_line_color %}<tr><td>Колір оформлення лінії:</td><td class="value">{{ questionnaire.banquet_line_color }}</td></tr>{% endif %}
        </table>
        
        <h2>Заїзд</h2>
        <table>
            {% if questionnaire.venue_complexity %}<tr><td>Складність заїзду:</td><td class="value">{{ questionnaire.venue_complexity }}</td></tr>{% endif %}
            {% if questionnaire.floor_number %}<tr><td>Поверх:</td><td class="value">{{ questionnaire.floor_number }}</td></tr>{% endif %}
            <tr><td>Ліфт:</td><td class="value">{% if questionnaire.elevator_available %}Є{% else %}Немає{% endif %}</td></tr>
            {% if questionnaire.technical_room %}<tr><td>Технічне приміщення:</td><td class="value">{{ questionnaire.technical_room }}</td></tr>{% endif %}
            {% if questionnaire.kitchen_available %}<tr><td>Кухня:</td><td class="value">{{ questionnaire.kitchen_available }}</td></tr>{% endif %}
        </table>
        
        <h2>Кухня</h2>
        <table>
            {% if questionnaire.dish_serving %}<tr><td>Посуд для подачі:</td><td class="value">{{ questionnaire.dish_serving }}</td></tr>{% endif %}
            {% if questionnaire.hot_snacks_serving %}<tr><td>Подача гарячих закусок:</td><td class="value">{{ questionnaire.hot_snacks_serving }}</td></tr>{% endif %}
            {% if questionnaire.salad_serving %}<tr><td>Подання салатів:</td><td class="value">{{ questionnaire.salad_serving }}</td></tr>{% endif %}
            {% if questionnaire.product_allergy %}<tr><td>Алергії:</td><td class="value">{{ questionnaire.product_allergy }}</td></tr>{% endif %}
            {% if questionnaire.hot_snacks_prep %}<tr><td>Приготування закусок:</td><td class="value">{{ questionnaire.hot_snacks_prep }}</td></tr>{% endif %}
            {% if questionnaire.menu_notes %}<tr><td>Коментар до меню:</td><td class="value">{{ questionnaire.menu_notes }}</td></tr>{% endif %}
            {% if questionnaire.client_drinks_notes %}<tr><td>Напої від замовника:</td><td class="value">{{ questionnaire.client_drinks_notes }}</td></tr>{% endif %}
            {% if questionnaire.client_order_notes %}<tr><td>Їжа від замовника:</td><td class="value">{{ questionnaire.client_order_notes }}</td></tr>{% endif %}
        </table>
        
        <h2>Контент</h2>
        <table>
            {% if questionnaire.photo_allowed %}<tr><td>Фотозйомка:</td><td class="value">{{ questionnaire.photo_allowed }}</td></tr>{% endif %}
            {% if questionnaire.video_allowed %}<tr><td>Відеозйомка:</td><td class="value">{{ questionnaire.video_allowed }}</td></tr>{% endif %}
            {% if questionnaire.branded_products %}<tr><td>Брендована продукція:</td><td class="value">{{ questionnaire.branded_products }}</td></tr>{% endif %}
        </table>
        
        <h2>Замовник</h2>
        <table>
            {% if questionnaire.client_company_name %}<tr><td>Назва компанії:</td><td class="value">{{ questionnaire.client_company_name }}</td></tr>{% endif %}
            {% if questionnaire.client_activity_type %}<tr><td>Вид діяльності:</td><td class="value">{{ questionnaire.client_activity_type }}</td></tr>{% endif %}
        </table>
        
        {% if questionnaire.special_notes %}
        <h2>Коментарі</h2>
        <table>
            <tr><td colspan="2" class="value">{{ questionnaire.special_notes }}</td></tr>
        </table>
        {% endif %}
        
        <p style="margin-top: 10mm; text-align: right; color: #999; font-size: 8pt;">
            Створено: {{ questionnaire.created_at.strftime('%d.%m.%Y %H:%M') if questionnaire.created_at else '' }}
        </p>
    </body>
    </html>
    """
    
    # Парсимо формати заходу
    event_formats = []
    if questionnaire.event_type:
        try:
            import json
            parsed = json.loads(questionnaire.event_type)
            if isinstance(parsed, list):
                event_formats = parsed
            else:
                event_formats = [{"format": questionnaire.event_type}]
        except:
            event_formats = [{"format": questionnaire.event_type}]
    
    template = Template(html_template)
    html_content = template.render(
        questionnaire=questionnaire,
        client=client,
        manager=manager,
        manager_name=manager_full_name,
        event_formats=event_formats
    )
    
    # Генеруємо PDF
    pdf_bytes = HTML(string=html_content).write_pdf()
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={'Content-Disposition': f'attachment; filename="anketa-{questionnaire_id}.pdf"'}
    )


@router.get("/clients/search-by-phone/{phone}")
def search_client_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Пошук клієнта по номеру телефону"""
    # Очищаємо номер телефону від пробілів і спецсимволів для пошуку
    cleaned_phone = ''.join(filter(str.isdigit, phone))
    
    # Шукаємо клієнта
    clients = db.query(models.Client).all()
    for client in clients:
        client_phone_cleaned = ''.join(filter(str.isdigit, client.phone))
        if client_phone_cleaned == cleaned_phone:
            return {"found": True, "client": client}
    
    return {"found": False, "client": None}


# ==================== KP з КЛІЄНТОМ ====================

# Оновити створення КП - додати client_id (це буде в існуючому endpoint)
# Але додамо окремий endpoint для оновлення статистики клієнта
@router.post("/clients/{client_id}/update-stats")
def update_client_stats(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Оновлює статистику клієнта після створення КП"""
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Підрахунок замовлень та витрат
    kps = db.query(models.KP).filter(models.KP.client_id == client_id).all()
    client.total_orders = len(kps)
    client.total_spent = sum(kp.total_price or 0 for kp in kps)
    
    # Підрахунок кешбеку
    total_cashback = sum(kp.cashback_earned or 0 for kp in kps) - sum(kp.cashback_used or 0 for kp in kps)
    client.cashback_balance = total_cashback
    
    client.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(client)
    
    return client


# ==================== ІНФОРМАЦІЯ ПРО КЛІЄНТА ====================

@router.get("/clients/{client_id}/loyalty")
def get_client_loyalty_info(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    # Інфо про рівень
    tier_info = loyalty_service.LOYALTY_TIERS.get(client.loyalty_tier or "silver", loyalty_service.LOYALTY_TIERS["silver"])
    
    # Скільки залишилось до наступного рівня
    next_tier = None
    amount_to_next = None
    
    if client.loyalty_tier == "silver":
        next_tier = "gold"
        amount_to_next = 150000 - float(client.lifetime_spent or 0)
    elif client.loyalty_tier == "gold":
        next_tier = "platinum"
        amount_to_next = 300000 - float(client.lifetime_spent or 0)
    elif client.loyalty_tier == "platinum":
        next_tier = "diamond"
        amount_to_next = 600000 - float(client.lifetime_spent or 0)
    
    # Історія транзакцій
    transactions = db.query(models.CashbackTransaction).filter(
        models.CashbackTransaction.client_id == client_id
    ).order_by(models.CashbackTransaction.created_at.desc()).limit(20).all()
    
    return {
        "client": client,
        "tier": {
            "name": client.loyalty_tier or "silver",
            "cashback_rate": float(client.cashback_rate or 3.0),
            "benefits": tier_info.get("benefits", []),
            "is_custom": client.is_custom_rate or False
        },
        "next_tier": {
            "name": next_tier,
            "amount_needed": amount_to_next
        } if next_tier else None,
        "cashback": {
            "balance": float(client.cashback_balance or 0),
            "expires_at": client.cashback_expires_at.isoformat() if client.cashback_expires_at else None,
            "earned_total": float(client.cashback_earned_total or 0),
            "used_total": float(client.cashback_used_total or 0)
        },
        "diamond_bonuses": {
            "photographer_available": not (client.yearly_photographer_used or False),
            "robot_available": not (client.yearly_robot_used or False),
            "year": client.bonus_year or datetime.now().year
        } if client.loyalty_tier == "diamond" else None,
        "transactions": transactions
    }


# ==================== ВСТАНОВЛЕННЯ ІНДИВІДУАЛЬНИХ УМОВ ====================

@router.put("/clients/{client_id}/custom-cashback")
def set_custom_cashback_rate(
    client_id: int,
    custom_rate: float = Body(..., ge=0, le=20),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Тільки для відділу продажів - встановити індивідуальний % кешбеку"""
    
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    client.cashback_rate = Decimal(str(custom_rate))
    client.is_custom_rate = True
    client.loyalty_tier = "custom"
    
    db.commit()
    db.refresh(client)
    
    return {"message": f"Встановлено індивідуальний кешбек {custom_rate}% для клієнта", "client": client}


# ==================== ВИКОРИСТАННЯ DIAMOND БОНУСІВ ====================

@router.post("/clients/{client_id}/use-diamond-bonus")
def use_diamond_bonus_endpoint(
    client_id: int,
    bonus_type: str = Body(...),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Використання річного бонусу для Diamond клієнтів"""
    
    if bonus_type not in ["photographer", "robot"]:
        raise HTTPException(400, "bonus_type має бути 'photographer' або 'robot'")
    
    client = db.query(models.Client).filter(models.Client.id == client_id).first()
    if not client:
        raise HTTPException(404, "Client not found")
    
    try:
        loyalty_service.use_diamond_bonus(db, client, bonus_type)
        return {"message": f"Бонус '{bonus_type}' активовано"}
    except ValueError as e:
        raise HTTPException(400, str(e))


# ==================== ЧЕКЛІСТИ (БОКСИ / КЕЙТЕРИНГ) ====================

@router.get("/checklists")
def get_all_checklists(
    skip: int = 0,
    limit: int = 100,
    checklist_type: Optional[str] = None,
    status: Optional[str] = None,
    manager_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати всі чекліста з фільтрацією"""
    query = db.query(models.Checklist)
    
    if checklist_type:
        query = query.filter(models.Checklist.checklist_type == checklist_type)
    if status:
        query = query.filter(models.Checklist.status == status)
    if manager_id:
        query = query.filter(models.Checklist.manager_id == manager_id)
    
    total = query.count()
    box_count = query.filter(models.Checklist.checklist_type == "box").count()
    catering_count = query.filter(models.Checklist.checklist_type == "catering").count()
    
    checklists = query.order_by(
        models.Checklist.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    # Додаємо інформацію про клієнта та менеджера
    result = []
    for c in checklists:
        client = db.query(models.Client).filter(models.Client.id == c.client_id).first() if c.client_id else None
        manager = db.query(models.User).filter(models.User.id == c.manager_id).first() if c.manager_id else None
        
        # Формуємо повне ім'я менеджера
        manager_name = None
        if manager:
            if manager.first_name and manager.last_name:
                manager_name = f"{manager.first_name} {manager.last_name}"
            elif manager.first_name:
                manager_name = manager.first_name
            elif manager.last_name:
                manager_name = manager.last_name
            else:
                manager_name = manager.email
        
        c_dict = {
            **{k: v for k, v in c.__dict__.items() if not k.startswith('_')},
            "client_name": client.name if client else c.contact_name,
            "manager_name": manager_name,
        }
        result.append(c_dict)
    
    return {
        "checklists": result,
        "total": total,
        "box_count": box_count,
        "catering_count": catering_count
    }


@router.get("/checklists/{checklist_id}")
def get_checklist_by_id(
    checklist_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати чекліст за ID"""
    checklist = db.query(models.Checklist).filter(
        models.Checklist.id == checklist_id
    ).first()
    
    if not checklist:
        raise HTTPException(404, "Checklist not found")
    
    # Додаємо інформацію про клієнта та менеджера
    client = db.query(models.Client).filter(models.Client.id == checklist.client_id).first() if checklist.client_id else None
    manager = db.query(models.User).filter(models.User.id == checklist.manager_id).first() if checklist.manager_id else None
    
    manager_name = None
    if manager:
        if manager.first_name and manager.last_name:
            manager_name = f"{manager.first_name} {manager.last_name}"
        elif manager.first_name:
            manager_name = manager.first_name
        else:
            manager_name = manager.email
    
    result = {
        **{k: v for k, v in checklist.__dict__.items() if not k.startswith('_')},
        "client_name": client.name if client else checklist.contact_name,
        "manager_name": manager_name,
    }
    
    return result


def normalize_phone(phone: str) -> str:
    """Нормалізує телефон - видаляє всі символи крім цифр"""
    if not phone:
        return phone
    # Залишаємо тільки цифри
    import re
    digits = re.sub(r'\D', '', phone)
    # Повертаємо у форматі +380XXXXXXXXX
    if digits.startswith('380'):
        return '+' + digits
    return '+380' + digits[-9:] if len(digits) >= 9 else '+' + digits


@router.post("/checklists")
def create_checklist(
    checklist_data: schema.ChecklistCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Створити новий чекліст"""
    client_id = checklist_data.client_id
    
    # Нормалізуємо телефон для пошуку та збереження
    normalized_phone = normalize_phone(checklist_data.contact_phone) if checklist_data.contact_phone else None
    
    # Якщо вказано client_id, перевіряємо чи існує клієнт
    if client_id:
        client = db.query(models.Client).filter(models.Client.id == client_id).first()
        if not client:
            raise HTTPException(404, "Client not found")
    else:
        # Автоматично створюємо або знаходимо клієнта на основі контактних даних
        if normalized_phone:
            # Шукаємо існуючого клієнта по нормалізованому телефону
            # Порівнюємо точне співпадіння (телефони вже нормалізовані при збереженні)
            existing_client = db.query(models.Client).filter(
                models.Client.phone == normalized_phone
            ).first()
            
            # Альтернативний пошук - по цифрах (якщо в базі є старі записи з різним форматом)
            if not existing_client:
                from sqlalchemy import func
                # Витягуємо тільки цифри для порівняння
                phone_digits = normalized_phone.replace('+', '')
                existing_client = db.query(models.Client).filter(
                    func.regexp_replace(models.Client.phone, r'\D', '', 'g') == phone_digits
                ).first()
            
            if existing_client:
                client_id = existing_client.id
            elif checklist_data.contact_name:
                # Створюємо нового клієнта з нормалізованим телефоном
                new_client = models.Client(
                    name=checklist_data.contact_name,
                    phone=normalized_phone,
                    email=checklist_data.contact_email,
                    source="checklist"  # Джерело - чекліст
                )
                db.add(new_client)
                db.commit()
                db.refresh(new_client)
                client_id = new_client.id
    
    # Парсимо дату якщо вона є
    event_date = None
    if checklist_data.event_date:
        try:
            from datetime import datetime as dt
            # Підтримуємо різні формати дати
            for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
                try:
                    event_date = dt.strptime(checklist_data.event_date, fmt).date()
                    break
                except ValueError:
                    continue
        except Exception:
            pass
    
    # Створюємо чекліст
    data = checklist_data.dict(exclude_unset=True)
    data['event_date'] = event_date
    data['client_id'] = client_id  # Прив'язуємо до клієнта
    
    new_checklist = models.Checklist(**data)
    
    # Якщо manager_id не вказано, використовуємо поточного користувача
    if not new_checklist.manager_id:
        new_checklist.manager_id = int(user.get("sub"))
    
    db.add(new_checklist)
    db.commit()
    db.refresh(new_checklist)
    
    return new_checklist


@router.put("/checklists/{checklist_id}")
def update_checklist(
    checklist_id: int,
    checklist_update: schema.ChecklistUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Оновити чекліст за ID"""
    checklist = db.query(models.Checklist).filter(
        models.Checklist.id == checklist_id
    ).first()
    
    if not checklist:
        raise HTTPException(404, "Checklist not found")
    
    # Парсимо дату якщо вона є
    update_data = checklist_update.dict(exclude_unset=True)
    
    if 'event_date' in update_data and update_data['event_date']:
        try:
            from datetime import datetime as dt
            for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
                try:
                    update_data['event_date'] = dt.strptime(update_data['event_date'], fmt).date()
                    break
                except ValueError:
                    continue
        except Exception:
            update_data['event_date'] = None
    
    # Якщо немає client_id, але є контактні дані - створюємо/знаходимо клієнта
    if not checklist.client_id and not update_data.get('client_id'):
        contact_phone = update_data.get('contact_phone') or checklist.contact_phone
        contact_name = update_data.get('contact_name') or checklist.contact_name
        contact_email = update_data.get('contact_email') or checklist.contact_email
        
        # Нормалізуємо телефон
        normalized_phone = normalize_phone(contact_phone) if contact_phone else None
        
        if normalized_phone:
            # Шукаємо по точному співпадінню
            existing_client = db.query(models.Client).filter(
                models.Client.phone == normalized_phone
            ).first()
            
            # Альтернативний пошук по цифрах
            if not existing_client:
                from sqlalchemy import func
                phone_digits = normalized_phone.replace('+', '')
                existing_client = db.query(models.Client).filter(
                    func.regexp_replace(models.Client.phone, r'\D', '', 'g') == phone_digits
                ).first()
            
            if existing_client:
                update_data['client_id'] = existing_client.id
            elif contact_name:
                new_client = models.Client(
                    name=contact_name,
                    phone=normalized_phone,
                    email=contact_email,
                    source="checklist"
                )
                db.add(new_client)
                db.commit()
                db.refresh(new_client)
                update_data['client_id'] = new_client.id
    
    for key, value in update_data.items():
        setattr(checklist, key, value)
    
    checklist.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(checklist)
    
    return checklist


@router.delete("/checklists/{checklist_id}")
def delete_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Видалити чекліст"""
    checklist = db.query(models.Checklist).filter(
        models.Checklist.id == checklist_id
    ).first()
    
    if not checklist:
        raise HTTPException(404, "Checklist not found")
    
    db.delete(checklist)
    db.commit()
    
    return {"message": "Checklist deleted successfully", "id": checklist_id}


@router.post("/checklists/{checklist_id}/create-kp")
def create_kp_from_checklist(
    checklist_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Створити КП з чекліста"""
    checklist = db.query(models.Checklist).filter(
        models.Checklist.id == checklist_id
    ).first()
    
    if not checklist:
        raise HTTPException(404, "Checklist not found")
    
    # Визначаємо event_group на основі типу чекліста
    event_group = "Доставка боксів" if checklist.checklist_type == "box" else "Кейтерінг"
    
    # Створюємо КП з даними з чекліста
    new_kp = models.KP(
        title=f"КП - {checklist.contact_name or 'Новий клієнт'} - {checklist.event_format or event_group}",
        people_count=checklist.guest_count or 1,
        client_name=checklist.contact_name,
        client_email=checklist.contact_email,
        client_phone=checklist.contact_phone,
        event_format=checklist.event_format,
        event_group=event_group,
        event_date=checklist.event_date,
        event_location=checklist.location_address,
        event_time=checklist.delivery_time,
        status="in_progress",
        created_by_id=int(user.get("sub")),
        client_id=checklist.client_id,
    )
    
    db.add(new_kp)
    db.commit()
    db.refresh(new_kp)
    
    # Оновлюємо статус чекліста та прив'язуємо до КП
    checklist.status = "sent_to_kp"
    checklist.kp_id = new_kp.id
    db.commit()
    
    return {
        "message": "КП створено успішно",
        "kp_id": new_kp.id,
        "checklist_id": checklist_id
    }


@router.get("/clients/{client_id}/checklists")
def get_client_checklists(
    client_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """Отримати всі чекліста клієнта"""
    checklists = db.query(models.Checklist).filter(
        models.Checklist.client_id == client_id
    ).order_by(models.Checklist.created_at.desc()).all()
    
    return {"checklists": checklists, "total": len(checklists)}

