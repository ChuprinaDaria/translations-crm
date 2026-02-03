"""
AI Integration Schemas - Pydantic models for API
"""
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List


class AISettingsBase(BaseModel):
    """Базова схема налаштувань AI"""
    rag_api_url: str = Field(
        default="https://api.adme-ai.com/v1",
        description="URL RAG API сервісу"
    )
    rag_api_key: Optional[str] = Field(
        default="",
        description="API ключ для RAG сервісу"
    )
    rag_token: Optional[str] = Field(
        default="adme_rag_secret_987654321",
        description="Токен для авторизації вхідних запитів від RAG (X-RAG-TOKEN)"
    )
    is_enabled: bool = Field(
        default=False,
        description="Чи увімкнено AI інтеграцію"
    )
    trigger_delay_seconds: int = Field(
        default=10,
        ge=0,
        le=300,
        description="Затримка в секундах перед відправкою запиту до AI (щоб дозволити менеджеру втрутитися)"
    )
    active_channels: List[str] = Field(
        default_factory=list,
        description="Активні канали для AI (telegram, whatsapp, email, instagram, facebook)"
    )
    
    @field_validator('rag_api_key', 'rag_token', mode='before')
    @classmethod
    def validate_optional_strings(cls, v):
        """Обробка optional полів - залишаємо як є (може бути порожній рядок або None)"""
        return v
    
    @field_validator('active_channels', mode='before')
    @classmethod
    def validate_channels(cls, v):
        """Валідація каналів"""
        valid_channels = ['telegram', 'whatsapp', 'email', 'instagram', 'facebook']
        if v is None:
            return []
        if not isinstance(v, list):
            return []
        return [ch for ch in v if ch in valid_channels]
    
    @field_validator('rag_api_url')
    @classmethod
    def validate_url(cls, v):
        """Валідація URL"""
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL повинен починатися з http:// або https://')
        return v


class AISettingsCreate(AISettingsBase):
    """Схема для створення налаштувань AI"""
    pass


class AISettingsUpdate(BaseModel):
    """Схема для оновлення налаштувань AI"""
    rag_api_url: Optional[str] = None
    rag_api_key: Optional[str] = None
    rag_token: Optional[str] = None
    is_enabled: Optional[bool] = None
    trigger_delay_seconds: Optional[int] = Field(None, ge=0, le=300)
    active_channels: Optional[List[str]] = None
    
    @field_validator('active_channels', mode='before')
    @classmethod
    def validate_channels(cls, v):
        """Валідація каналів"""
        if v is None:
            return None
        valid_channels = ['telegram', 'whatsapp', 'email', 'instagram', 'facebook']
        if not isinstance(v, list):
            return None
        return [ch for ch in v if ch in valid_channels]
    
    @field_validator('rag_api_url', mode='before')
    @classmethod
    def validate_url(cls, v):
        """Валідація URL"""
        if v is None:
            return None
        if not v.startswith(('http://', 'https://')):
            raise ValueError('URL повинен починатися з http:// або https://')
        return v


class AISettingsResponse(AISettingsBase):
    """Схема відповіді з налаштуваннями AI"""
    id: int
    webhook_secret: str
    created_at: str
    updated_at: str
    
    @field_validator('created_at', 'updated_at', mode='before')
    @classmethod
    def convert_datetime_to_string(cls, v):
        """Конвертує datetime в ISO string"""
        if isinstance(v, datetime):
            return v.isoformat()
        return v
    
    class Config:
        from_attributes = True


class RAGMessageRequest(BaseModel):
    """Запит до RAG API"""
    message: str = Field(..., description="Текст повідомлення від клієнта")
    conversation_id: str = Field(..., description="ID діалогу")
    platform: str = Field(..., description="Платформа (telegram, whatsapp, email, etc.)")
    context: Optional[dict] = Field(None, description="Додатковий контекст")


class RAGMessageResponse(BaseModel):
    """Відповідь від RAG API"""
    reply: str = Field(..., description="Відповідь від AI")
    confidence: Optional[float] = Field(None, ge=0, le=1, description="Рівень впевненості")
    metadata: Optional[dict] = Field(None, description="Додаткові метадані")

