"""
Background tasks module - Celery для асинхронних задач.
Використовується для SMTP, Webhooks, Meta API, AI RAG, медіа обробки тощо.
"""

from tasks.celery_app import celery_app

# Import all tasks to register them
from tasks import messaging_tasks, ai_tasks, media_tasks, autobot_tasks, webhook_tasks  # noqa: F401, E402

__all__ = [
    "celery_app",
    "messaging_tasks",
    "ai_tasks",
    "media_tasks",
    "autobot_tasks",
    "webhook_tasks",
]

