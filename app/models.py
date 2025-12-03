# DB Models

from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from db import Base


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
    weight = Column(Float, index=True)
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
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

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
    # sent      – відправлено клієнту
    # approved  – затверджено клієнтом
    # rejected  – відхилено клієнтом
    # completed – виконано (подія відбулася)
    status = Column(String, default="sent", index=True)
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    client_email = Column(String, nullable=True, index=True)  # Email клієнта
    client_phone = Column(String, nullable=True, index=True)  # Телефон клієнта (Telegram / Viber etc.)
    # Підсумки за додатковими блоками
    equipment_total = Column(Float, nullable=True)
    service_total = Column(Float, nullable=True)
    transport_total = Column(Float, nullable=True)
    # Орієнтовний вихід (сума ваги)
    total_weight = Column(Float, nullable=True)  # Загальна вага в грамах
    weight_per_person = Column(Float, nullable=True)  # Вага на 1 гостя в грамах

    items = relationship("KPItem", back_populates="kp", lazy="selectin", cascade='all, delete-orphan')
    template = relationship("Template", back_populates="kps")


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
    item_id = Column(Integer, ForeignKey("items.id"))
    quantity = Column(Integer, default=1)

    kp = relationship("KP", back_populates="items")
    item = relationship("Item", back_populates="kp_items", lazy="joined")


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
    """
    Клієнт, зведені дані по заходу та оплаті.
    Частково автоматично підтягується з КП, частково редагується вручну.
    """

    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    phone = Column(String, nullable=True, index=True)
    email = Column(String, nullable=True, index=True)

    status = Column(String, default="новий", index=True)  # новий / в роботі / закритий тощо

    # Дані останнього (актуального) заходу
    event_date = Column(DateTime(timezone=True), nullable=True)
    event_format = Column(String, nullable=True)
    event_group = Column(String, nullable=True)
    event_time = Column(String, nullable=True)
    event_location = Column(String, nullable=True)
    comments = Column(String, nullable=True)

    # Фінансові дані по останньому КП
    kp_total_amount = Column(Float, nullable=True)
    paid_amount = Column(Float, nullable=True)
    unpaid_amount = Column(Float, nullable=True)
    payment_format = Column(String, nullable=True)  # ФОП / юрособа / інше
    cash_collector = Column(String, nullable=True)  # Хто забирав готівку
    payment_plan_date = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())