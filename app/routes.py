from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import Optional

from db import SessionLocal
from datetime import datetime, timedelta
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

import crud, schema, crud_user, models
import jwt, os, re
import shutil
import uuid
from pathlib import Path
import pyotp
from decimal import Decimal
from email_service import send_kp_email
from telegram_service import send_kp_telegram
from import_menu_csv import parse_menu_csv, import_to_db as import_menu_items
import loyalty_service


router = APIRouter()

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# Абсолютні шляхи до директорії `uploads` всередині модуля `app`
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"


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
    return crud.get_items(db, skip=skip, limit=limit)


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


def generate_template_preview(html_content: str, filename: str) -> str:
    """
    Генерує прев'ю зображення з HTML шаблону.
    Повертає відносний шлях до збереженого зображення.
    """
    try:
        from pdf2image import convert_from_bytes
        from io import BytesIO
        
        # Генеруємо PDF з HTML (використовуємо тестові дані)
        # Важливо: дані повинні містити всі поля, які використовує HTML шаблон
        test_data = {
            'kp': {
                'id': 1,
                'title': 'Тестова КП - Дитяче свято',
                'client_name': 'Тестовий клієнт',
                'client_email': 'test@example.com',
                'client_phone': '+380501234567',
                'people_count': 50,
                'status': 'sent',
                'total_price': 7450.0,
                'price_per_person': 149.0,
                'template_id': 1,
                'created_at': None,
                'event_date': None,
                'event_format': 'Дитяче свято',
                'event_group': 'catering',
                'event_location': 'Київ',
                'event_time': '14:00',
                'coordinator_name': 'Іван Іванов',
                'coordinator_phone': '+380501234567',
                'equipment_total': 500.0,
                'service_total': 300.0,
                'transport_total': 200.0,
                'total_weight': 11250.0,  # в грамах
                'weight_per_person': 225.0,  # в грамах
            },
            'items': [
                {
                    'name': 'Салат Цезар',
                    'quantity': 10,
                    'weight': '0.50 кг',  # вага 1 одиниці
                    'weight_raw': 0.5,
                    'unit': 'кг',
                    'price': '120.00 грн',
                    'price_raw': 120.0,
                    'total': '1200.00 грн',
                    'total_raw': 1200.0,
                    'total_weight': 5.0,  # загальна вага по позиції
                    'description': 'Класичний салат Цезар з куркою та пармезаном',
                    'category_name': 'Салати',
                    'subcategory_name': 'Овочеві салати',
                    'photo_url': None,
                    'photo_src': None,
                },
                {
                    'name': 'Стейк яловичий',
                    'quantity': 25,
                    'weight': '0.25 кг',  # вага 1 одиниці
                    'weight_raw': 0.25,
                    'unit': 'кг',
                    'price': '250.00 грн',
                    'price_raw': 250.0,
                    'total': '6250.00 грн',
                    'total_raw': 6250.0,
                    'total_weight': 6.25,  # загальна вага по позиції
                    'description': 'Соковитий стейк з яловичини середньої прожарки',
                    'category_name': 'Гарячі страви',
                    'subcategory_name': 'М\'ясні страви',
                    'photo_url': None,
                    'photo_src': None,
                },
            ],
            'total_items': 2,
            'food_total': '7450.00 грн',
            'equipment_total': 500.0,
            'service_total': 300.0,
            'transport_total': 200.0,
            'total_weight': '11250 г',
            'total_weight_grams': 11250.0,
            'weight_per_person': 225.0,
            'company_name': 'Дзиґа Кейтерінґ',
            'created_date': '03.12.2025',
            'event_date': '15.12.2025',
            'logo_src': None,
            'header_image_src': None,
            'background_image_src': None,
        }
        
        # Рендеримо HTML через Jinja2
        from jinja2 import Template
        template = Template(html_content)
        rendered_html = template.render(**test_data)
        
        # Генеруємо PDF з HTML з правильним base_url
        pdf_bytes = HTML(string=rendered_html, base_url=str(BASE_DIR)).write_pdf(zoom=0.75)
        
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
    weight: float = Form(None),
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
    
    # Створюємо об'єкт ItemCreate
    item_data = schema.ItemCreate(
        name=name,
        description=description,
        price=price,
        weight=weight,
        unit=unit,
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
    weight: float = Form(None),
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
    
    # Створюємо об'єкт ItemUpdate
    item_data = schema.ItemUpdate(
        name=name,
        description=description,
        price=price,
        weight=weight,
        unit=unit,
        subcategory_id=subcategory_id,
        active=active,
        photo_url=final_photo_url
    )
    
    updated = crud.update_item(db, item_id, item_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Item not found")
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

    # Підготовка структур для форматів меню (Welcome drink, Фуршет, тощо)
    formats_map: dict[Any, dict] = {}
    for event_format in getattr(kp, "event_formats", []) or []:
        people = event_format.people_count or kp.people_count or 0
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
            "people_count": kp.people_count or 0,
            "order_index": 0,
            "items": [],
            "food_total_raw": 0.0,
            "weight_total_raw": 0.0,
        }
    
    for kp_item in kp.items:
        # kp_item.item вже завантажений через selectinload в get_kp_items
        item = kp_item.item
        if not item:
            # Якщо страву видалили з меню після створення КП — просто пропускаємо її
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

        # Форматуємо дані для відображення в шаблоні
        weight_str = f"{item.weight:.2f} {item.unit or 'кг'}" if item.weight else "-"
        price_str = f"{item.price:.2f} грн" if item.price else "-"
        total_str = f"{(item.price or 0) * kp_item.quantity:.2f} грн"
        
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
            people = kp_item.event_format.people_count if getattr(kp_item, "event_format", None) and kp_item.event_format.people_count else kp.people_count or 0
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
    
    # Форматуємо ціни та вагу (загальні по КП)
    food_total_raw = sum(item["total_raw"] for item in items_data)
    formatted_food_total = f"{food_total_raw:.2f} грн"
    
    # Використовуємо вагу з бази даних, якщо вона є, інакше розраховуємо
    kp_total_weight = getattr(kp, "total_weight", None)
    kp_weight_per_person = getattr(kp, "weight_per_person", None)
    
    # total_weight з розрахунку в кг, конвертуємо в грами для порівняння
    calculated_total_weight_grams = total_weight * 1000 if total_weight else 0
    
    if kp_total_weight is not None:
        # Вага зберігається в грамах
        total_weight_grams_value = kp_total_weight
        formatted_total_weight = f"{kp_total_weight:.0f} г"
        calculated_weight_per_person = kp_weight_per_person if kp_weight_per_person is not None else (kp_total_weight / kp.people_count if kp.people_count else 0)
    else:
        # Якщо ваги немає в БД, використовуємо розраховану (в кг, конвертуємо в г)
        total_weight_grams_value = calculated_total_weight_grams
        formatted_total_weight = f"{calculated_total_weight_grams:.0f} г"
        calculated_weight_per_person = calculated_total_weight_grams / kp.people_count if kp.people_count else 0
    
    equipment_total = getattr(kp, "equipment_total", None) or 0
    service_total = getattr(kp, "service_total", None) or 0
    transport_total = getattr(kp, "transport_total", None) or 0
    
    # Знижка по КП (як відсоток), якщо налаштована
    discount_percent: float | None = None
    if getattr(kp, "discount_benefit", None) and kp.discount_benefit.type == "discount":
        discount_percent = kp.discount_benefit.value
    
    # Підсумки по кожному формату меню
    formats: list[dict] = []
    for fmt in formats_map.values():
        people = fmt["people_count"] or kp.people_count or 0
        food_total_fmt = fmt["food_total_raw"]
        fmt["food_total"] = food_total_fmt
        fmt["food_total_formatted"] = f"{food_total_fmt:.2f} грн"
        fmt["price_per_person"] = (
            (food_total_fmt / people) if people else None
        )
        fmt["price_per_person_formatted"] = (
            f"{fmt['price_per_person']:.2f} грн/люд" if fmt["price_per_person"] is not None else None
        )
        
        # Знижка по формату, якщо увімкнено блок знижки
        if discount_percent:
            discount_amount = food_total_fmt * discount_percent / 100.0
            total_after_discount = food_total_fmt - discount_amount
            fmt["discount_percent"] = discount_percent
            fmt["discount_amount"] = discount_amount
            fmt["discount_amount_formatted"] = f"{discount_amount:.2f} грн"
            fmt["total_after_discount"] = total_after_discount
            fmt["total_after_discount_formatted"] = f"{total_after_discount:.2f} грн"
            fmt["price_per_person_after_discount"] = (
                (total_after_discount / people) if people else None
            )
            fmt["price_per_person_after_discount_formatted"] = (
                f"{fmt['price_per_person_after_discount']:.2f} грн/люд"
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

    # Загальна сума до оплати (меню + обладнання + сервіс + доставка)
    grand_total = total_menu_after_discount + equipment_total + service_total + transport_total
    fop_percent = 7.0  # Комісія ФОП 3-ї категорії
    fop_extra = grand_total * fop_percent / 100.0
    grand_total_with_fop = grand_total + fop_extra

    # Форматовані рядки для шаблону
    grand_total_formatted = f"{grand_total:.2f} грн"
    fop_extra_formatted = f"{fop_extra:.2f} грн" if fop_extra else None
    grand_total_with_fop_formatted = f"{grand_total_with_fop:.2f} грн"
    
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
    
    # Секції меню (категорії)
    menu_sections = ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"]

    if selected_template:
        primary_color = getattr(selected_template, "primary_color", None) or primary_color
        secondary_color = getattr(selected_template, "secondary_color", None) or secondary_color
        text_color = getattr(selected_template, "text_color", None) or text_color
        font_family = getattr(selected_template, "font_family", None) or font_family
        
        # Оновлюємо конфігурацію з налаштувань шаблону
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
        })
        
        # Отримуємо секції меню з шаблону
        template_menu_sections = getattr(selected_template, 'menu_sections', None)
        if template_menu_sections:
            menu_sections = template_menu_sections

    # Конвертуємо dict в простий об'єкт для доступу через крапку в Jinja2
    class TemplateConfig:
        def __init__(self, config_dict):
            for key, value in config_dict.items():
                setattr(self, key, value)
    
    template_config_obj = TemplateConfig(template_config)

    html_content = template.render(
        kp=kp,
        items=items_data,
        formats=formats,
        # Підсумки по кухні та додаткових блоках
        food_total=formatted_food_total,
        equipment_total=f"{equipment_total:.2f} грн" if equipment_total else None,
        service_total=f"{service_total:.2f} грн" if service_total else None,
        transport_total=f"{transport_total:.2f} грн" if transport_total else None,
        total_weight=formatted_total_weight,
        total_weight_grams=total_weight_grams_value,
        weight_per_person=calculated_weight_per_person,
        total_items=len(items_data),
        logo_src=logo_src,
        header_image_src=header_image_src,
        background_image_src=background_image_src,
        primary_color=primary_color,
        secondary_color=secondary_color,
        text_color=text_color,
        font_family=font_family,
        company_name=company_name,
        created_date=created_date,
        event_date=event_date,
        # Конфігурація та секції шаблону
        template_config=template_config_obj,
        menu_sections=menu_sections,
        # Загальні фінансові підсумки
        grand_total=grand_total,
        grand_total_formatted=grand_total_formatted,
        fop_percent=fop_percent,
        fop_extra=fop_extra,
        fop_extra_formatted=fop_extra_formatted,
        grand_total_with_fop=grand_total_with_fop,
        grand_total_with_fop_formatted=grand_total_with_fop_formatted,
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
    
    return kp


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
    host: str = Form(""),
    port: str = Form(""),
    user: str = Form(""),
    password: str = Form(""),
    from_email: str = Form(""),
    from_name: str = Form(""),
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user),
):
    """
    Оновлює SMTP налаштування, які використовуються при відправці КП.
    """
    crud.set_setting(db, "smtp_host", host)
    crud.set_setting(db, "smtp_port", port)
    crud.set_setting(db, "smtp_user", user)
    crud.set_setting(db, "smtp_password", password)
    crud.set_setting(db, "smtp_from_email", from_email)
    crud.set_setting(db, "smtp_from_name", from_name)
    return {"status": "success"}


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
    return crud.get_subcategories(db, category_id)

@router.post("/subcategories", response_model=schema.Subcategory)
def create_subcategory(subcategory: schema.SubcategoryCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_subcategory(db, subcategory.name, subcategory.category_id)


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
    return crud.get_menus(db)


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
############################################################

@router.get("/clients", response_model=list[schema.Client])
def list_clients(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_clients(db)


@router.get("/clients/{client_id}", response_model=schema.Client)
def get_client(client_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    client = crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.post("/clients", response_model=schema.Client)
def create_client(client_in: schema.ClientCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.create_client(db, client_in)


@router.put("/clients/{client_id}", response_model=schema.Client)
def update_client(
    client_id: int,
    client_in: schema.ClientUpdate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user),
):
    updated = crud.update_client(db, client_id, client_in)
    if not updated:
        raise HTTPException(status_code=404, detail="Client not found")
    return updated


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
    to_encode = {"sub": str(user.id), "email": user.email, "exp": datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}

# Template endpoints
@router.get("/templates", response_model=list[schema.Template])
def get_templates(db: Session = Depends(get_db), user = Depends(get_current_user)):
    return crud.get_templates(db)

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
    filename: str = Form(...),
    description: str = Form(None),
    is_default: bool = Form(False),
    preview_image: UploadFile = File(None),
    preview_image_url: str = Form(None),
    html_content: str = Form(None),
    header_image: UploadFile = File(None),
    header_image_url: str = Form(None),
    background_image: UploadFile = File(None),
    background_image_url: str = Form(None),
    # Налаштування теми (за замовчуванням — брендовані значення)
    primary_color: str = Form("#FF5A00"),
    secondary_color: str = Form("#1a1a2e"),
    text_color: str = Form("#333333"),
    font_family: str = Form("Segoe UI, Tahoma, Geneva, Verdana, sans-serif"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Створення шаблону КП.

    Варіанти:
    - Клієнт завантажує готовий HTML‑файл у файлову систему (старий варіант, через filename).
    - Клієнт вставляє HTML напряму (html_content) — ми створюємо / перезаписуємо файл uploads/{filename}
      всередині директорії `app/uploads`.
    """

    template_path = UPLOADS_DIR / filename

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
        test_template = env.get_template(filename)
        print(f"✓ Template validation passed: {filename}")
    except Exception as e:
        # Видаляємо файл, якщо валідація не пройшла
        if template_path.exists():
            template_path.unlink()
        error_msg = str(e)
        # Якщо помилка про відсутність базового шаблону (extends/include)
        if "does not exist" in error_msg or "not found" in error_msg.lower():
            raise HTTPException(
                status_code=400, 
                detail=f"Template file not found: {filename}. Можливо, ваш HTML використовує extends або include з файлом, якого не існує в директорії uploads."
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
    elif html_content and not preview_image:
        # Автоматично генеруємо прев'ю з HTML, якщо не завантажено файл прев'ю
        # (незалежно від того, чи передано preview_image_url)
        print(f"Generating automatic preview for template: {filename}")
        auto_preview = generate_template_preview(html_content, filename)
        if auto_preview:
            final_preview_url = auto_preview
        else:
            print(f"⚠ Warning: Failed to generate preview for template {filename}")

    # Обробка зображень шапки та фону
    final_header_url = header_image_url
    final_background_url = background_image_url

    if header_image:
        if header_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу шапки. Дозволені: JPEG, PNG, WebP, GIF")
        final_header_url = save_template_preview(header_image)

    if background_image:
        if background_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу фону. Дозволені: JPEG, PNG, WebP, GIF")
        final_background_url = save_template_preview(background_image)
    
    # Створюємо об'єкт TemplateCreate
    template_data = schema.TemplateCreate(
        name=name,
        filename=filename,
        description=description,
        preview_image_url=final_preview_url,
        is_default=is_default,
        html_content=html_content,
        header_image_url=final_header_url,
        background_image_url=final_background_url,
        primary_color=primary_color or None,
        secondary_color=secondary_color or None,
        text_color=text_color or None,
        font_family=font_family or None,
    )
    
    return crud.create_template(db, template_data)

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
    primary_color: str = Form(None),
    secondary_color: str = Form(None),
    text_color: str = Form(None),
    font_family: str = Form(None),
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
    
    # Визначаємо фінальне ім'я файлу (якщо не передано нове — залишаємо старе)
    final_filename = filename or current_template.filename
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
    # 2) Якщо прев'ю не завантажено, але оновлено HTML — автоматично
    #    регенеруємо прев'ю з нового HTML, щоб картинка в списку шаблонів
    #    завжди відповідала актуальному вигляду КП.
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
    elif html_content:
        # Якщо HTML оновлено, а власноручне прев'ю не завантажено —
        # автоматично перегенеровуємо прев'ю з нового HTML
        print(f"Regenerating automatic preview for template: {final_filename}")
        # Видаляємо старе прев'ю
        if current_template.preview_image_url:
            delete_old_preview(current_template.preview_image_url)
        # Генеруємо нове
        auto_preview = generate_template_preview(html_content, final_filename)
        if auto_preview:
            final_preview_url = auto_preview
            print(f"✓ Preview regenerated successfully: {auto_preview}")
        else:
            print(f"⚠ Warning: Failed to regenerate preview for template {final_filename}")
    
    # Обробка зображень шапки та фону
    final_header_url = current_template.header_image_url
    final_background_url = current_template.background_image_url

    if header_image:
        if header_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу шапки. Дозволені: JPEG, PNG, WebP, GIF")
        if current_template.header_image_url:
            delete_old_preview(current_template.header_image_url)
        final_header_url = save_template_preview(header_image)
    elif header_image_url is not None:
        # Можемо обнулити / змінити URL напряму
        final_header_url = header_image_url or None

    if background_image:
        if background_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу фону. Дозволені: JPEG, PNG, WebP, GIF")
        if current_template.background_image_url:
            delete_old_preview(current_template.background_image_url)
        final_background_url = save_template_preview(background_image)
    elif background_image_url is not None:
        final_background_url = background_image_url or None

    # Створюємо об'єкт TemplateUpdate
    template_data = schema.TemplateUpdate(
        name=name,
        filename=final_filename if filename else None,
        description=description,
        preview_image_url=final_preview_url,
        is_default=is_default,
        html_content=html_content,
        header_image_url=final_header_url,
        background_image_url=final_background_url,
        primary_color=primary_color,
        secondary_color=secondary_color,
        text_color=text_color,
        font_family=font_family,
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

    # Забороняємо видаляти шаблон за замовчуванням
    if template.is_default:
        raise HTTPException(
            status_code=400,
            detail="Неможливо видалити шаблон за замовчуванням. "
                   "Спочатку зніміть позначку 'За замовчуванням' з цього шаблону."
        )

    # Перевіряємо, чи шаблон не використовується в існуючих КП
    kp_using_template = (
        db.query(models.KP)
        .filter(models.KP.template_id == template_id)
        .first()
    )
    if kp_using_template:
        raise HTTPException(
            status_code=400,
            detail="Неможливо видалити шаблон, оскільки він уже використовується в існуючих КП."
        )
    
    # Видаляємо прев'ю якщо воно існує
    if template.preview_image_url:
        delete_old_preview(template.preview_image_url)
    
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
    return crud.get_benefits(db, type_filter=type, active_only=active_only)


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
        
        # Секції меню
        menu_sections = design.get('menu_sections', [
            "Холодні закуски", "Салати", "Гарячі страви", 
            "Гарнір", "Десерти", "Напої"
        ])
        
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
        
        # Отримуємо зображення з design (можуть бути base64 data URLs або file:// шляхи)
        logo_src = design.get('logo_image') or None
        header_image_src = design.get('header_image') or None
        background_image_src = design.get('background_image') or None
        
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
        
        html_content = template.render(
            kp=sample_kp,
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
            font_family=design.get('font_family', 'Arial, sans-serif'),
            company_name=sample_data.get('company_name', 'Назва компанії'),
            created_date=sample_data.get('created_date', ''),
            event_date=sample_data.get('event_date', ''),
            template=template_config_obj,
            template_config=template_config_obj,
            menu_sections=menu_sections,
            grand_total=grand_total,
            grand_total_formatted=grand_total_formatted,
            fop_percent=fop_percent,
            fop_extra=fop_extra,
            fop_extra_formatted=fop_extra_formatted,
            grand_total_with_fop=grand_total_with_fop,
            grand_total_with_fop_formatted=grand_total_with_fop_formatted,
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
    image_type: str = Form(...),  # 'logo' | 'header' | 'background'
    current_user = Depends(get_current_user_db),
):
    """
    Завантажити зображення для шаблону.
    """
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
    filename = f"{image_type}_{current_user.id}_{int(datetime.now().timestamp())}.{file_extension}"
    filepath = templates_dir / filename
    
    # Зберігаємо файл
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Повертаємо URL
    return {"url": f"/uploads/templates/{filename}"}


# ==================== CLIENTS ====================

@router.get("/clients")
def get_clients(
    skip: int = 0, 
    limit: int = 20,
    search: str = None,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
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
    
    total = query.count()
    clients = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "clients": clients
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
    
    # Додаємо інформацію про клієнта
    result = []
    for q in questionnaires:
        client = db.query(models.Client).filter(models.Client.id == q.client_id).first()
        q_dict = {
            **q.__dict__,
            "client_name": client.name if client else None,
            "client_phone": client.phone if client else None,
            "client_company": client.company_name if client else None,
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
        new_questionnaire.manager_id = user.id
    
    db.add(new_questionnaire)
    db.commit()
    db.refresh(new_questionnaire)
    
    return new_questionnaire


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

