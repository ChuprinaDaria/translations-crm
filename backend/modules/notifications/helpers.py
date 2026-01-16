"""
Helper functions для створення нотифікацій з інших модулів
"""
from uuid import UUID
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from modules.notifications.service import NotificationService
from modules.notifications.models import NotificationType, EntityType


async def notify_new_message(
    db: AsyncSession,
    user_id: UUID,
    client_name: str,
    channel: str,
    message_preview: str,
    conversation_id: str,
):
    """Створити нотифікацію про нове повідомлення"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.NEW_MESSAGE,
        title="💬 Нове повідомлення",
        message=f"{client_name} - {channel}",
        entity_type=EntityType.CHAT,
        entity_id=conversation_id,
        action_url=f"/inbox/{conversation_id}",
        data={
            "client_name": client_name,
            "channel": channel,
            "message_preview": message_preview,
        },
    )


async def notify_payment_received(
    db: AsyncSession,
    user_id: UUID,
    order_number: str,
    client_name: str,
    amount: float,
    currency: str,
    payment_method: str,
    order_id: str,
):
    """Створити нотифікацію про отриману оплату"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.PAYMENT_RECEIVED,
        title="💰 Оплату отримано!",
        message=f"Замовлення: {order_number}\nКлієнт: {client_name}\nСума: {amount} {currency}\nМетод: {payment_method}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "order_number": order_number,
            "client_name": client_name,
            "amount": amount,
            "currency": currency,
            "payment_method": payment_method,
        },
    )


async def notify_translator_accepted(
    db: AsyncSession,
    user_id: UUID,
    translator_name: str,
    order_number: str,
    deadline: str,
    order_id: str,
):
    """Створити нотифікацію про прийняття замовлення перекладачем"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.TRANSLATOR_ACCEPTED,
        title="✅ Перекладач прийняв замовлення",
        message=f"Замовлення: {order_number}\nПерекладач: {translator_name}\nДедлайн: {deadline}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "translator_name": translator_name,
            "order_number": order_number,
            "deadline": deadline,
        },
    )


async def notify_translator_rejected(
    db: AsyncSession,
    user_id: UUID,
    translator_name: str,
    order_number: str,
    reason: str,
    order_id: str,
):
    """Створити нотифікацію про відхилення замовлення перекладачем"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.TRANSLATOR_REJECTED,
        title="❌ Перекладач відхилив замовлення",
        message=f"Замовлення: {order_number}\nПерекладач: {translator_name}\nПричина: {reason}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "translator_name": translator_name,
            "order_number": order_number,
            "reason": reason,
        },
    )


async def notify_translation_ready(
    db: AsyncSession,
    user_id: UUID,
    translator_name: str,
    order_number: str,
    order_id: str,
):
    """Створити нотифікацію про готовий переклад"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.TRANSLATION_READY,
        title="✅ Переклад завершено",
        message=f"Замовлення: {order_number}\nПерекладач: {translator_name}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "translator_name": translator_name,
            "order_number": order_number,
        },
    )


async def notify_internal_note(
    db: AsyncSession,
    user_id: UUID,
    author_name: str,
    order_number: str,
    note_preview: str,
    order_id: str,
):
    """Створити нотифікацію про додавання internal note"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.INTERNAL_NOTE,
        title="📝 Нова нотатка",
        message=f"Автор: {author_name}\nЗамовлення: {order_number}\n\n{note_preview}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "author_name": author_name,
            "order_number": order_number,
            "note_preview": note_preview,
        },
    )


async def notify_deadline_warning(
    db: AsyncSession,
    user_id: UUID,
    order_number: str,
    deadline: str,
    hours_remaining: int,
    order_id: str,
):
    """Створити нотифікацію про наближення дедлайну"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.DEADLINE_WARNING,
        title=f"⚠️ Дедлайн через {hours_remaining} годин!",
        message=f"Замовлення: {order_number}\nДедлайн: {deadline}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "order_number": order_number,
            "deadline": deadline,
            "hours_remaining": hours_remaining,
        },
    )


async def notify_deadline_passed(
    db: AsyncSession,
    user_id: UUID,
    order_number: str,
    deadline: str,
    order_id: str,
):
    """Створити нотифікацію про прострочений дедлайн"""
    return await NotificationService.create_notification(
        db=db,
        user_id=user_id,
        notification_type=NotificationType.DEADLINE_PASSED,
        title="⏰ Дедлайн прострочений",
        message=f"Замовлення: {order_number}\nДедлайн: {deadline}",
        entity_type=EntityType.ORDER,
        entity_id=order_id,
        action_url=f"/orders/{order_id}",
        data={
            "order_number": order_number,
            "deadline": deadline,
        },
    )

