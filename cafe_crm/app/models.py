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
    role = Column(String, default='user')

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
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    client_email = Column(String, nullable=True, index=True)  # Email клієнта

    items = relationship("KPItem", back_populates="kp", lazy="selectin", cascade='all, delete-orphan')
    template = relationship("Template", back_populates="kps")



class KPItem(Base):
    __tablename__ = "kp_items"

    id = Column(Integer, primary_key=True, index=True)
    kp_id = Column(Integer, ForeignKey("kps.id"))
    item_id = Column(Integer, ForeignKey("items.id"))
    quantity = Column(Integer, default=1)

    kp = relationship("KP", back_populates="items")
    item = relationship("Item", back_populates="kp_items", lazy="joined")