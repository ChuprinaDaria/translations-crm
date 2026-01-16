from uuid import UUID
from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, model_serializer, field_serializer
from modules.crm.models import (
    OrderStatus, ClientSource, EntityType, TimelineStepType,
    TranslatorStatus, TranslationRequestStatus
)


class ClientCreate(BaseModel):
    full_name: str = Field(..., min_length=1)
    email: Optional[EmailStr] = None
    phone: str = Field(..., min_length=1)
    source: Optional[ClientSource] = ClientSource.MANUAL


class ClientRead(BaseModel):
    id: UUID
    full_name: str
    email: Optional[str] = None
    phone: str
    source: ClientSource
    created_at: datetime
    orders: list["OrderRead"] = []
    
    class Config:
        from_attributes = True


# Simplified client schema without orders to avoid recursion
class ClientReadSimple(BaseModel):
    id: UUID
    full_name: str
    email: Optional[str] = None
    phone: str
    source: ClientSource
    created_at: datetime
    
    class Config:
        from_attributes = True


# Office Schemas - must be defined before OrderRead
class OfficeCreate(BaseModel):
    name: str
    address: str
    city: str
    postal_code: str
    phone: str
    email: str
    working_hours: str
    is_active: bool = True
    is_default: bool = False


class OfficeUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    working_hours: Optional[str] = None
    is_active: Optional[bool] = None
    is_default: Optional[bool] = None


class OfficeRead(BaseModel):
    id: int
    name: str
    address: str
    city: str
    postal_code: str
    phone: str
    email: str
    working_hours: str
    is_active: bool
    is_default: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    client_id: UUID
    manager_id: UUID
    order_number: str
    description: Optional[str] = None
    status: Optional[OrderStatus] = OrderStatus.DO_WYKONANIA
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None
    office_id: Optional[int] = None


class OrderUpdate(BaseModel):
    client_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    order_number: Optional[str] = None
    description: Optional[str] = None
    status: Optional[OrderStatus] = None
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None


class OrderRead(BaseModel):
    id: UUID
    client_id: UUID
    manager_id: UUID
    order_number: str
    description: Optional[str] = None
    status: OrderStatus
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None
    office_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    client: Optional["ClientReadSimple"] = None  # Use simple version to avoid recursion
    office: Optional["OfficeRead"] = None
    timeline_steps: list["TimelineStepRead"] = []
    
    class Config:
        from_attributes = True


# Translator Schemas
class TranslatorLanguageCreate(BaseModel):
    language: str
    rate_per_page: float
    specializations: Optional[List[str]] = None
    
    @model_validator(mode='before')
    @classmethod
    def parse_specializations(cls, data: any):
        """Parse specializations from JSON string if needed"""
        import json
        
        if isinstance(data, dict) and 'specializations' in data:
            specializations = data.get('specializations')
            # Якщо це рядок, спробуємо розпарсити як JSON
            if isinstance(specializations, str):
                try:
                    parsed = json.loads(specializations)
                    # Переконуємося, що це список
                    if isinstance(parsed, list):
                        data['specializations'] = parsed
                    else:
                        data['specializations'] = []
                except (json.JSONDecodeError, TypeError, ValueError):
                    # Якщо не вдалося розпарсити, спробуємо як простий рядок
                    data['specializations'] = [specializations] if specializations else []
            # Якщо це вже список, залишаємо як є
            elif not isinstance(specializations, list) and specializations is not None:
                data['specializations'] = []
        
        return data


class TranslatorLanguageRead(BaseModel):
    id: int
    translator_id: int
    language: str
    rate_per_page: float
    specializations: Optional[List[str]] = None
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='before')
    @classmethod
    def parse_specializations_from_db(cls, data: any):
        """Parse specializations from JSON string when reading from database"""
        import json
        
        if isinstance(data, dict) and 'specializations' in data:
            specializations = data.get('specializations')
            if isinstance(specializations, str):
                try:
                    parsed = json.loads(specializations)
                    if isinstance(parsed, list):
                        data['specializations'] = parsed
                    else:
                        data['specializations'] = []
                except (json.JSONDecodeError, TypeError, ValueError):
                    data['specializations'] = []
        elif hasattr(data, 'specializations'):
            # For ORM objects
            specializations = getattr(data, 'specializations', None)
            if isinstance(specializations, str):
                try:
                    parsed = json.loads(specializations)
                    if isinstance(parsed, list):
                        data.specializations = parsed
                    else:
                        data.specializations = None
                except (json.JSONDecodeError, TypeError, ValueError):
                    data.specializations = None
        
        return data
    
    @classmethod
    def from_orm_with_specializations(cls, obj):
        """Parse specializations from JSON string if needed"""
        import json
        data = cls.from_orm(obj).dict()
        if isinstance(data.get('specializations'), str):
            try:
                data['specializations'] = json.loads(data['specializations'])
            except:
                data['specializations'] = []
        return cls(**data)


class TranslatorCreate(BaseModel):
    name: str
    email: EmailStr
    phone: str
    telegram_id: Optional[str] = None
    whatsapp: Optional[str] = None
    status: Optional[TranslatorStatus] = TranslatorStatus.ACTIVE
    languages: List[TranslatorLanguageCreate]


class TranslatorUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    telegram_id: Optional[str] = None
    whatsapp: Optional[str] = None
    status: Optional[TranslatorStatus] = None
    languages: Optional[List[TranslatorLanguageCreate]] = None


class TranslatorRead(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    telegram_id: Optional[str] = None
    whatsapp: Optional[str] = None
    status: TranslatorStatus
    rating: float
    completed_orders: int
    created_at: datetime
    updated_at: datetime
    languages: List[TranslatorLanguageRead] = []
    
    class Config:
        from_attributes = True


# Translation Request Schemas
class TranslationRequestCreate(BaseModel):
    order_id: UUID
    translator_id: int
    sent_via: str  # "email" | "telegram" | "whatsapp"
    offered_rate: float
    notes: Optional[str] = None


class TranslationRequestUpdate(BaseModel):
    status: Optional[TranslationRequestStatus] = None
    notes: Optional[str] = None


class TranslationRequestRead(BaseModel):
    id: int
    order_id: UUID
    translator_id: int
    sent_via: str
    sent_at: datetime
    status: TranslationRequestStatus
    response_at: Optional[datetime] = None
    offered_rate: float
    notes: Optional[str] = None
    created_at: datetime
    translator: Optional[TranslatorRead] = None
    
    class Config:
        from_attributes = True


# Timeline Schemas
class TimelineStepRead(BaseModel):
    id: int
    order_id: UUID
    step_type: TimelineStepType
    completed: bool
    completed_at: datetime
    completed_by_id: Optional[UUID] = None
    metadata: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
    
    @model_validator(mode='before')
    @classmethod
    def map_step_metadata(cls, data: Any):
        """Map step_metadata from model to metadata in response"""
        # Для ORM об'єктів (SQLAlchemy models) - конвертуємо в словник
        if hasattr(data, '__table__') or (hasattr(data, 'step_metadata') and not isinstance(data, dict)):
            # Отримуємо значення step_metadata напряму з __dict__ (уникаємо конфлікту з SQLAlchemy MetaData)
            step_metadata_value = None
            if hasattr(data, '__dict__'):
                step_metadata_value = data.__dict__.get('step_metadata', None)
            
            # Якщо metadata вже встановлено в router, використовуємо його
            if hasattr(data, 'metadata'):
                metadata_attr = getattr(data, 'metadata', None)
                # Перевіряємо, що це не SQLAlchemy MetaData об'єкт
                if isinstance(metadata_attr, str):
                    step_metadata_value = metadata_attr
                elif metadata_attr is not None and not hasattr(metadata_attr, 'tables'):
                    # Якщо це не MetaData об'єкт, але і не рядок - ігноруємо
                    pass
            
            # Конвертуємо ORM об'єкт в словник з правильним маппінгом
            result = {
                'id': getattr(data, 'id', None),
                'order_id': getattr(data, 'order_id', None),
                'step_type': getattr(data, 'step_type', None),
                'completed': getattr(data, 'completed', None),
                'completed_at': getattr(data, 'completed_at', None),
                'completed_by_id': getattr(data, 'completed_by_id', None),
                'metadata': step_metadata_value if isinstance(step_metadata_value, (str, type(None))) else None,
                'created_at': getattr(data, 'created_at', None),
            }
            return result
        # Для словників
        elif isinstance(data, dict):
            if 'step_metadata' in data and 'metadata' not in data:
                data['metadata'] = data.get('step_metadata')
            # Якщо metadata вже є, але це не рядок - конвертуємо
            if 'metadata' in data and not isinstance(data['metadata'], (str, type(None))):
                data['metadata'] = None
        
        return data


class TimelineStepCreate(BaseModel):
    order_id: UUID
    step_type: TimelineStepType
    completed_by_id: Optional[UUID] = None
    metadata: Optional[str] = None


# Internal Notes Schemas
class InternalNoteCreate(BaseModel):
    entity_type: EntityType
    entity_id: str
    text: str


class InternalNoteRead(BaseModel):
    id: int
    entity_type: EntityType
    entity_id: str
    author_id: UUID
    author_name: str
    text: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# Rebuild models to resolve forward references
ClientRead.model_rebuild()
ClientReadSimple.model_rebuild()
OrderRead.model_rebuild()
