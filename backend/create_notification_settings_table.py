#!/usr/bin/env python3
"""
Скрипт для створення таблиці notification_settings в базі даних.
Використовується для виправлення помилки: relation "notification_settings" does not exist
"""
import asyncio
from sqlalchemy import text
from core.db import engine
from modules.notifications.models import NotificationSettings, Notification
from modules.auth.models import User
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def create_notification_settings_table():
    """Створює таблицю notification_settings якщо вона не існує"""
    try:
        async with engine.begin() as conn:
            # Перевіряємо чи існує таблиця
            check_query = text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'notification_settings'
                );
            """)
            result = await conn.execute(check_query)
            table_exists = result.scalar()
            
            if table_exists:
                logger.info("✓ Table 'notification_settings' already exists")
                return
            
            logger.info("Creating table 'notification_settings'...")
            
            # Створюємо таблицю
            create_table_query = text("""
                CREATE TABLE notification_settings (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    sound BOOLEAN NOT NULL DEFAULT TRUE,
                    desktop BOOLEAN NOT NULL DEFAULT TRUE,
                    vibration BOOLEAN NOT NULL DEFAULT TRUE,
                    types_enabled JSONB,
                    do_not_disturb JSONB,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT notification_settings_user_id_key UNIQUE (user_id)
                );
            """)
            
            await conn.execute(create_table_query)
            
            # Створюємо індекси
            create_indexes_query = text("""
                CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id 
                ON notification_settings(user_id);
            """)
            await conn.execute(create_indexes_query)
            
            logger.info("✓ Table 'notification_settings' created successfully!")
            
            # Перевіряємо чи існує таблиця notifications
            check_notifications_query = text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'notifications'
                );
            """)
            result = await conn.execute(check_notifications_query)
            notifications_exists = result.scalar()
            
            if not notifications_exists:
                logger.info("Creating table 'notifications'...")
                create_notifications_query = text("""
                    CREATE TABLE notifications (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        type VARCHAR NOT NULL,
                        title VARCHAR NOT NULL,
                        message VARCHAR NOT NULL,
                        entity_type VARCHAR,
                        entity_id VARCHAR,
                        data JSONB,
                        is_read BOOLEAN NOT NULL DEFAULT FALSE,
                        read_at TIMESTAMP WITH TIME ZONE,
                        action_url VARCHAR,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        expires_at TIMESTAMP WITH TIME ZONE
                    );
                """)
                await conn.execute(create_notifications_query)
                
                # Створюємо індекси для notifications
                create_notifications_indexes = text("""
                    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
                    CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
                    CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
                    CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
                """)
                await conn.execute(create_notifications_indexes)
                logger.info("✓ Table 'notifications' created successfully!")
            else:
                logger.info("✓ Table 'notifications' already exists")
                
    except Exception as e:
        logger.error(f"✗ Error creating tables: {e}")
        raise


async def main():
    """Головна функція"""
    try:
        await create_notification_settings_table()
        logger.info("Migration completed successfully!")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        raise
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

