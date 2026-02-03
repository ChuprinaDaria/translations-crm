"""
Система міграцій для автоматичного створення нових таблиць (async Base).
Створює тільки відсутні таблиці, не чіпає існуючі.
"""
from sqlalchemy import text, create_engine
from core.db import Base, engine
from core.config import settings
import logging

logger = logging.getLogger(__name__)


async def create_missing_tables():
    """
    Створює тільки відсутні таблиці з async моделей (core.db.Base).
    Не створює старі таблиці (db.Base).
    """
    try:
        # Імпортуємо всі async моделі для реєстрації в Base.metadata
        from modules.auth.models import User
        from modules.crm.models import (
            Client, Order, InternalNote, TimelineStep, Translator,
            TranslatorLanguage, TranslationRequest, Office, Language,
            Specialization, TranslatorLanguageRate
        )
        from modules.finance.models import Transaction
        from modules.communications.models import Conversation, Message
        from modules.notifications.models import Notification, NotificationSettings
        from modules.autobot.models import AutobotSettings, AutobotHoliday, AutobotLog
        from modules.ai_integration.models import AISettings
        
        # Отримуємо список всіх таблиць з метаданих
        all_tables = Base.metadata.tables.keys()
        logger.info(f"Found {len(all_tables)} async models to check: {', '.join(sorted(all_tables))}")
        
        async with engine.begin() as conn:
            # Перевіряємо які таблиці вже існують
            result = await conn.execute(text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """))
            existing_tables = {row[0] for row in result.fetchall()}
            logger.info(f"Found {len(existing_tables)} existing tables in database")
            
            # Створюємо тільки відсутні таблиці
            tables_to_create = []
            for table_name in all_tables:
                if table_name not in existing_tables:
                    tables_to_create.append(table_name)
            
            if not tables_to_create:
                logger.info("✓ All async tables already exist, nothing to create")
                return
            
            logger.info(f"Creating {len(tables_to_create)} missing tables: {', '.join(tables_to_create)}")
        
        # Створюємо sync engine для створення таблиць
        # (SQLAlchemy create_all працює тільки з sync engine)
        sync_database_url = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
        sync_engine = create_engine(sync_database_url)
        
        try:
            # Створюємо тільки потрібні таблиці
            for table_name in tables_to_create:
                if table_name in Base.metadata.tables:
                    table = Base.metadata.tables[table_name]
                    table.create(bind=sync_engine, checkfirst=True)
                    logger.info(f"✓ Created table: {table_name}")
            
            logger.info(f"✓ Successfully created {len(tables_to_create)} tables")
        finally:
            sync_engine.dispose()
            
    except Exception as e:
        logger.error(f"Error creating missing tables: {e}", exc_info=True)
        raise

