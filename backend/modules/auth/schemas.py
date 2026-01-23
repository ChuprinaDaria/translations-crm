from uuid import UUID
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int  # Змінено з UUID на int, оскільки модель User використовує Integer
    email: EmailStr
    is_active: bool
    
    class Config:
        from_attributes = True

