"""
Pydantic schemas для нотифікацій
"""
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class NotificationBase(BaseModel):
    """Базова схема нотифікації"""
    type: str
    title: str
    message: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    action_url: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class NotificationCreate(NotificationBase):
    """Схема для створення нотифікації"""
    user_id: UUID


class NotificationResponse(NotificationBase):
    """Схема відповіді з нотифікацією"""
    id: UUID
    user_id: UUID
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class NotificationSettingsUpdate(BaseModel):
    """Схема для оновлення налаштувань"""
    enabled: Optional[bool] = None
    sound: Optional[bool] = None
    desktop: Optional[bool] = None
    vibration: Optional[bool] = None
    types_enabled: Optional[Dict[str, bool]] = None
    do_not_disturb: Optional[Dict[str, Any]] = None


class NotificationSettingsResponse(BaseModel):
    """Схема відповіді з налаштуваннями"""
    id: UUID
    user_id: UUID
    enabled: bool
    sound: bool
    desktop: bool
    vibration: bool
    types_enabled: Dict[str, bool]
    do_not_disturb: Dict[str, Any]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

