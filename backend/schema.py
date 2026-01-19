from uuid import UUID
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Literal, Dict, Any, Union
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
    category_id: Optional[int] = None

class SubcategoryCreate(SubcategoryBase):
    pass

class Subcategory(SubcategoryBase):
    id: int
    category: Optional[Category] = None  # Include parent category
    
    class Config:
        from_attributes = True

class BulkDeleteRequest(BaseModel):
    """Схема для bulk delete операцій."""
    ids: List[int]

# Item schemas
class ItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: Optional[float] = None  # Ціна прокату за шт/грн
    stock_quantity: Optional[int] = None  # Кількість на складі
    loss_price: Optional[float] = None  # Ціна втрати шт/грн
    weight: Optional[Union[str, float, int]] = None  # Може бути число або рядок типу "150/75"
    volume: Optional[Union[str, float, int]] = None  # Об'єм (необов'язкове поле)
    unit: Optional[str] = None
    photo_url: Optional[str] = None
    icon_name: Optional[str] = None  # Іконка алергену
    can_cook_on_location: Optional[bool] = False  # Чи можна готувати страву на локації (будинок/палатка/вогонь)
    active: Optional[bool] = True
    
    @field_validator('weight', mode='before')
    @classmethod
    def convert_weight_to_str(cls, v):
        if v is None:
            return None
        # Якщо порожній рядок, повертаємо None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)

class ItemCreate(ItemBase):
    subcategory_id: Optional[int] = None

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    subcategory_id: Optional[int] = None
    description: Optional[str] = None
    price: Optional[float] = None  # Ціна прокату за шт/грн
    stock_quantity: Optional[int] = None  # Кількість на складі
    loss_price: Optional[float] = None  # Ціна втрати шт/грн
    weight: Optional[Union[str, float, int]] = None  # Може бути число або рядок типу "150/75"
    volume: Optional[Union[str, float, int]] = None  # Об'єм (необов'язкове поле)
    unit: Optional[str] = None
    photo_url: Optional[str] = None
    icon_name: Optional[str] = None  # Іконка алергену
    can_cook_on_location: Optional[bool] = None  # Чи можна готувати страву на локації (будинок/палатка/вогонь)
    active: Optional[bool] = None
    
    @field_validator('weight', mode='before')
    @classmethod
    def convert_weight_to_str(cls, v):
        if v is None:
            return None
        # Якщо порожній рядок, повертаємо None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)
    
    @field_validator('volume', mode='before')
    @classmethod
    def convert_volume_to_str(cls, v):
        if v is None:
            return None
        # Якщо порожній рядок, повертаємо None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)

class Item(ItemBase):
    id: int
    subcategory_id: Optional[int] = None
    subcategory: Optional[Subcategory] = None
    created_at: Optional[datetime] = None
    
    @field_validator('weight', mode='before')
    @classmethod
    def convert_weight_to_str(cls, v):
        if v is None:
            return None
        # Якщо порожній рядок, повертаємо None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)
    
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
    phone: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None


class UserOut(UserBase):
    id: UUID
    phone: Optional[str] = None
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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    code: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class KPBase(BaseModel):
    title: str
    people_count: int
    # Статус КП (за замовчуванням "in_progress" - В роботі)
    status: Optional[str] = "in_progress"
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
    item_id: Optional[int] = None  # None для custom items без прив'язки до меню
    quantity: int
    event_format_id: Optional[int] = None  # Якщо страва належить до конкретного формату
    # Поля для custom items (коли item_id = None)
    name: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[float] = None
    unit: Optional[str] = None
    # Поля для альтернатив страв
    is_alternative: Optional[bool] = False  # Чи є страва альтернативою
    alternative_group_id: Optional[str] = None  # ID групи альтернатив
    # Поле для позначення страв, які можна готувати на локації
    can_cook_on_location: Optional[bool] = False  # Чи можна готувати страву на локації

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
    transport_total: Optional[float] = None  # Загальна сума (для сумісності)
    transport_equipment_total: Optional[float] = None  # Транспортні витрати для доставки обладнання
    transport_personnel_total: Optional[float] = None  # Транспортні витрати для персоналу
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
    # Налаштування знижки: що включати в знижку (deprecated, для сумісності)
    discount_include_menu: Optional[bool] = True  # Deprecated
    discount_include_equipment: Optional[bool] = False  # Deprecated
    discount_include_service: Optional[bool] = False  # Deprecated
    # Окремі знижки для кожної категорії
    discount_menu_id: Optional[int] = None  # Знижка на меню
    discount_equipment_id: Optional[int] = None  # Знижка на обладнання (загальна)
    discount_service_id: Optional[int] = None  # Знижка на сервіс
    # Знижки по підкатегоріях обладнання (JSON: {subcategory_id: benefit_id})
    discount_equipment_subcategories: Optional[dict] = None  # {"1": 2, "3": 5} - підкатегорія_id -> benefit_id
    # Нові поля для знижок та кешбеку
    client_id: Optional[int] = None
    discount_type: Optional[str] = None  # "percentage" | "fixed"
    discount_value: Optional[float] = 0
    discount_reason: Optional[str] = None
    cashback_earned: Optional[float] = 0
    cashback_used: Optional[float] = 0
    cashback_rate_applied: Optional[float] = None
    cashback_to_use: Optional[float] = None  # Сума кешбеку для використання при створенні КП
    # Умови бронювання та фото
    booking_terms: Optional[str] = None  # Умови бронювання заходу
    gallery_photos: Optional[list[str]] = None  # Масив шляхів до фото (до 9 фото)

class KPItem(BaseModel):
    id: int
    kp_id: int
    item_id: Optional[int] = None  # None для custom items
    quantity: int
    # Поля для custom items
    name: Optional[str] = None
    price: Optional[float] = None
    weight: Optional[Union[str, float, int]] = None  # Може бути число або рядок типу "150/75"
    unit: Optional[str] = None
    # Поля для альтернатив страв
    is_alternative: Optional[bool] = False  # Чи є страва альтернативою
    alternative_group_id: Optional[str] = None  # ID групи альтернатив
    
    @field_validator('weight', mode='before')
    @classmethod
    def convert_weight_to_str(cls, v):
        if v is None:
            return None
        # Якщо порожній рядок, повертаємо None
        if isinstance(v, str) and not v.strip():
            return None
        return str(v)

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
    # Умови бронювання та фото
    booking_terms: Optional[str] = None  # Умови бронювання заходу
    gallery_photos: Optional[list[str]] = None  # Масив шляхів до фото (до 9 фото)
    
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
    font_family: Optional[str] = None        # CSS font-family для основного тексту (legacy)
    
    # Заголовок КП
    title_text: Optional[str] = "КОМЕРЦІЙНА ПРОПОЗИЦІЯ"
    company_name: Optional[str] = "ДЗИҐА КЕЙТЕРІНҐ"
    
    # Шрифти для різних елементів
    title_font: Optional[str] = None         # Шрифт заголовка
    header_font: Optional[str] = None        # Шрифт секцій (ФУРШЕТ, ОБЛАДНАННЯ...)
    body_font: Optional[str] = None          # Шрифт основного тексту
    table_font: Optional[str] = None         # Шрифт таблиці меню
    
    # Кольори елементів PDF
    format_bg_color: Optional[str] = None       # Фон формату (ФУРШЕТ 13:30-14:30)
    table_header_bg_color: Optional[str] = None # Фон шапки таблиці
    category_bg_color: Optional[str] = None     # Фон категорій страв
    summary_bg_color: Optional[str] = None      # Фон "ДО СПЛАТИ ЗА..."
    total_bg_color: Optional[str] = None        # Фон "ВСЬОГО ДО СПЛАТИ"
    
    # Налаштування тексту категорій та страв
    category_text_align: Optional[str] = "center"  # Вирівнювання тексту категорій: left, center, right
    category_text_color: Optional[str] = None        # Колір тексту категорій
    dish_text_align: Optional[str] = "left"          # Вирівнювання тексту страв: left, center, right
    dish_text_color: Optional[str] = None            # Колір тексту страв
    
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
    
    # Налаштування summary (JSON масив рядків для відображення в підсумку)
    # Формат: [{"label": "Страви", "field": "food_total", "show": true}, ...]
    summary_lines: Optional[List[dict]] = None
    
    # Layout налаштування
    page_orientation: Optional[str] = "portrait"  # portrait або landscape
    items_per_page: Optional[int] = 20
    
    # Галерея фото (до 9 фото, по 3 в рядок)
    gallery_photos: Optional[List[str]] = None
    
    # Розділювач категорій страв (PNG зображення на всю ширину)
    category_separator_image_url: Optional[str] = None
    
    # Умови бронювання
    booking_terms: Optional[str] = None


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
    
    # Заголовок КП
    title_text: Optional[str] = None
    company_name: Optional[str] = None
    
    # Шрифти для різних елементів
    title_font: Optional[str] = None
    header_font: Optional[str] = None
    body_font: Optional[str] = None
    table_font: Optional[str] = None
    
    # Кольори елементів PDF
    format_bg_color: Optional[str] = None
    table_header_bg_color: Optional[str] = None
    category_bg_color: Optional[str] = None
    summary_bg_color: Optional[str] = None
    total_bg_color: Optional[str] = None
    
    # Налаштування тексту категорій та страв
    category_text_align: Optional[str] = None  # Вирівнювання тексту категорій: left, center, right
    category_text_color: Optional[str] = None  # Колір тексту категорій
    dish_text_align: Optional[str] = None      # Вирівнювання тексту страв: left, center, right
    dish_text_color: Optional[str] = None     # Колір тексту страв
    
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
    summary_lines: Optional[List[dict]] = None
    
    # Layout
    page_orientation: Optional[str] = None
    items_per_page: Optional[int] = None
    
    # Галерея фото
    gallery_photos: Optional[List[str]] = None
    
    # Розділювач категорій страв
    category_separator_image_url: Optional[str] = None
    
    # Умови бронювання
    booking_terms: Optional[str] = None


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
    api_id: Optional[int] = None  # API ID для цього акаунта (якщо не вказано - використовується глобальне)
    api_hash: Optional[str] = None  # API Hash для цього акаунта (якщо не вказано - використовується глобальне)


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
    questionnaire_id: Optional[int] = None  # ID останньої анкети для швидкого доступу

    class Config:
        from_attributes = True


############################################################
# Client Questionnaire schemas
############################################################

class ClientQuestionnaireBase(BaseModel):
    # СЕРВІС
    event_date: Optional[str] = None  # Date as string for API
    event_type: Optional[str] = None  # Формат заходу (фуршет, банкет, доставка тощо)
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
    selected_equipment_ids: Optional[List[int]] = None  # ID вибраного обладнання
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
    event_type: Optional[str] = None
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


############################################################
# Purchase / Procurement schemas
############################################################


class PurchaseExportRequest(BaseModel):
    """
    Запит на експорт файлу закупки.

    kp_ids - список ID КП, які потрібно врахувати.
    format - формат файлу (поки що підтримується лише 'excel').
    calculation_type - тип розрахунку:
        - 'catering': кейтерінг (формула: вага × порції)
        - 'box': бокси (формула: вага × компоненти × порції)
        - 'auto': автовизначення на основі event_group КП
    """

    kp_ids: List[int]
    format: Literal["excel", "pdf"] = "excel"
    calculation_type: Literal["catering", "box", "auto"] = "auto"


class ServiceExportRequest(BaseModel):
    """
    Запит на експорт файлу для відділу сервісу.

    kp_ids - список ID КП, які потрібно врахувати.
    format - формат файлу (поки що підтримується лише 'excel').
    """

    kp_ids: List[int]
    format: Literal["excel", "pdf"] = "excel"


class ProcurementGenerateRequest(BaseModel):
    """
    Запит на генерацію Excel-файлу закупки з КП.
    
    kp_ids - список ID вибраних КП
    filename - опціональна назва файлу
    """
    kp_ids: List[int]
    filename: Optional[str] = None


# ============ Техкарти (Рецепти) ============

class RecipeIngredientBase(BaseModel):
    """Інгредієнт техкарти для кейтерінгу."""
    product_name: str
    weight_per_portion: float
    unit: Optional[str] = "г"
    order_index: Optional[int] = 0


class RecipeIngredientCreate(RecipeIngredientBase):
    pass


class RecipeIngredient(RecipeIngredientBase):
    id: int
    recipe_id: int

    class Config:
        from_attributes = True


# --- Компоненти боксів ---

class RecipeComponentIngredientBase(BaseModel):
    """Інгредієнт компонента боксу."""
    product_name: str
    weight_per_unit: float  # Вага на 1 одиницю компонента
    unit: Optional[str] = "г"
    order_index: Optional[int] = 0


class RecipeComponentIngredientCreate(RecipeComponentIngredientBase):
    pass


class RecipeComponentIngredient(RecipeComponentIngredientBase):
    id: int
    component_id: int

    class Config:
        from_attributes = True


class RecipeComponentBase(BaseModel):
    """Компонент боксу (позначений маркером 'in' в Excel)."""
    name: str
    quantity_per_portion: Optional[float] = 1.0  # Кількість на 1 порцію
    weight_per_portion: Optional[float] = None  # Вага компонента в грамах (з колонки B)
    order_index: Optional[int] = 0


class RecipeComponentCreate(RecipeComponentBase):
    ingredients: List[RecipeComponentIngredientCreate] = []


class RecipeComponent(RecipeComponentBase):
    id: int
    recipe_id: int
    ingredients: List[RecipeComponentIngredient] = []

    class Config:
        from_attributes = True


# --- Основна техкарта ---

class RecipeBase(BaseModel):
    name: str
    category: Optional[str] = None
    weight_per_portion: Optional[float] = None
    notes: Optional[str] = None
    item_id: Optional[int] = None
    recipe_type: Literal["catering", "box"] = "catering"


class RecipeCreate(RecipeBase):
    """Створення техкарти."""
    ingredients: List[RecipeIngredientCreate] = []  # Для кейтерінгу
    components: List[RecipeComponentCreate] = []     # Для боксів


class RecipeItemInfo(BaseModel):
    """Інформація про підв'язану страву."""
    id: int
    name: str
    weight: Optional[Union[str, float, int]] = None
    unit: Optional[str] = None

    @field_validator('weight', mode='before')
    @classmethod
    def convert_weight_to_str(cls, v):
        if v is None:
            return None
        # Якщо порожній рядок, повертаємо None
        if isinstance(v, str) and not v.strip():
            return None
        # Конвертуємо float/int в string
        if isinstance(v, (float, int)):
            # Якщо це ціле число, повертаємо без десяткової частини
            if isinstance(v, float) and v.is_integer():
                return str(int(v))
            return str(v)
        return str(v) if v else None

    @field_validator('unit', mode='before')
    @classmethod
    def set_default_unit(cls, v):
        # Якщо unit не вказано або порожній, автоматично ставимо "г"
        if v is None or (isinstance(v, str) and not v.strip()):
            return "г"
        return v

    class Config:
        from_attributes = True


class Recipe(RecipeBase):
    id: int
    ingredients: List[RecipeIngredient] = []
    components: List[RecipeComponent] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    item: Optional[RecipeItemInfo] = None  # Підв'язана страва

    class Config:
        from_attributes = True


class RecipeListResponse(BaseModel):
    """Відповідь зі списком техкарт."""
    recipes: List[Recipe]
    total: int
    catering_count: int
    box_count: int


# ============ Продукти для закупки ============

class ProductBase(BaseModel):
    name: str
    category: Optional[str] = None
    subcategory: Optional[str] = None
    unit: Optional[str] = "г"


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ Імпорт калькуляцій ============

class CalcImportRequest(BaseModel):
    """Запит на імпорт файлу калькуляцій."""
    recipe_type: Literal["catering", "box"] = "catering"


class CalcImportResult(BaseModel):
    """Результат імпорту файлу калькуляцій."""
    recipes_imported: int
    components_imported: Optional[int] = 0  # Тільки для боксів
    products_imported: int
    errors: List[str] = []
    recipe_type: str = "catering"


class CalculationsFile(BaseModel):
    """Метадані завантаженого файлу калькуляцій (техкарт)."""
    id: int
    filename: str
    recipe_type: Literal["catering", "box"]
    size_bytes: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class RecipeAutoLinkResult(BaseModel):
    linked: int
    created_items: int = 0
    updated_item_weights: int
    skipped: int
    errors: List[str] = []


class PurchaseCalculateResult(BaseModel):
    """Результат розрахунку закупки."""
    products: Dict[str, Dict[str, Any]]
    dishes_without_recipe: List[str]
    total_dishes: int
    dishes_with_recipe: int
    calculation_type: str


# ============ Чекліст для боксів / кейтерингу ============

class ChecklistBase(BaseModel):
    """Базова схема чекліста."""
    checklist_type: Literal["box", "catering"]
    
    # Дата заходу
    event_date: Optional[str] = None
    
    # Контакт
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    
    # Формат заходу
    event_format: Optional[str] = None
    
    # Привід/причина святкування
    event_reason: Optional[str] = None
    
    # Номер замовлення (для боксів)
    order_number: Optional[str] = None
    
    # Час доставки / Час початку заходу
    delivery_time: Optional[str] = None
    
    # Тривалість заходу
    event_duration: Optional[str] = None
    
    # Чи потрібен кур'єр/інший персонал
    needs_courier: Optional[bool] = False
    personnel_notes: Optional[str] = None
    
    # Локація
    location_address: Optional[str] = None
    location_floor: Optional[str] = None
    location_elevator: Optional[bool] = False
    
    # К-кість гостей
    guest_count: Optional[int] = None
    
    # Бюджет
    budget: Optional[str] = None
    budget_amount: Optional[float] = None
    
    # Обладнання (кейтеринг)
    equipment_furniture: Optional[bool] = False
    equipment_tablecloths: Optional[bool] = False
    equipment_disposable_dishes: Optional[bool] = False
    equipment_glass_dishes: Optional[bool] = False
    equipment_notes: Optional[str] = None
    
    # Побажання щодо страв
    food_hot: Optional[bool] = False
    food_cold: Optional[bool] = False
    food_salads: Optional[bool] = False
    food_garnish: Optional[bool] = False
    food_sweet: Optional[bool] = False
    food_vegetarian: Optional[bool] = False
    food_vegan: Optional[bool] = False
    food_preference: Optional[str] = None  # більше м'ясного чи рибного
    food_notes: Optional[str] = None
    
    # Загальний коментар
    general_comment: Optional[str] = None
    
    # Напої та алкоголь
    drinks_notes: Optional[str] = None
    alcohol_notes: Optional[str] = None
    
    # Знижка та націнка
    discount_notes: Optional[str] = None
    surcharge_notes: Optional[str] = None
    
    # Статус
    status: Optional[str] = "draft"


class ChecklistCreate(ChecklistBase):
    """Схема для створення чекліста."""
    client_id: Optional[int] = None
    manager_id: Optional[int] = None


class ChecklistUpdate(BaseModel):
    """Схема для оновлення чекліста."""
    checklist_type: Optional[Literal["box", "catering"]] = None
    event_date: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    event_format: Optional[str] = None
    event_reason: Optional[str] = None
    order_number: Optional[str] = None
    delivery_time: Optional[str] = None
    event_duration: Optional[str] = None
    needs_courier: Optional[bool] = None
    personnel_notes: Optional[str] = None
    location_address: Optional[str] = None
    location_floor: Optional[str] = None
    location_elevator: Optional[bool] = None
    guest_count: Optional[int] = None
    budget: Optional[str] = None
    budget_amount: Optional[float] = None
    equipment_furniture: Optional[bool] = None
    equipment_tablecloths: Optional[bool] = None
    equipment_disposable_dishes: Optional[bool] = None
    equipment_glass_dishes: Optional[bool] = None
    equipment_notes: Optional[str] = None
    food_hot: Optional[bool] = None
    food_cold: Optional[bool] = None
    food_salads: Optional[bool] = None
    food_garnish: Optional[bool] = None
    food_sweet: Optional[bool] = None
    food_vegetarian: Optional[bool] = None
    food_vegan: Optional[bool] = None
    food_preference: Optional[str] = None
    food_notes: Optional[str] = None
    general_comment: Optional[str] = None
    drinks_notes: Optional[str] = None
    alcohol_notes: Optional[str] = None
    discount_notes: Optional[str] = None
    surcharge_notes: Optional[str] = None
    status: Optional[str] = None
    client_id: Optional[int] = None
    kp_id: Optional[int] = None


class Checklist(ChecklistBase):
    """Схема для повернення чекліста."""
    id: int
    client_id: Optional[int] = None
    kp_id: Optional[int] = None
    manager_id: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # Додаткові поля для відображення
    client_name: Optional[str] = None
    manager_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class ChecklistListResponse(BaseModel):
    """Відповідь зі списком чеклістів."""
    checklists: List[Checklist]
    total: int
    box_count: int
    catering_count: int
