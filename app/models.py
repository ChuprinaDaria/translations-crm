# DB Models

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, Text, Numeric, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime, date
from enum import Enum
from db import Base


class LoyaltyTier(str, Enum):
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"
    CUSTOM = "custom"  # Для індивідуальних умов


class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    subcategories = relationship("Subcategory", back_populates="category")

class Subcategory(Base):
    __tablename__ = "subcategories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"))
    category = relationship("Category", back_populates="subcategories")
    items = relationship("Item", back_populates="subcategory")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)

    # category = Column(String, index=True)
    subcategory_id = Column(Integer, ForeignKey("subcategories.id"), nullable=True)
    subcategory = relationship("Subcategory", back_populates="items")
    
    price = Column(Float, index=True)
    weight = Column(String, index=True)  # Може бути число або рядок типу "150/75"
    unit = Column(String, index=True)
    description = Column(String, index=True)

    photo_url = Column(String, index=True)

    active = Column(Boolean, default=True)
    
    kp_items = relationship("KPItem", back_populates="item", lazy="selectin")

    # created_at = Column(String, server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    role = Column(String, default='user')
    department = Column(String, nullable=True)  # Напр.: "КП", "Продажі"

    totp_secret = Column(String, nullable=False)
    hashed_password = Column(String, nullable=True)

    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    filename = Column(String, nullable=False)  # Назва файлу шаблону в uploads/
    description = Column(String, nullable=True)
    preview_image_url = Column(String, nullable=True)  # URL прев'ю зображення шаблону
    header_image_url = Column(String, nullable=True)  # Зображення шапки (hero)
    background_image_url = Column(String, nullable=True)  # Фонове зображення сторінки
    # Налаштування теми шаблону (для нетехнічних користувачів)
    primary_color = Column(String, nullable=True)    # Основний колір (кнопки, заголовки)
    secondary_color = Column(String, nullable=True)  # Другорядний колір / фони блоків
    text_color = Column(String, nullable=True)       # Основний колір тексту
    font_family = Column(String, nullable=True)      # Назва шрифту (CSS font-family)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Налаштування відображення колонок у таблиці меню
    show_item_photo = Column(Boolean, default=True)
    show_item_weight = Column(Boolean, default=True)
    show_item_quantity = Column(Boolean, default=True)
    show_item_price = Column(Boolean, default=True)
    show_item_total = Column(Boolean, default=True)
    show_item_description = Column(Boolean, default=False)
    
    # Налаштування підсумкових блоків
    show_weight_summary = Column(Boolean, default=True)
    show_weight_per_person = Column(Boolean, default=True)
    show_discount_block = Column(Boolean, default=False)
    show_equipment_block = Column(Boolean, default=True)
    show_service_block = Column(Boolean, default=True)
    show_transport_block = Column(Boolean, default=True)
    
    # Секції меню (JSON масив категорій)
    menu_sections = Column(JSON, default=lambda: [
        "Холодні закуски", "Салати", "Гарячі страви", 
        "Гарнір", "Десерти", "Напої"
    ])
    
    # Текстові налаштування
    menu_title = Column(String, default="Меню")
    summary_title = Column(String, default="Підсумок")
    footer_text = Column(Text, nullable=True)
    
    # Layout налаштування
    page_orientation = Column(String, default="portrait")  # portrait або landscape
    items_per_page = Column(Integer, default=20)
    
    # Галерея фото (до 9 фото, відображаються по 3 в рядок)
    gallery_photos = Column(JSON, nullable=True)  # Масив шляхів до фото галереї
    
    # Умови бронювання (текст з пунктами)
    booking_terms = Column(Text, nullable=True)

    kps = relationship("KP", back_populates="template")


class KP(Base):
    __tablename__ = "kps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    people_count = Column(Integer)
    total_price = Column(Float)
    price_per_person = Column(Float)
    # Загальні дані про клієнта та подію
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True)  # Зв'язок з клієнтом
    client_name = Column(String, nullable=True, index=True)
    event_format = Column(String, nullable=True)
    event_group = Column(String, nullable=True)  # Доставка боксів / Кейтерінг / Інше
    event_date = Column(DateTime(timezone=True), nullable=True)
    event_location = Column(String, nullable=True)
    event_time = Column(String, nullable=True)
    coordinator_name = Column(String, nullable=True)
    coordinator_phone = Column(String, nullable=True)
    # Автор / менеджер, який створив КП
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User")
    # Статус життєвого циклу КП:
    # in_progress    – в роботі (збір інформації, аналіз ТЗ, формування КП)
    # sent_to_sales  – відправлено менеджеру з продажу (внутрішня перевірка)
    # revision       – коригування (правки після коментарів)
    # sent           – відправлено клієнту
    # approved       – затверджено клієнтом
    # rejected       – відхилено клієнтом
    # completed      – виконано (подія відбулася)
    # draft          – чернетка
    status = Column(String, default="in_progress", index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    client_email = Column(String, nullable=True, index=True)  # Email клієнта
    client_phone = Column(String, nullable=True, index=True)  # Телефон клієнта (Telegram / Viber etc.)
    # Фінансові деталі
    menu_total = Column(Numeric(10, 2), default=0)  # Сума тільки меню (кухня)
    equipment_total = Column(Numeric(10, 2), default=0)
    service_total = Column(Numeric(10, 2), default=0)
    transport_total = Column(Numeric(10, 2), default=0)  # Загальна сума (для сумісності)
    transport_equipment_total = Column(Numeric(10, 2), default=0)  # Транспортні витрати для доставки обладнання
    transport_personnel_total = Column(Numeric(10, 2), default=0)  # Транспортні витрати для персоналу
    # Орієнтовний вихід (сума ваги)
    total_weight = Column(Float, nullable=True)  # Загальна вага в грамах
    weight_per_person = Column(Float, nullable=True)  # Вага на 1 гостя в грамах
    # Знижки та кешбек (стара система через benefits)
    discount_id = Column(Integer, ForeignKey("benefits.id"), nullable=True)  # Deprecated: використовується для сумісності
    cashback_id = Column(Integer, ForeignKey("benefits.id"), nullable=True)
    use_cashback = Column(Boolean, default=False, nullable=False)  # Чи списати кешбек з бонусного рахунку
    discount_amount = Column(Float, nullable=True)  # Сума знижки
    cashback_amount = Column(Float, nullable=True)  # Сума кешбеку
    # Налаштування знижки: що включати в знижку (deprecated)
    discount_include_menu = Column(Boolean, default=True, nullable=False)  # Deprecated
    discount_include_equipment = Column(Boolean, default=False, nullable=False)  # Deprecated
    discount_include_service = Column(Boolean, default=False, nullable=False)  # Deprecated
    # Окремі знижки для кожної категорії
    discount_menu_id = Column(Integer, ForeignKey("benefits.id"), nullable=True)  # Знижка на меню
    discount_equipment_id = Column(Integer, ForeignKey("benefits.id"), nullable=True)  # Знижка на обладнання (загальна)
    discount_service_id = Column(Integer, ForeignKey("benefits.id"), nullable=True)  # Знижка на сервіс
    # Знижки по підкатегоріях обладнання (JSON: {subcategory_id: benefit_id})
    discount_equipment_subcategories = Column(JSON, nullable=True)  # {"1": 2, "3": 5} - підкатегорія_id -> benefit_id
    
    # Історія знижок для цього КП (нова система)
    discount_type = Column(String, nullable=True)  # "percentage" | "fixed"
    discount_value = Column(Numeric(10, 2), default=0)  # 10% або 500 грн
    discount_reason = Column(String, nullable=True)  # "Постійний клієнт", "Акція"
    
    # Кешбек для цього КП (нова система)
    cashback_earned = Column(Numeric(10, 2), default=0)  # Нарахований кешбек
    cashback_used = Column(Numeric(10, 2), default=0)  # Використаний кешбек
    cashback_rate_applied = Column(Numeric(5, 2), nullable=True)  # Який % був застосований
    
    # Загальна сума
    total_amount = Column(Numeric(10, 2), default=0)
    final_amount = Column(Numeric(10, 2), default=0)  # Після знижок та кешбеку
    
    # Умови бронювання та додаткові матеріали
    booking_terms = Column(Text, nullable=True)  # Умови бронювання заходу
    gallery_photos = Column(JSON, nullable=True)  # Масив шляхів до фото (до 9 фото, відображаються по 3 в рядок)

    items = relationship("KPItem", back_populates="kp", lazy="selectin", cascade='all, delete-orphan')
    event_formats = relationship("KPEventFormat", back_populates="kp", lazy="selectin", cascade='all, delete-orphan', order_by="KPEventFormat.order_index")
    template = relationship("Template", back_populates="kps")
    client = relationship("Client", back_populates="kps")
    discount_benefit = relationship("Benefit", foreign_keys=[discount_id])
    cashback_benefit = relationship("Benefit", foreign_keys=[cashback_id])


class Benefit(Base):
    """
    Рівні знижок та кешбеку, які адмін створює, а менеджер вибирає для КП.
    """
    __tablename__ = "benefits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Назва рівня (напр. "Знижка 5%", "Кешбек 3%")
    type = Column(String, nullable=False, index=True)  # 'discount' або 'cashback'
    value = Column(Float, nullable=False)  # Значення у відсотках (напр. 5 для 5%)
    description = Column(String, nullable=True)  # Опис
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class TelegramAccount(Base):
    """
    Обліковий запис Telegram, з якого можуть надсилатися КП.
    Зберігаємо лише метадані та session_string (створюється окремим інструментом).
    """
    __tablename__ = "telegram_accounts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)          # Назва в UI (наприклад, "Менеджер 1")
    phone = Column(String, nullable=True, index=True)          # Телефон акаунта (для інформації)
    session_string = Column(String, nullable=False)            # Секретна сесія Telethon
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())



class KPItem(Base):
    __tablename__ = "kp_items"

    id = Column(Integer, primary_key=True, index=True)
    kp_id = Column(Integer, ForeignKey("kps.id"))
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)  # Nullable для custom items
    quantity = Column(Integer, default=1)
    event_format_id = Column(Integer, ForeignKey("kp_event_formats.id"), nullable=True)  # Якщо страва належить до конкретного формату
    # Поля для custom items (коли item_id = None)
    name = Column(String, nullable=True)
    price = Column(Float, nullable=True)
    weight = Column(String, nullable=True)  # Може бути число або рядок типу "150/75"
    unit = Column(String, nullable=True)

    kp = relationship("KP", back_populates="items")
    item = relationship("Item", back_populates="kp_items", lazy="joined")
    event_format = relationship("KPEventFormat", back_populates="items")


class KPEventFormat(Base):
    """
    Формат заходу в КП. Один КП може мати кілька форматів (наприклад, Welcome drink 09:00-11:00 та Фуршет 13:30-14:30).
    """
    __tablename__ = "kp_event_formats"

    id = Column(Integer, primary_key=True, index=True)
    kp_id = Column(Integer, ForeignKey("kps.id"), nullable=False)
    name = Column(String, nullable=False)  # Назва формату (наприклад, "Welcome drink", "Фуршет")
    event_time = Column(String, nullable=True)  # Час (наприклад, "09:00-11:00", "13:30-14:30")
    people_count = Column(Integer, nullable=True)  # Кількість гостей для цього формату
    order_index = Column(Integer, default=0)  # Порядок відображення форматів

    kp = relationship("KP", back_populates="event_formats")
    items = relationship("KPItem", back_populates="event_format")


class AppSetting(Base):
    """
    Загальні налаштування системи (key/value), наприклад SMTP та Telegram API.
    """
    __tablename__ = "app_settings"

    key = Column(String, primary_key=True, index=True)
    value = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class Menu(Base):
    """
    Готове меню (набір страв) для подальшого використання в КП.
    Наприклад: \"Фуршет 55 осіб\", \"Діловий обід\" тощо.
    """
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    event_format = Column(String, nullable=True)
    people_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("MenuItem", back_populates="menu", cascade="all, delete-orphan")


class MenuItem(Base):
    """
    Зв'язка меню та страви з кількістю порцій.
    """
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    menu_id = Column(Integer, ForeignKey("menus.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, default=1)

    menu = relationship("Menu", back_populates="items")
    item = relationship("Item", lazy="joined")


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)  # Ім'я контакту
    company_name = Column(String, nullable=True)  # Назва компанії
    phone = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=True)
    
    # Накопичувальні дані
    total_orders = Column(Integer, default=0)  # Загальна к-ть замовлень
    lifetime_spent = Column(Numeric(10, 2), default=0)  # Загальна сума за весь час
    current_year_spent = Column(Numeric(10, 2), default=0)  # Сума за поточний рік
    
    # Кешбек
    cashback_balance = Column(Numeric(10, 2), default=0)  # Поточний кешбек
    cashback_earned_total = Column(Numeric(10, 2), default=0)  # Всього нараховано
    cashback_used_total = Column(Numeric(10, 2), default=0)  # Всього використано
    cashback_expires_at = Column(Date, nullable=True)  # Дата згоряння (31.12)
    
    # Рівень лояльності
    loyalty_tier = Column(String, default="silver")  # silver/gold/platinum/diamond/custom
    cashback_rate = Column(Numeric(5, 2), default=3.0)  # % кешбеку (може бути кастомний)
    is_custom_rate = Column(Boolean, default=False)  # Чи індивідуальні умови
    
    # Бонуси Diamond (використані/доступні)
    yearly_photographer_used = Column(Boolean, default=False)
    yearly_robot_used = Column(Boolean, default=False)
    bonus_year = Column(Integer, default=lambda: datetime.now().year)  # Рік для бонусів
    
    # Джерело створення клієнта
    source = Column(String(50), nullable=True, default="manual")  # manual/checklist/kp/import
    
    # Мета дані
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    notes = Column(Text, nullable=True)  # Коментарі менеджера
    
    # Відносини
    kps = relationship("KP", back_populates="client")
    questionnaires = relationship("ClientQuestionnaire", back_populates="client", cascade="all, delete-orphan")
    cashback_transactions = relationship("CashbackTransaction", back_populates="client")


class ClientQuestionnaire(Base):
    """Анкета клієнта для відділу продажів"""
    __tablename__ = "client_questionnaires"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Менеджер, який створив анкету
    
    # СЕРВІС
    event_date = Column(Date, nullable=True)  # Дата заходу
    event_type = Column(String(200), nullable=True)  # Формат заходу (фуршет, банкет, доставка тощо)
    location = Column(String(500), nullable=True)  # Точна локація
    contact_person = Column(String(200), nullable=True)  # Контакт замовника
    contact_phone = Column(String(50), nullable=True)
    on_site_contact = Column(String(200), nullable=True)  # Хто буде головним на локації
    on_site_phone = Column(String(50), nullable=True)
    
    arrival_time = Column(Text, nullable=True)  # Час заїзду на локацію
    event_start_time = Column(String(50), nullable=True)  # Час початку заходу
    event_end_time = Column(String(50), nullable=True)  # Час кінця заходу
    
    service_type_timing = Column(Text, nullable=True)  # Таймінги всіх видач
    additional_services_timing = Column(Text, nullable=True)  # Таймінги додаткових видач
    equipment_notes = Column(Text, nullable=True)  # Коментарі щодо обладнання
    selected_equipment_ids = Column(JSON, nullable=True)  # ID вибраного обладнання для автоматичного додавання в КП
    
    payment_method = Column(String(200), nullable=True)  # Спосіб оплати (Предоплата/Залишок)
    
    textile_color = Column(String(100), nullable=True)  # Колір текстилю
    banquet_line_color = Column(String(200), nullable=True)  # Колір оформлення лінії
    
    # ЗАЇЗД
    venue_complexity = Column(String(200), nullable=True)  # Складність заїзду
    floor_number = Column(String(100), nullable=True)  # На якому поверсі
    elevator_available = Column(Boolean, default=False)  # Чи є ліфт
    technical_room = Column(String(200), nullable=True)  # Чи є технічне приміщення
    kitchen_available = Column(String(200), nullable=True)  # Чи є кухня
    venue_photos = Column(Boolean, default=False)  # Фото локації (чи є)
    arrival_photos = Column(Boolean, default=False)  # Фото заїзду (чи є)
    venue_photos_urls = Column(JSON, nullable=True)  # URL фото локації (список)
    arrival_photos_urls = Column(JSON, nullable=True)  # URL фото заїзду (список)
    
    # КУХНЯ
    dish_serving = Column(String(200), nullable=True)  # Посуд для подачі страв
    dish_serving_equipment_ids = Column(JSON, nullable=True)  # ID обладнання для подачі страв
    hot_snacks_serving = Column(String(200), nullable=True)  # Подача гарячих закусок
    hot_snacks_equipment_ids = Column(JSON, nullable=True)  # ID обладнання для гарячих закусок
    salad_serving = Column(String(200), nullable=True)  # Подання салатів
    salad_equipment_ids = Column(JSON, nullable=True)  # ID обладнання для салатів
    product_allergy = Column(String(200), nullable=True)  # Чи є алергія на продукти
    vegetarians = Column(Boolean, default=False)  # Чи є вегетаріанці
    
    hot_snacks_prep = Column(String(200), nullable=True)  # Приготування гарячих закусок
    menu_notes = Column(Text, nullable=True)  # Коментарі до позицій меню
    client_order_notes = Column(Text, nullable=True)  # Їжа від замовника
    client_drinks_notes = Column(Text, nullable=True)  # Напої від замовника
    
    # КОНТЕНТ
    photo_allowed = Column(String(200), nullable=True)  # Чи можна фотозйомка
    video_allowed = Column(String(200), nullable=True)  # Чи можна відеозйомка
    branded_products = Column(String(200), nullable=True)  # Чи можна брендовану продукцію
    
    # ЗАМОВНИК
    client_company_name = Column(String(300), nullable=True)  # Назва компанії
    client_activity_type = Column(String(300), nullable=True)  # Вид діяльності
    
    # КОМЕНТАРІ
    special_notes = Column(Text, nullable=True)  # Спеціальні примітки

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Відносини
    client = relationship("Client", back_populates="questionnaires")
    manager = relationship("User", foreign_keys=[manager_id])


class CashbackTransaction(Base):
    """Історія операцій з кешбеком"""
    __tablename__ = "cashback_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    kp_id = Column(Integer, ForeignKey("kps.id"), nullable=True)
    
    transaction_type = Column(String, nullable=False)  # "earned" | "used" | "expired"
    amount = Column(Numeric(10, 2), nullable=False)  # Сума (може бути негативна при використанні)
    balance_after = Column(Numeric(10, 2), nullable=False)  # Баланс після операції
    
    description = Column(String, nullable=True)  # "Нараховано за КП #123", "Використано в КП #124"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Відносини
    client = relationship("Client", back_populates="cashback_transactions")
    kp = relationship("KP")


class Recipe(Base):
    """
    Техкарта (калькуляція) страви.
    Містить інгредієнти та їх кількості для приготування однієї порції.
    
    Підтримує два типи:
    - catering: проста структура (страва → інгредієнти)
    - box: трирівнева структура (страва → компоненти → інгредієнти)
    """
    __tablename__ = "recipes"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False, index=True)  # Назва страви
    category = Column(String(100), nullable=True, index=True)  # Категорія (холодні, гарячі, etc.)
    weight_per_portion = Column(Float, nullable=True)  # Вага однієї порції в грамах
    
    # Тип техкарти: 'catering' або 'box'
    recipe_type = Column(String(20), default="catering", index=True)
    
    # Зв'язок з Item (якщо страва є в меню)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=True)
    item = relationship("Item")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Відносини
    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")
    components = relationship("RecipeComponent", back_populates="recipe", cascade="all, delete-orphan")


class RecipeComponent(Base):
    """
    Компонент боксу (позначений маркером 'in' в Excel).
    Використовується для трирівневої структури боксів.
    
    Приклад: Бокс "Сніданок" містить:
    - 2 круасани (компонент)
    - 1 йогурт (компонент)
    Кожен компонент має свої інгредієнти.
    """
    __tablename__ = "recipe_components"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    
    name = Column(String(300), nullable=False)  # Назва компонента
    quantity_per_portion = Column(Float, default=1.0)  # Кількість на 1 порцію боксу
    order_index = Column(Integer, default=0)  # Порядок відображення
    
    # Відносини
    recipe = relationship("Recipe", back_populates="components")
    ingredients = relationship("RecipeComponentIngredient", back_populates="component", cascade="all, delete-orphan")


class RecipeIngredient(Base):
    """
    Інгредієнт техкарти - продукт та його кількість на 1 порцію страви.
    Використовується для кейтерінгу (пряма структура: страва → інгредієнти).
    """
    __tablename__ = "recipe_ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)
    
    product_name = Column(String(300), nullable=False, index=True)  # Назва продукту
    weight_per_portion = Column(Float, nullable=False)  # Вага на 1 порцію в грамах
    unit = Column(String(50), default="г")  # Одиниця виміру
    order_index = Column(Integer, default=0)  # Порядок відображення
    
    # Відносини
    recipe = relationship("Recipe", back_populates="ingredients")


class RecipeComponentIngredient(Base):
    """
    Інгредієнт компонента боксу.
    Використовується для трирівневої структури боксів.
    
    Формула розрахунку: вага × кількість_компонентів × кількість_порцій
    """
    __tablename__ = "recipe_component_ingredients"
    
    id = Column(Integer, primary_key=True, index=True)
    component_id = Column(Integer, ForeignKey("recipe_components.id", ondelete="CASCADE"), nullable=False)
    
    product_name = Column(String(300), nullable=False, index=True)  # Назва продукту
    weight_per_unit = Column(Float, nullable=False)  # Вага на 1 одиницю компонента в грамах
    unit = Column(String(50), default="г")  # Одиниця виміру
    order_index = Column(Integer, default=0)  # Порядок відображення
    
    # Відносини
    component = relationship("RecipeComponent", back_populates="ingredients")


class Product(Base):
    """
    Продукт для закупки (словник продуктів).
    """
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False, unique=True, index=True)
    category = Column(String(100), nullable=True, index=True)  # РИБНИЙ, М'ЯСНИЙ, ОВОЧІ, etc.
    subcategory = Column(String(100), nullable=True)  # РИБА, КУРЯТИНА, etc.
    unit = Column(String(50), default="г")  # Одиниця виміру
    
    created_at = Column(DateTime, default=datetime.utcnow)


class Checklist(Base):
    """
    Чекліст для боксів або кейтерингу.
    Використовується відділом продажів для збору інформації перед формуванням КП.
    """
    __tablename__ = "checklists"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Тип чекліста: 'box' або 'catering'
    checklist_type = Column(String(20), nullable=False, index=True)
    
    # Зв'язок з клієнтом та КП
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=True, index=True)
    kp_id = Column(Integer, ForeignKey("kps.id"), nullable=True, index=True)
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # 1. Дата заходу
    event_date = Column(Date, nullable=True)
    
    # 2. Контакт
    contact_name = Column(String(200), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    contact_email = Column(String(200), nullable=True)
    
    # 3. Формат заходу (фуршет, кава-пауза, бокси...)
    event_format = Column(String(200), nullable=True)
    
    # 4. Привід/причина святкування
    event_reason = Column(String(300), nullable=True)  # корпоратив, день народження, весілля і тд
    
    # 5. Номер замовлення (для боксів)
    order_number = Column(String(100), nullable=True)
    
    # 6. Час доставки / Час початку заходу
    delivery_time = Column(String(100), nullable=True)
    
    # 7. Тривалість заходу
    event_duration = Column(String(100), nullable=True)
    
    # 8. Чи потрібен кур'єр/інший персонал (для боксів)
    needs_courier = Column(Boolean, default=False)
    personnel_notes = Column(Text, nullable=True)
    
    # 9. Локація
    location_address = Column(String(500), nullable=True)
    location_floor = Column(String(50), nullable=True)
    location_elevator = Column(Boolean, default=False)
    
    # 10. К-кість гостей
    guest_count = Column(Integer, nullable=True)
    
    # 11. Бюджет
    budget = Column(String(200), nullable=True)
    budget_amount = Column(Numeric(10, 2), nullable=True)
    
    # 12. Обладнання (тільки для кейтерингу)
    equipment_furniture = Column(Boolean, default=False)  # меблі
    equipment_tablecloths = Column(Boolean, default=False)  # скатертини
    equipment_disposable_dishes = Column(Boolean, default=False)  # посуд одноразовий
    equipment_glass_dishes = Column(Boolean, default=False)  # скло
    equipment_notes = Column(Text, nullable=True)
    
    # 13. Побажання клієнта/менеджера щодо страв
    food_hot = Column(Boolean, default=False)  # гарячі
    food_cold = Column(Boolean, default=False)  # холодні
    food_salads = Column(Boolean, default=False)  # салати
    food_garnish = Column(Boolean, default=False)  # гарнір
    food_sweet = Column(Boolean, default=False)  # солодке
    food_vegetarian = Column(Boolean, default=False)  # вегетаріанці
    food_vegan = Column(Boolean, default=False)  # вегани
    food_preference = Column(String(100), nullable=True)  # більше м'ясного чи рибного
    food_notes = Column(Text, nullable=True)  # інші побажання
    
    # 14. Загальний коментар
    general_comment = Column(Text, nullable=True)
    
    # 15. Напої та алкоголь
    drinks_notes = Column(Text, nullable=True)
    alcohol_notes = Column(Text, nullable=True)
    
    # 16. Знижка та націнка
    discount_notes = Column(Text, nullable=True)
    surcharge_notes = Column(Text, nullable=True)
    
    # Статус чекліста
    status = Column(String(50), default="draft", index=True)  # draft, in_progress, completed, sent_to_kp
    
    # Метадані
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Зв'язки
    client = relationship("Client", backref="checklists")
    kp = relationship("KP", backref="checklists")
    manager = relationship("User", foreign_keys=[manager_id])