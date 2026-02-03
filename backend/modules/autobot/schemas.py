from pydantic import BaseModel, Field
from datetime import time, date
from typing import Optional, List
from uuid import UUID


class WorkingHours(BaseModel):
    """Робочі години для одного дня"""
    start: Optional[time] = None
    end: Optional[time] = None
    is_working_day: bool = True


class AutobotSettingsBase(BaseModel):
    enabled: bool = True
    
    # Робочі години для кожного дня
    monday: Optional[WorkingHours] = None
    tuesday: Optional[WorkingHours] = None
    wednesday: Optional[WorkingHours] = None
    thursday: Optional[WorkingHours] = None
    friday: Optional[WorkingHours] = None
    saturday: Optional[WorkingHours] = None
    sunday: Optional[WorkingHours] = None
    
    # Повідомлення
    auto_reply_message: str = Field(..., min_length=10, max_length=2000)
    
    # Налаштування
    auto_create_client: bool = True
    auto_create_order: bool = True
    auto_save_files: bool = True
    
    # AI відповіді
    use_ai_reply: bool = False


class AutobotSettingsCreate(AutobotSettingsBase):
    office_id: int


class AutobotSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    monday: Optional[WorkingHours] = None
    tuesday: Optional[WorkingHours] = None
    wednesday: Optional[WorkingHours] = None
    thursday: Optional[WorkingHours] = None
    friday: Optional[WorkingHours] = None
    saturday: Optional[WorkingHours] = None
    sunday: Optional[WorkingHours] = None
    auto_reply_message: Optional[str] = Field(None, min_length=10, max_length=2000)
    auto_create_client: Optional[bool] = None
    auto_create_order: Optional[bool] = None
    auto_save_files: Optional[bool] = None
    use_ai_reply: Optional[bool] = None


class AutobotSettingsResponse(AutobotSettingsBase):
    id: int
    office_id: int
    created_at: str
    updated_at: str
    
    class Config:
        from_attributes = True


class HolidayBase(BaseModel):
    date: date
    name: str = Field(..., min_length=1, max_length=255)
    is_recurring: bool = False


class HolidayCreate(HolidayBase):
    pass


class HolidayResponse(HolidayBase):
    id: int
    settings_id: int
    created_at: str
    
    class Config:
        from_attributes = True


class AutobotStatusResponse(BaseModel):
    """Поточний статус бота"""
    is_working_hours: bool
    current_time: str
    next_working_period: Optional[str] = None
    message: str

