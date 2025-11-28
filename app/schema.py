from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# Category schemas (define first)
class CategoryBase(BaseModel):
    name: Optional[str]

class CategoryCreate(CategoryBase):
    pass

class Category(CategoryBase):
    id: int
    
    class Config:
        from_attributes = True

# Subcategory schemas
class SubcategoryBase(BaseModel):
    name: str
    category_id: int

class SubcategoryCreate(SubcategoryBase):
    pass

class Subcategory(SubcategoryBase):
    id: int
    category: Optional[Category] = None  # Include parent category
    
    class Config:
        from_attributes = True

# Item schemas
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    unit: Optional[str] = None
    photo_url: Optional[str] = None
    active: Optional[bool] = True

class ItemCreate(ItemBase):
    subcategory_id: Optional[int] = None

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    subcategory_id: Optional[int] = None
    description: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    unit: Optional[str] = None
    photo_url: Optional[str] = None
    active: Optional[bool] = None

class Item(ItemBase):
    id: int
    subcategory_id: Optional[int] = None
    subcategory: Optional[Subcategory] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

# User schemas
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: str

class UserOut(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    role: str
    created_at: Optional[datetime] = None
    otpauth_url: Optional[str] = None
    
    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class KPBase(BaseModel):
    title: str
    people_count: int
    # Статус КП (за замовчуванням "sent")
    status: Optional[str] = "sent"


class KPItemCreate(BaseModel):
    item_id: int
    quantity: int

class KPCreate(KPBase):
    total_price: Optional[float] = None
    price_per_person: Optional[float] = None
    items: list[KPItemCreate] = []
    template_id: Optional[int] = None
    client_email: Optional[str] = None  # Email клієнта
    client_phone: Optional[str] = None  # Телефон клієнта (Telegram)
    send_email: Optional[bool] = False  # Відправити email одразу після створення
    email_message: Optional[str] = None  # Додаткове повідомлення для email
    send_telegram: Optional[bool] = False  # Відправити КП в Telegram одразу після створення
    telegram_message: Optional[str] = None  # Повідомлення в Telegram

class KPItem(BaseModel):
    id: int
    kp_id: int
    item_id: int
    quantity: int

    class Config:
        from_attributes = True

class KP(KPBase):
    id: int
    created_at: Optional[datetime]
    items: list[KPItem] = []
    total_price: Optional[float] = None
    price_per_person: Optional[float] = None
    template_id: Optional[int] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    
    class Config:
        from_attributes = True


class KPStatusUpdate(BaseModel):
    status: str

############################################################
# Template schemas
############################################################

class TemplateBase(BaseModel):
    """
    Базова схема шаблону КП, що зберігається в БД.
    """
    name: str
    filename: str
    description: Optional[str] = None
    preview_image_url: Optional[str] = None
    is_default: Optional[bool] = False


class TemplateCreate(TemplateBase):
    """
    Схема для створення шаблону.
    
    html_content тут не зберігається напряму в БД, а використовується
    для створення / оновлення HTML‑файлу в app/uploads/{filename}.
    """
    html_content: Optional[str] = None


class TemplateUpdate(BaseModel):
    """
    Схема для оновлення шаблону.
    """
    name: Optional[str] = None
    filename: Optional[str] = None
    description: Optional[str] = None
    preview_image_url: Optional[str] = None
    is_default: Optional[bool] = None
    html_content: Optional[str] = None


class Template(TemplateBase):
    """
    Схема для повернення шаблону з API.
    
    html_content використовується лише для відображення / редагування
    HTML клієнтом (наприклад, у формі "Шаблони КП").
    """
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    html_content: Optional[str] = None
    
    class Config:
        from_attributes = True

# Email schemas
class EmailSendRequest(BaseModel):
    to_email: str
    message: Optional[str] = None  # Додаткове повідомлення в листі


class TelegramSendRequest(BaseModel):
    to_phone: str
    message: Optional[str] = None  # Додаткове повідомлення в Telegram
    telegram_account_id: Optional[int] = None  # Якщо не вказано — використати перший активний акаунт


class TelegramAccountBase(BaseModel):
    name: str
    phone: Optional[str] = None


class TelegramAccountCreate(TelegramAccountBase):
    session_string: str


class TelegramAccount(TelegramAccountBase):
    id: int
    is_active: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
