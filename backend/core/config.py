"""
Configuration management - централізоване управління налаштуваннями.
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings."""
    
    # App
    APP_NAME: str = "CRM Base System"
    APP_ENV: str = os.getenv("APP_ENV", "dev")
    DEBUG: bool = APP_ENV == "dev"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./temp.db")
    DB_URL: str = DATABASE_URL
    
    # Security
    SECRET_KEY: str = os.getenv("JWT_SECRET", os.getenv("SECRET_KEY", ""))
    JWT_SECRET: str = SECRET_KEY
    ALGORITHM: str = "HS256"
    JWT_ALGORITHM: str = ALGORITHM
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # CORS
    CORS_ORIGINS: List[str] = ["*"] if APP_ENV == "dev" else []
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOADS_DIR: Path = BASE_DIR / "uploads"
    
    MEDIA_ROOT: str = os.getenv("MEDIA_ROOT", "/app/media")
    MEDIA_URL: str = os.getenv("MEDIA_URL", "/media/")
    
    def get_media_dir(self) -> Path:
        """Get media directory path from MEDIA_ROOT or default."""
        return Path(self.MEDIA_ROOT)
    
    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    
    # Telegram
    TELEGRAM_ENABLED: bool = os.getenv("TELEGRAM_ENABLED", "false").lower() == "true"
    
    # RAG Integration
    RAG_TOKEN: str = os.getenv("RAG_TOKEN", "adme_rag_secret_987654321")
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

