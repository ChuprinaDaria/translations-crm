"""
Notification Service - сервіс для створення та відправки нотифікацій
"""
from uuid import UUID
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload

from modules.notifications.models import Notification, NotificationSettings, NotificationType, EntityType
from modules.notifications.websocket_manager import manager
import logging

logger = logging.getLogger(__name__)


class NotificationService:
    """Сервіс для роботи з нотифікаціями"""
    
    @staticmethod
    async def create_notification(
        db: AsyncSession,
        user_id: UUID,
        notification_type: NotificationType,
        title: str,
        message: str,
        entity_type: Optional[EntityType] = None,
        entity_id: Optional[str] = None,
        action_url: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Notification:
        """Створити нотифікацію"""
        # Перевірити налаштування користувача
        settings = await NotificationService.get_user_settings(db, user_id)
        
        if not settings or not settings.enabled:
            logger.debug(f"Notifications disabled for user {user_id}")
            return None
        
        # Перевірити чи увімкнений цей тип нотифікації
        types_enabled = settings.types_enabled or {}
        if not types_enabled.get(notification_type.value, True):
            logger.debug(f"Notification type {notification_type.value} disabled for user {user_id}")
            return None
        
        # Перевірити Do Not Disturb
        if await NotificationService._is_do_not_disturb(settings):
            logger.debug(f"User {user_id} is in Do Not Disturb mode")
            return None
        
        # Створити нотифікацію
        notification = Notification(
            user_id=user_id,
            type=notification_type.value,
            title=title,
            message=message,
            entity_type=entity_type.value if entity_type else None,
            entity_id=entity_id,
            action_url=action_url,
            data=data,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        
        db.add(notification)
        await db.commit()
        await db.refresh(notification)
        
        # Відправити через WebSocket якщо користувач підключений
        await NotificationService._send_websocket_notification(user_id, notification)
        
        return notification
    
    @staticmethod
    async def _send_websocket_notification(user_id: UUID, notification: Notification):
        """Відправити нотифікацію через WebSocket"""
        notification_data = {
            "type": "notification",
            "data": {
                "id": str(notification.id),
                "type": notification.type,
                "title": notification.title,
                "message": notification.message,
                "entity_type": notification.entity_type,
                "entity_id": notification.entity_id,
                "action_url": notification.action_url,
                "data": notification.data,
                "created_at": notification.created_at.isoformat() if notification.created_at else None,
            }
        }
        
        await manager.send_notification(user_id, notification_data)
    
    @staticmethod
    async def get_user_settings(db: AsyncSession, user_id: UUID) -> Optional[NotificationSettings]:
        """Отримати налаштування нотифікацій користувача"""
        result = await db.execute(
            select(NotificationSettings).where(NotificationSettings.user_id == user_id)
        )
        settings = result.scalar_one_or_none()
        
        # Якщо налаштувань немає, створити за замовчуванням
        if not settings:
            settings = NotificationSettings(user_id=user_id)
            db.add(settings)
            await db.commit()
            await db.refresh(settings)
        
        return settings
    
    @staticmethod
    async def _is_do_not_disturb(settings: NotificationSettings) -> bool:
        """Перевірити чи активний режим Do Not Disturb"""
        if not settings.do_not_disturb:
            return False
        
        now = datetime.utcnow()
        current_time = now.time()
        weekday = now.weekday()  # 0 = Monday, 6 = Sunday
        
        dnd = settings.do_not_disturb
        
        # Вихідні (субота, неділя)
        if weekday >= 5:  # Saturday or Sunday
            if dnd.get("weekend") == "all_day":
                return True
        
        # Будні дні
        if weekday < 5:
            weekdays = dnd.get("weekdays")
            if weekdays and len(weekdays) == 2:
                try:
                    start_time = datetime.strptime(weekdays[0], "%H:%M").time()
                    end_time = datetime.strptime(weekdays[1], "%H:%M").time()
                    
                    # Перевірити чи поточний час в межах DND
                    if start_time <= end_time:
                        # Звичайний інтервал (наприклад, 22:00 - 08:00)
                        if start_time <= current_time <= end_time:
                            return True
                    else:
                        # Нічний інтервал (наприклад, 22:00 - 08:00)
                        if current_time >= start_time or current_time <= end_time:
                            return True
                except ValueError:
                    logger.warning(f"Invalid DND time format: {weekdays}")
        
        return False
    
    @staticmethod
    async def mark_as_read(db: AsyncSession, notification_id: UUID, user_id: UUID) -> bool:
        """Позначити нотифікацію як прочитану"""
        result = await db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True, read_at=datetime.utcnow())
        )
        await db.commit()
        return result.rowcount > 0
    
    @staticmethod
    async def mark_all_as_read(db: AsyncSession, user_id: UUID) -> int:
        """Позначити всі нотифікації користувача як прочитані"""
        result = await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True, read_at=datetime.utcnow())
        )
        await db.commit()
        return result.rowcount
    
    @staticmethod
    async def get_user_notifications(
        db: AsyncSession,
        user_id: UUID,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
    ) -> list[Notification]:
        """Отримати нотифікації користувача"""
        query = select(Notification).where(Notification.user_id == user_id)
        
        if unread_only:
            query = query.where(Notification.is_read == False)
        
        query = query.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        
        result = await db.execute(query)
        return list(result.scalars().all())
    
    @staticmethod
    async def get_unread_count(db: AsyncSession, user_id: UUID) -> int:
        """Отримати кількість непрочитаних нотифікацій"""
        from sqlalchemy import func
        result = await db.execute(
            select(func.count(Notification.id))
            .where(Notification.user_id == user_id, Notification.is_read == False)
        )
        return result.scalar() or 0
    
    @staticmethod
    async def delete_expired(db: AsyncSession) -> int:
        """Видалити застарілі нотифікації (старше 30 днів)"""
        result = await db.execute(
            delete(Notification).where(Notification.expires_at < datetime.utcnow())
        )
        await db.commit()
        return result.rowcount

