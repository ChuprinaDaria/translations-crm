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

class TOTPVerify(BaseModel):
    email: EmailStr
    password: str
    code: str

class KPBase(BaseModel):
    title: str
    people_count: int


class KPItemCreate(BaseModel):
    item_id: int
    quantity: int

class KPCreate(KPBase):
    total_price: Optional[float] = None
    price_per_person: Optional[float] = None
    items: list[KPItemCreate] = []

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
    
    class Config:
        from_attributes = True
