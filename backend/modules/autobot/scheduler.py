"""
Scheduler для перевірки робочих годин та автоматичної обробки повідомлень.
Цей модуль може бути використаний для періодичної перевірки або інтеграції з системою черг.
"""
from datetime import datetime
from typing import Optional
import pytz

from .service import AutobotService
from ..communications.models import Message


def check_working_hours(office_id: int, db) -> tuple[bool, str]:
    """
    Перевірити чи зараз робочі години для офісу.
    
    Args:
        office_id: ID офісу
        db: Database session
    
    Returns:
        Tuple[bool, str]: (чи робочі години, причина)
    """
    service = AutobotService(db)
    return service.is_working_hours(office_id)


async def process_message_if_off_hours(
    office_id: int,
    message: Message,
    sender_info: dict,
    db
) -> dict:
    """
    Обробити повідомлення якщо зараз неробочий час.
    
    Args:
        office_id: ID офісу
        message: Об'єкт повідомлення
        sender_info: Інформація про відправника
        db: Database session
    
    Returns:
        dict: Результат обробки
    """
    service = AutobotService(db)
    return await service.process_incoming_message(office_id, message, sender_info)

