"""
Email background tasks - асинхронна відправка пошти.
"""
from arq import create_pool
from arq.connections import RedisSettings
from typing import Dict, Any
import logging

from tasks.config import task_settings
from email_service import send_kp_email

logger = logging.getLogger(__name__)


async def send_email_task(ctx: Dict[str, Any], to: str, subject: str, body: str, attachments: list = None):
    """
    Фонова задача для відправки email.
    
    Args:
        ctx: Arq context
        to: Email адреса отримувача
        subject: Тема листа
        body: Тіло листа (HTML)
        attachments: Список вкладень (опціонально)
    """
    try:
        await send_kp_email(to, subject, body, attachments)
        logger.info(f"Email sent successfully to {to}")
        return {"status": "success", "to": to}
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        raise


async def send_kp_email_task(ctx: Dict[str, Any], kp_id: int, recipient_email: str):
    """
    Фонова задача для відправки КП по email.
    
    Args:
        ctx: Arq context
        kp_id: ID комерційної пропозиції
        recipient_email: Email отримувача
    """
    # TODO: Реалізувати логіку відправки КП
    # 1. Отримати KP з БД
    # 2. Згенерувати PDF
    # 3. Відправити email з PDF вкладенням
    logger.info(f"Sending KP {kp_id} to {recipient_email}")
    return {"status": "success", "kp_id": kp_id, "email": recipient_email}


# Arq worker functions
class WorkerSettings:
    """Arq worker settings."""
    redis_settings = RedisSettings.from_dsn(task_settings.redis_url)
    functions = [send_email_task, send_kp_email_task]
    max_jobs = task_settings.max_jobs
    job_timeout = task_settings.timeout

