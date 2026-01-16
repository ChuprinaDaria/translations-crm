"""
Сервіс автоматизації Timeline для замовлень
"""
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
from typing import Optional

from modules.crm.models import Order, TimelineStep, TimelineStepType


# Порядок етапів (від 1 до 7)
TIMELINE_STEP_ORDER = [
    TimelineStepType.CLIENT_CREATED,  # 1
    TimelineStepType.ORDER_CREATED,  # 2
    TimelineStepType.PAYMENT_LINK_SENT,  # 3
    TimelineStepType.PAYMENT_RECEIVED,  # 4
    TimelineStepType.TRANSLATOR_ASSIGNED,  # 5
    TimelineStepType.TRANSLATION_READY,  # 6
    TimelineStepType.ISSUED_SENT,  # 7
]


def get_completed_steps_count(order: Order) -> int:
    """Отримати кількість завершених етапів для замовлення"""
    completed_steps = {
        step.step_type for step in order.timeline_steps
        if step.completed
    }
    
    # Рахуємо скільки етапів завершено по порядку
    count = 0
    for step_type in TIMELINE_STEP_ORDER:
        if step_type in completed_steps:
            count += 1
        else:
            break  # Якщо етап не завершено, зупиняємось
    
    return count


def add_timeline_step(
    db: Session,
    order_id: UUID,
    step_type: TimelineStepType,
    completed_by_id: Optional[UUID] = None,
    metadata: Optional[str] = None,
) -> TimelineStep:
    """
    Додати етап до Timeline замовлення
    
    Args:
        db: Database session
        order_id: ID замовлення
        step_type: Тип етапу
        completed_by_id: ID користувача, який виконав етап
        metadata: Додаткові дані (JSON string)
    
    Returns:
        Створений TimelineStep
    """
    # Перевіряємо, чи етап вже існує
    existing = db.query(TimelineStep).filter(
        TimelineStep.order_id == order_id,
        TimelineStep.step_type == step_type,
        TimelineStep.completed == True
    ).first()
    
    if existing:
        # Якщо етап вже існує, оновлюємо його
        if completed_by_id:
            existing.completed_by_id = completed_by_id
        if metadata:
            existing.metadata = metadata
        existing.completed_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing
    
    # Створюємо новий етап
    step = TimelineStep(
        order_id=order_id,
        step_type=step_type,
        completed=True,
        completed_by_id=completed_by_id,
        metadata=metadata,
    )
    
    db.add(step)
    db.commit()
    db.refresh(step)
    
    return step


def mark_client_created(db: Session, order_id: UUID, client_id: UUID) -> TimelineStep:
    """Автоматично: Створено клієнта (етап 1)"""
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.CLIENT_CREATED,
        metadata=f'{{"client_id": "{client_id}"}}'
    )


def mark_order_created(db: Session, order_id: UUID, created_by_id: UUID) -> TimelineStep:
    """Автоматично: Створено замовлення (етап 2)"""
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.ORDER_CREATED,
        completed_by_id=created_by_id
    )


def mark_payment_link_sent(db: Session, order_id: UUID, sent_by_id: UUID, payment_link: str) -> TimelineStep:
    """Автоматично: Надіслано лінк оплати (етап 3)"""
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.PAYMENT_LINK_SENT,
        completed_by_id=sent_by_id,
        metadata=f'{{"payment_link": "{payment_link}"}}'
    )


def mark_payment_received(db: Session, order_id: UUID, transaction_id: Optional[str] = None) -> TimelineStep:
    """Автоматично/Manual: Оплачено (етап 4)"""
    metadata = None
    if transaction_id:
        metadata = f'{{"transaction_id": "{transaction_id}"}}'
    
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.PAYMENT_RECEIVED,
        metadata=metadata
    )


def mark_translator_assigned(db: Session, order_id: UUID, translator_id: UUID, assigned_by_id: UUID) -> TimelineStep:
    """Автоматично: Призначено перекладача (етап 5)"""
    # translator_id can be UUID or int (as string in metadata)
    translator_id_str = str(translator_id)
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.TRANSLATOR_ASSIGNED,
        completed_by_id=assigned_by_id,
        metadata=f'{{"translator_id": "{translator_id_str}"}}'
    )


def mark_translation_ready(db: Session, order_id: UUID, completed_by_id: UUID) -> TimelineStep:
    """Manual/Auto: Переклад готовий (етап 6)"""
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.TRANSLATION_READY,
        completed_by_id=completed_by_id
    )


def mark_issued_sent(db: Session, order_id: UUID, sent_by_id: UUID, tracking_number: Optional[str] = None) -> TimelineStep:
    """Автоматично/Manual: Видано/Відправлено (етап 7)"""
    metadata = None
    if tracking_number:
        metadata = f'{{"tracking_number": "{tracking_number}"}}'
    
    return add_timeline_step(
        db=db,
        order_id=order_id,
        step_type=TimelineStepType.ISSUED_SENT,
        completed_by_id=sent_by_id,
        metadata=metadata
    )

