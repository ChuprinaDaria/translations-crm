"""
Celery application configuration and initialization.

ОПТИМІЗОВАНО для швидшої обробки:
- Збільшено concurrency
- Налаштовано пріоритети черг
- Додано retry політики
"""
import os
from celery import Celery
from kombu import Queue, Exchange

# Get Redis URL from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Create Celery app
celery_app = Celery(
    "crm_tasks",
    broker=REDIS_URL,
    backend=REDIS_URL
)

# Визначаємо черги з пріоритетами
default_exchange = Exchange('default', type='direct')
high_priority_exchange = Exchange('high_priority', type='direct')

# Celery configuration - ОПТИМІЗОВАНО
celery_app.conf.update(
    # Серіалізація
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Трекінг задач
    task_track_started=True,
    result_expires=3600,  # Результати зберігаються 1 годину
    
    # Таймаути - ОПТИМІЗОВАНО для швидших відповідей
    task_time_limit=180,  # 3 хвилини максимум
    task_soft_time_limit=150,  # 2.5 хвилини soft limit
    
    # Worker налаштування - ОПТИМІЗОВАНО
    worker_prefetch_multiplier=2,  # Зменшено для кращого розподілу
    worker_max_tasks_per_child=500,  # Перезапуск worker після 500 задач (memory leak prevention)
    worker_concurrency=4,  # Кількість паралельних workers
    
    # Acknowledgment - ОПТИМІЗОВАНО
    task_acks_late=True,  # Підтвердження після виконання (для надійності)
    task_reject_on_worker_lost=True,  # Повторна обробка при втраті worker
    
    # Rate limits
    worker_disable_rate_limits=False,
    task_default_rate_limit='100/m',  # 100 задач на хвилину за замовчуванням
    
    # Retry політика за замовчуванням
    task_default_retry_delay=5,  # 5 секунд між retry
    task_max_retries=3,  # Максимум 3 retry
    
    # Черги з пріоритетами
    task_queues=(
        Queue('high_priority', high_priority_exchange, routing_key='high'),
        Queue('default', default_exchange, routing_key='default'),
        Queue('low_priority', default_exchange, routing_key='low'),
    ),
    task_default_queue='default',
    task_default_exchange='default',
    task_default_routing_key='default',
    
    # Роутинг задач за пріоритетом
    task_routes={
        # Високий пріоритет - відповіді клієнтам
        'send_message_task': {'queue': 'high_priority'},
        'process_ai_reply_task': {'queue': 'high_priority'},
        'process_autobot_message_task': {'queue': 'high_priority'},
        
        # Середній пріоритет - обробка webhook
        'process_webhook_task': {'queue': 'default'},
        'update_shipment_status_task': {'queue': 'default'},
        
        # Низький пріоритет - фонові задачі
        'download_and_save_media_task': {'queue': 'low_priority'},
        'archive_old_conversations_task': {'queue': 'low_priority'},
        'update_all_active_shipments_task': {'queue': 'low_priority'},
    },
    
    # Broker налаштування для Redis
    broker_transport_options={
        'visibility_timeout': 3600,  # 1 година
        'fanout_prefix': True,
        'fanout_patterns': True,
    },
    
    # Connection pool
    broker_pool_limit=10,
    redis_max_connections=20,
    
    # Beat schedule для періодичних задач
    beat_schedule={
        'update-all-active-shipments': {
            'task': 'update_all_active_shipments_task',
            'schedule': 300.0,  # Кожні 5 хвилин
        },
    },
)

# Import tasks to register them
from tasks import messaging_tasks, ai_tasks, media_tasks, autobot_tasks, webhook_tasks, postal_tasks  # noqa: F401, E402

