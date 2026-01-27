from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import pytz

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
from modules.auth import models as auth_models
from .service import AutobotService
from .schemas import (
    AutobotSettingsResponse,
    AutobotSettingsCreate,
    AutobotSettingsUpdate,
    HolidayCreate,
    HolidayResponse,
    AutobotStatusResponse,
    WorkingHours
)
from .models import AutobotSettings

router = APIRouter(prefix="/autobot", tags=["autobot"])


@router.get("/settings/{office_id}", response_model=AutobotSettingsResponse)
def get_autobot_settings(
    office_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Отримати налаштування автобота"""
    service = AutobotService(db)
    settings = service.get_settings(office_id)
    
    if not settings:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Autobot settings not found"
        )
    
    # Конвертуємо в response формат
    return _settings_to_response(settings)


@router.post("/settings", response_model=AutobotSettingsResponse)
def create_autobot_settings(
    settings: AutobotSettingsCreate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Створити налаштування автобота"""
    service = AutobotService(db)
    
    # Перевірити чи не існують вже налаштування
    existing = service.get_settings(settings.office_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Settings already exist for this office"
        )
    
    created = service.create_settings(settings)
    return _settings_to_response(created)


@router.patch("/settings/{office_id}", response_model=AutobotSettingsResponse)
def update_autobot_settings(
    office_id: int,
    settings: AutobotSettingsUpdate,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Оновити налаштування автобота"""
    service = AutobotService(db)
    updated = service.update_settings(office_id, settings)
    
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Settings not found"
        )
    
    return _settings_to_response(updated)


@router.get("/status/{office_id}", response_model=AutobotStatusResponse)
def get_autobot_status(
    office_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Отримати поточний статус бота"""
    service = AutobotService(db)
    is_working, reason = service.is_working_hours(office_id)
    
    now = datetime.now(pytz.timezone('Europe/Warsaw'))
    
    return AutobotStatusResponse(
        is_working_hours=is_working,
        current_time=now.strftime("%H:%M:%S"),
        next_working_period=None,  # TODO: Розрахувати наступний робочий період
        message=reason
    )


@router.post("/holidays", response_model=HolidayResponse)
def add_holiday(
    holiday: HolidayCreate,
    settings_id: int = Query(..., description="ID налаштувань автобота"),
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Додати свято"""
    service = AutobotService(db)
    created = service.add_holiday(settings_id, holiday)
    
    return HolidayResponse(
        id=created.id,
        settings_id=created.settings_id,
        date=created.date,
        name=created.name,
        is_recurring=created.is_recurring,
        created_at=created.created_at.isoformat()
    )


@router.delete("/holidays/{holiday_id}")
def delete_holiday(
    holiday_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Видалити свято"""
    service = AutobotService(db)
    success = service.remove_holiday(holiday_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Holiday not found"
        )
    
    return {"success": True}


@router.get("/holidays/{settings_id}", response_model=List[HolidayResponse])
def get_holidays(
    settings_id: int,
    db: Session = Depends(get_db),
    user: auth_models.User = Depends(get_current_user_db)
):
    """Отримати всі свята"""
    service = AutobotService(db)
    holidays = service.get_holidays(settings_id)
    
    return [
        HolidayResponse(
            id=h.id,
            settings_id=h.settings_id,
            date=h.date,
            name=h.name,
            is_recurring=h.is_recurring,
            created_at=h.created_at.isoformat()
        )
        for h in holidays
    ]


def _settings_to_response(settings: AutobotSettings) -> AutobotSettingsResponse:
    """Конвертувати модель налаштувань в response"""
    def make_working_hours(start, end):
        if start and end:
            return WorkingHours(start=start, end=end, is_working_day=True)
        return None
    
    return AutobotSettingsResponse(
        id=settings.id,
        office_id=settings.office_id,
        enabled=settings.enabled,
        monday=make_working_hours(settings.monday_start, settings.monday_end),
        tuesday=make_working_hours(settings.tuesday_start, settings.tuesday_end),
        wednesday=make_working_hours(settings.wednesday_start, settings.wednesday_end),
        thursday=make_working_hours(settings.thursday_start, settings.thursday_end),
        friday=make_working_hours(settings.friday_start, settings.friday_end),
        saturday=make_working_hours(settings.saturday_start, settings.saturday_end),
        sunday=make_working_hours(settings.sunday_start, settings.sunday_end),
        auto_reply_message=settings.auto_reply_message,
        auto_create_client=settings.auto_create_client,
        auto_create_order=settings.auto_create_order,
        auto_save_files=settings.auto_save_files,
        created_at=settings.created_at.isoformat(),
        updated_at=settings.updated_at.isoformat()
    )

