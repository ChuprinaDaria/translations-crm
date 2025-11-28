from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from db import SessionLocal
from datetime import datetime, timedelta
from weasyprint import HTML
from jinja2 import Environment, FileSystemLoader

import crud, schema, crud_user
import jwt, os
import shutil
import uuid
from pathlib import Path
import pyotp
from email_service import send_kp_email
from telegram_service import send_kp_telegram


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
    kp = crud.get_kp(db, kp_id)
    if not kp:
        raise HTTPException(404, "KP not found")

    # Get KPItems and join with Item data
    kp_items = crud.get_kp_items(db, kp_id)

    # Prepare items data with actual Item information
    items_data = []
    total_quantity = 0
    total_weight = 0

    for kp_item in kp_items.items:
        item = crud.get_item(db, kp_item.id)

        item_weight = (item.weight or 0) * kp_item.quantity
        total_weight += item_weight

        if item:
            items_data.append({
                'name': item.name,
                'price': item.price or 0,
                'quantity': kp_item.quantity,
                'total': (item.price or 0) * kp_item.quantity,
                'description': item.description,
                'unit': item.unit,
                'weight': item.weight,
                'total_weight': item_weight,
            })
            total_quantity += kp_item.quantity

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
    
    html_content = template.render(
        kp=kp,
        items=items_data,
        total_price=sum(item['total'] for item in items_data),
        total_weight=total_weight,
        total_items=len(items_data),
        logo_src=logo_src,
    )
    
    # base_url потрібен, щоб WeasyPrint коректно розумів відносні шляхи
    pdf_bytes = HTML(string=html_content, base_url=os.getcwd()).write_pdf(zoom=1)
    filename = f"{kp.title}.pdf"
    
    return pdf_bytes, filename

@router.get("/kp/{kp_id}/pdf")
def generate_kp_pdf(kp_id: int, template_id: int = None, db: Session = Depends(get_db), user = Depends(get_current_user)):
    pdf_bytes, filename = generate_kp_pdf_bytes(kp_id, template_id, db)
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


@router.post("/kp", response_model=schema.KP)
def create_kp(kp_in: schema.KPCreate, db: Session = Depends(get_db), user = Depends(get_current_user)):
    try:
        kp = crud.create_kp(db, kp_in)
        
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


@router.post("/auth/register", response_model=schema.UserOut)
def register(user_in: schema.UserCreate, db: Session = Depends(get_db)):
    existing = crud_user.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user = crud_user.create_user(db, user_in.email, user_in.role, user_in.password)

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
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not crud_user.verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
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
        # Якщо HTML не передали, все одно створюємо порожній шаблон,
        # щоб його можна було відредагувати пізніше з фронта
        try:
            with template_path.open("w", encoding="utf-8") as f:
                f.write("<!-- KP template is empty. Please edit this template in the web UI. -->")
            print(f"✓ Empty template file created: {template_path}")
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
                detail=f"Template file not found: {filename}. Можливо, ваш HTML використовує {% extends %} або {% include %} з файлом, якого не існує в директорії uploads."
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
    
    # Створюємо об'єкт TemplateCreate
    template_data = schema.TemplateCreate(
        name=name,
        filename=filename,
        description=description,
        preview_image_url=final_preview_url,
        is_default=is_default,
        html_content=html_content,
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
    
    # Обробка прев'ю: пріоритет має завантажений файл
    final_preview_url = preview_image_url
    
    if preview_image:
        # Перевіряємо тип файлу
        if preview_image.content_type not in ALLOWED_IMAGE_TYPES:
            raise HTTPException(status_code=400, detail="Недопустимий тип файлу. Дозволені: JPEG, PNG, WebP, GIF")
        
        # Видаляємо старе прев'ю якщо воно існує
        if current_template.preview_image_url:
            delete_old_preview(current_template.preview_image_url)
        
        # Зберігаємо новий файл
        final_preview_url = save_template_preview(preview_image)
    elif preview_image_url is None:
        # Якщо preview_image_url не передано, залишаємо поточне значення
        final_preview_url = current_template.preview_image_url
    
    # Створюємо об'єкт TemplateUpdate
    template_data = schema.TemplateUpdate(
        name=name,
        filename=final_filename if filename else None,
        description=description,
        preview_image_url=final_preview_url,
        is_default=is_default,
        html_content=html_content,
    )
    
    updated = crud.update_template(db, template_id, template_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Template not found")
    return updated

@router.delete("/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), user = Depends(get_current_user)):
    # Отримуємо шаблон перед видаленням для видалення прев'ю
    template = crud.get_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Видаляємо прев'ю якщо воно існує
    if template.preview_image_url:
        delete_old_preview(template.preview_image_url)
    
    deleted = crud.delete_template(db, template_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"status": "success"}

