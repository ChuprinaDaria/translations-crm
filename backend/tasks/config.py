"""
Configuration for background tasks (Arq).
"""
import os
from typing import Optional

# Arq settings
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Task settings
TASK_MAX_JOBS = int(os.getenv("TASK_MAX_JOBS", "10"))
TASK_TIMEOUT = int(os.getenv("TASK_TIMEOUT", "300"))  # 5 minutes


class TaskSettings:
    """Settings for background tasks."""
    redis_url: str = REDIS_URL
    max_jobs: int = TASK_MAX_JOBS
    timeout: int = TASK_TIMEOUT


task_settings = TaskSettings()

