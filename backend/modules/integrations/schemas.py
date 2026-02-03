"""
Integrations Schemas - Pydantic models for external API integrations
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from uuid import UUID


class LeadData(BaseModel):
    """Schema for incoming lead data from RAG"""
    name: Optional[str] = Field(None, description="Ім'я клієнта")
    full_name: Optional[str] = Field(None, description="Повне ім'я клієнта")
    email: Optional[EmailStr] = Field(None, description="Email клієнта")
    phone: Optional[str] = Field(None, description="Телефон клієнта")
    company_name: Optional[str] = Field(None, description="Назва компанії")
    message: Optional[str] = Field(None, description="Повідомлення від клієнта")
    source: Optional[str] = Field(None, description="Джерело ліда")
    conversation_id: Optional[str] = Field(None, description="ID діалогу, якщо є (може бути UUID або string)")
    platform: Optional[str] = Field(None, description="Платформа (telegram, whatsapp, email, etc.)")
    external_id: Optional[str] = Field(None, description="Зовнішній ID (Telegram username/phone/chat_id)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Іван Петренко",
                "email": "ivan@example.com",
                "phone": "+380501234567",
                "company_name": "ТОВ Приклад",
                "message": "Потрібен переклад документів",
                "source": "rag",
                "platform": "telegram",
                "external_id": "+380501234567"
            }
        }


class LeadResponse(BaseModel):
    """Response schema for lead creation"""
    status: str = Field(..., description="Статус операції")
    source: str = Field(..., description="Джерело верифікації")
    client_id: Optional[UUID] = Field(None, description="ID створеного клієнта")
    message: Optional[str] = Field(None, description="Додаткове повідомлення")

