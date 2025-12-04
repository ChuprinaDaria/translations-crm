from pydantic import BaseModel, EmailStr
from typing import Optional, List
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
    # Фінансові деталі
    menu_total: Optional[float] = 0
    equipment_total: Optional[float] = None
    service_total: Optional[float] = None
    transport_total: Optional[float] = None
    total_amount: Optional[float] = 0
    final_amount: Optional[float] = 0
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
    # Нові поля для знижок та кешбеку
    client_id: Optional[int] = None
    discount_type: Optional[str] = None  # "percentage" | "fixed"
    discount_value: Optional[float] = 0
    discount_reason: Optional[str] = None
    cashback_earned: Optional[float] = 0
    cashback_used: Optional[float] = 0
    cashback_rate_applied: Optional[float] = None
    cashback_to_use: Optional[float] = None  # Сума кешбеку для використання при створенні КП

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
    menu_total: Optional[float] = 0
    equipment_total: Optional[float] = None
    service_total: Optional[float] = None
    transport_total: Optional[float] = None
    total_amount: Optional[float] = 0
    final_amount: Optional[float] = 0
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
    # Нові поля для знижок та кешбеку
    client_id: Optional[int] = None
    discount_type: Optional[str] = None  # "percentage" | "fixed"
    discount_value: Optional[float] = 0
    discount_reason: Optional[str] = None
    cashback_earned: Optional[float] = 0
    cashback_used: Optional[float] = 0
    cashback_rate_applied: Optional[float] = None
    cashback_to_use: Optional[float] = None  # Сума кешбеку для використання при створенні КП
    cashback_rate_applied: Optional[float] = None
    
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
    
    # Налаштування відображення колонок у таблиці меню
    show_item_photo: Optional[bool] = True
    show_item_weight: Optional[bool] = True
    show_item_quantity: Optional[bool] = True
    show_item_price: Optional[bool] = True
    show_item_total: Optional[bool] = True
    show_item_description: Optional[bool] = False
    
    # Налаштування підсумкових блоків
    show_weight_summary: Optional[bool] = True
    show_weight_per_person: Optional[bool] = True
    show_discount_block: Optional[bool] = False
    show_equipment_block: Optional[bool] = True
    show_service_block: Optional[bool] = True
    show_transport_block: Optional[bool] = True
    
    # Секції меню (масив категорій)
    menu_sections: Optional[List[str]] = ["Холодні закуски", "Салати", "Гарячі страви", "Гарнір", "Десерти", "Напої"]
    
    # Текстові налаштування
    menu_title: Optional[str] = "Меню"
    summary_title: Optional[str] = "Підсумок"
    footer_text: Optional[str] = None
    
    # Layout налаштування
    page_orientation: Optional[str] = "portrait"  # portrait або landscape
    items_per_page: Optional[int] = 20


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
    
    # Налаштування відображення колонок
    show_item_photo: Optional[bool] = None
    show_item_weight: Optional[bool] = None
    show_item_quantity: Optional[bool] = None
    show_item_price: Optional[bool] = None
    show_item_total: Optional[bool] = None
    show_item_description: Optional[bool] = None
    
    # Налаштування підсумкових блоків
    show_weight_summary: Optional[bool] = None
    show_weight_per_person: Optional[bool] = None
    show_discount_block: Optional[bool] = None
    show_equipment_block: Optional[bool] = None
    show_service_block: Optional[bool] = None
    show_transport_block: Optional[bool] = None
    
    # Секції меню
    menu_sections: Optional[List[str]] = None
    
    # Текстові налаштування
    menu_title: Optional[str] = None
    summary_title: Optional[str] = None
    footer_text: Optional[str] = None
    
    # Layout
    page_orientation: Optional[str] = None
    items_per_page: Optional[int] = None


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
    company_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    total_orders: Optional[int] = 0
    lifetime_spent: Optional[float] = 0
    current_year_spent: Optional[float] = 0
    cashback_balance: Optional[float] = 0
    cashback_earned_total: Optional[float] = 0
    cashback_used_total: Optional[float] = 0
    cashback_expires_at: Optional[datetime] = None
    loyalty_tier: Optional[str] = "silver"
    cashback_rate: Optional[float] = 3.0
    is_custom_rate: Optional[bool] = False
    yearly_photographer_used: Optional[bool] = False
    yearly_robot_used: Optional[bool] = False
    bonus_year: Optional[int] = None
    notes: Optional[str] = None


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    company_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    total_orders: Optional[int] = None
    lifetime_spent: Optional[float] = None
    current_year_spent: Optional[float] = None
    cashback_balance: Optional[float] = None
    cashback_earned_total: Optional[float] = None
    cashback_used_total: Optional[float] = None
    cashback_expires_at: Optional[datetime] = None
    loyalty_tier: Optional[str] = None
    cashback_rate: Optional[float] = None
    is_custom_rate: Optional[bool] = None
    yearly_photographer_used: Optional[bool] = None
    yearly_robot_used: Optional[bool] = None
    bonus_year: Optional[int] = None
    notes: Optional[str] = None


class Client(ClientBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


############################################################
# Client Questionnaire schemas
############################################################

class ClientQuestionnaireBase(BaseModel):
    # СЕРВІС
    event_date: Optional[str] = None  # Date as string for API
    location: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    on_site_contact: Optional[str] = None
    on_site_phone: Optional[str] = None
    arrival_time: Optional[str] = None
    event_start_time: Optional[str] = None
    event_end_time: Optional[str] = None
    service_type_timing: Optional[str] = None
    additional_services_timing: Optional[str] = None
    equipment_notes: Optional[str] = None
    payment_method: Optional[str] = None
    textile_color: Optional[str] = None
    banquet_line_color: Optional[str] = None
    
    # ЗАЇЗД
    venue_complexity: Optional[str] = None
    floor_number: Optional[str] = None
    elevator_available: Optional[bool] = False
    technical_room: Optional[str] = None
    kitchen_available: Optional[str] = None
    venue_photos: Optional[bool] = False
    arrival_photos: Optional[bool] = False
    venue_photos_urls: Optional[List[str]] = None  # URL фото локації
    arrival_photos_urls: Optional[List[str]] = None  # URL фото заїзду
    
    # КУХНЯ
    dish_serving: Optional[str] = None
    hot_snacks_serving: Optional[str] = None
    salad_serving: Optional[str] = None
    product_allergy: Optional[str] = None
    vegetarians: Optional[bool] = False
    hot_snacks_prep: Optional[str] = None
    menu_notes: Optional[str] = None
    client_order_notes: Optional[str] = None
    client_drinks_notes: Optional[str] = None
    
    # КОНТЕНТ
    photo_allowed: Optional[str] = None
    video_allowed: Optional[str] = None
    branded_products: Optional[str] = None
    
    # ЗАМОВНИК
    client_company_name: Optional[str] = None
    client_activity_type: Optional[str] = None
    
    # КОМЕНТАРІ
    special_notes: Optional[str] = None


class ClientQuestionnaireCreate(ClientQuestionnaireBase):
    client_id: int
    manager_id: Optional[int] = None


class ClientQuestionnaireUpdate(BaseModel):
    event_date: Optional[str] = None
    location: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    on_site_contact: Optional[str] = None
    on_site_phone: Optional[str] = None
    arrival_time: Optional[str] = None
    event_start_time: Optional[str] = None
    event_end_time: Optional[str] = None
    service_type_timing: Optional[str] = None
    additional_services_timing: Optional[str] = None
    equipment_notes: Optional[str] = None
    payment_method: Optional[str] = None
    textile_color: Optional[str] = None
    banquet_line_color: Optional[str] = None
    venue_complexity: Optional[str] = None
    floor_number: Optional[str] = None
    elevator_available: Optional[bool] = None
    technical_room: Optional[str] = None
    kitchen_available: Optional[str] = None
    venue_photos: Optional[bool] = None
    arrival_photos: Optional[bool] = None
    venue_photos_urls: Optional[List[str]] = None
    arrival_photos_urls: Optional[List[str]] = None
    dish_serving: Optional[str] = None
    hot_snacks_serving: Optional[str] = None
    salad_serving: Optional[str] = None
    product_allergy: Optional[str] = None
    vegetarians: Optional[bool] = None
    hot_snacks_prep: Optional[str] = None
    menu_notes: Optional[str] = None
    client_order_notes: Optional[str] = None
    client_drinks_notes: Optional[str] = None
    photo_allowed: Optional[str] = None
    video_allowed: Optional[str] = None
    branded_products: Optional[str] = None
    client_company_name: Optional[str] = None
    client_activity_type: Optional[str] = None
    special_notes: Optional[str] = None


class ClientQuestionnaire(ClientQuestionnaireBase):
    id: int
    client_id: int
    manager_id: Optional[int] = None
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


############################################################
# Cashback Transaction schemas
############################################################

class CashbackTransactionBase(BaseModel):
    client_id: int
    kp_id: Optional[int] = None
    transaction_type: str  # "earned" | "used" | "expired"
    amount: float
    balance_after: float
    description: Optional[str] = None


class CashbackTransactionCreate(CashbackTransactionBase):
    pass


class CashbackTransaction(CashbackTransactionBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
