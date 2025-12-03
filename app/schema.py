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
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserCreate(UserBase):
    password: str
    role: Optional[str] = "user"


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class UserOut(UserBase):
    id: int
    is_active: bool
    is_admin: bool
    role: str
    department: Optional[str] = None
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
    # Загальні дані про клієнта та захід
    client_name: Optional[str] = None
    event_format: Optional[str] = None
    event_group: Optional[str] = None  # delivery-boxes / catering / other
    event_date: Optional[datetime] = None
    event_location: Optional[str] = None
    event_time: Optional[str] = None
    coordinator_name: Optional[str] = None
    coordinator_phone: Optional[str] = None


class KPItemCreate(BaseModel):
    item_id: int
    quantity: int
    event_format_id: Optional[int] = None  # Якщо страва належить до конкретного формату

class EventFormatCreate(BaseModel):
    name: str  # Назва формату (наприклад, "Welcome drink", "Фуршет")
    event_time: Optional[str] = None  # Час (наприклад, "09:00-11:00", "13:30-14:30")
    people_count: Optional[int] = None  # Кількість гостей для цього формату
    order_index: Optional[int] = 0  # Порядок відображення форматів

class EventFormat(BaseModel):
    id: int
    kp_id: int
    name: str
    event_time: Optional[str] = None
    people_count: Optional[int] = None
    order_index: int

    class Config:
        from_attributes = True

class KPCreate(KPBase):
    total_price: Optional[float] = None
    price_per_person: Optional[float] = None
    items: list[KPItemCreate] = []
    event_formats: Optional[list[EventFormatCreate]] = []  # Список форматів заходу
    template_id: Optional[int] = None
    # Контакти та відправка
    client_email: Optional[str] = None  # Email клієнта
    client_phone: Optional[str] = None  # Телефон клієнта (Telegram)
    send_email: Optional[bool] = False  # Відправити email одразу після створення
    email_message: Optional[str] = None  # Додаткове повідомлення для email
    send_telegram: Optional[bool] = False  # Відправити КП в Telegram одразу після створення
    telegram_message: Optional[str] = None  # Повідомлення в Telegram
    # Додаткові підсумки
    equipment_total: Optional[float] = None
    service_total: Optional[float] = None
    transport_total: Optional[float] = None
    total_weight: Optional[float] = None  # Орієнтовний вихід (сума ваги) - загальна вага в грамах
    weight_per_person: Optional[float] = None  # Вага на 1 гостя в грамах
    # Знижки та кешбек
    discount_id: Optional[int] = None
    cashback_id: Optional[int] = None
    use_cashback: Optional[bool] = False  # Чи списати кешбек з бонусного рахунку
    discount_amount: Optional[float] = None
    cashback_amount: Optional[float] = None
    # Налаштування знижки: що включати в знижку
    discount_include_menu: Optional[bool] = True  # Включити меню в знижку
    discount_include_equipment: Optional[bool] = False  # Включити обладнання в знижку
    discount_include_service: Optional[bool] = False  # Включити сервіс в знижку

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
    # Список форматів заходу, якщо вони задані
    event_formats: Optional[list[EventFormat]] = []
    total_price: Optional[float] = None
    price_per_person: Optional[float] = None
    template_id: Optional[int] = None
    client_email: Optional[str] = None
    client_phone: Optional[str] = None
    equipment_total: Optional[float] = None
    service_total: Optional[float] = None
    transport_total: Optional[float] = None
    total_weight: Optional[float] = None  # Орієнтовний вихід (сума ваги) - загальна вага в грамах
    weight_per_person: Optional[float] = None  # Вага на 1 гостя в грамах
    created_by_id: Optional[int] = None
    discount_id: Optional[int] = None
    cashback_id: Optional[int] = None
    use_cashback: Optional[bool] = False
    discount_amount: Optional[float] = None
    cashback_amount: Optional[float] = None
    discount_include_menu: Optional[bool] = True
    discount_include_equipment: Optional[bool] = False
    discount_include_service: Optional[bool] = False
    
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
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    # Налаштування теми шаблону
    primary_color: Optional[str] = None      # Основний колір (акценти, заголовки)
    secondary_color: Optional[str] = None    # Другорядний колір (фони блоків)
    text_color: Optional[str] = None         # Основний колір тексту
    font_family: Optional[str] = None        # CSS font-family для основного тексту


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
    header_image_url: Optional[str] = None
    background_image_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    text_color: Optional[str] = None
    font_family: Optional[str] = None


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


############################################################
# Menu schemas
############################################################

class MenuItemBase(BaseModel):
    item_id: int
    quantity: int


class MenuItemCreate(MenuItemBase):
    pass


class MenuItem(MenuItemBase):
    id: int

    class Config:
        from_attributes = True


class MenuBase(BaseModel):
    name: str
    description: Optional[str] = None
    event_format: Optional[str] = None
    people_count: Optional[int] = None


class MenuCreate(MenuBase):
    items: list[MenuItemCreate] = []


class MenuUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_format: Optional[str] = None
    people_count: Optional[int] = None
    items: Optional[list[MenuItemCreate]] = None


class Menu(MenuBase):
    id: int
    created_at: Optional[datetime] = None
    items: list[MenuItem] = []

    class Config:
        from_attributes = True


############################################################
# Client schemas
############################################################

class ClientBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[str] = "новий"
    event_date: Optional[datetime] = None
    event_format: Optional[str] = None
    event_group: Optional[str] = None
    event_time: Optional[str] = None
    event_location: Optional[str] = None
    comments: Optional[str] = None
    kp_total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    unpaid_amount: Optional[float] = None
    payment_format: Optional[str] = None
    cash_collector: Optional[str] = None
    payment_plan_date: Optional[datetime] = None
    discount: Optional[str] = None
    cashback: Optional[float] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    status: Optional[str] = None
    event_date: Optional[datetime] = None
    event_format: Optional[str] = None
    event_group: Optional[str] = None
    event_time: Optional[str] = None
    event_location: Optional[str] = None
    comments: Optional[str] = None
    kp_total_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    unpaid_amount: Optional[float] = None
    payment_format: Optional[str] = None
    cash_collector: Optional[str] = None
    payment_plan_date: Optional[datetime] = None
    discount: Optional[str] = None
    cashback: Optional[float] = None


class Client(ClientBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Benefits schemas
class BenefitBase(BaseModel):
    name: str
    type: str  # 'discount' або 'cashback'
    value: float  # Значення у відсотках
    description: Optional[str] = None
    is_active: Optional[bool] = True


class BenefitCreate(BenefitBase):
    pass


class BenefitUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    value: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class Benefit(BenefitBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
