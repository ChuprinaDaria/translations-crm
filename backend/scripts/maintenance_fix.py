#!/usr/bin/env python3
"""
Скрипт для виправлення існуючих даних після міграції:
1. Виправляє Instagram імена (замінює IGSID на реальні імена)
2. Розкодовує MIME-заголовки в email (From, Subject)
3. Видаляє старі автоматично підтягнуті мейли
"""
import os
import sys
import time
import email.header
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from core.database import SessionLocal

# Імпортуємо всі моделі, які використовуються в relationships
# Це необхідно для SQLAlchemy, щоб він міг знайти всі класи при створенні relationships
from modules.auth.models import User  # Використовується в Conversation.assigned_manager
from modules.crm.models import Client  # Використовується в Conversation.client
from modules.communications.models import Conversation, Message, PlatformEnum, Attachment
from modules.communications.services.instagram import InstagramService
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def decode_mime(text_value):
    """
    Розкодувати MIME-заголовок (наприклад, =?UTF-8?B?...?=).
    
    Args:
        text_value: Текст з MIME-кодуванням
        
    Returns:
        Розкодований текст
    """
    if not text_value or "=?" not in str(text_value):
        return text_value
    
    try:
        parts = email.header.decode_header(str(text_value))
        decoded = ""
        for content, charset in parts:
            if isinstance(content, bytes):
                decoded += content.decode(charset or "utf-8", errors='ignore')
            else:
                decoded += str(content)
        return decoded.strip()
    except Exception as e:
        logger.warning(f"Failed to decode MIME header '{text_value[:50]}...': {e}")
        return text_value


def fix_instagram_profiles(db, rate_limit_delay=1.0):
    """
    Виправити Instagram профілі: замінити IGSID на реальні імена.
    Зберігає ім'я в meta_data Conversation, оскільки client_name береться з Client.
    
    Args:
        db: Database session
        rate_limit_delay: Затримка між запитами до Instagram API (секунди)
    """
    logger.info("=" * 60)
    logger.info("Fixing Instagram profiles...")
    logger.info("=" * 60)
    
    # Знайти всі Instagram розмови
    conversations = db.query(Conversation).filter(
        Conversation.platform == PlatformEnum.INSTAGRAM
    ).all()
    
    logger.info(f"Found {len(conversations)} Instagram conversations")
    
    if not conversations:
        logger.info("No Instagram conversations to fix")
        return
    
    # Створити Instagram сервіс
    try:
        instagram_service = InstagramService(db)
    except Exception as e:
        logger.error(f"Failed to initialize InstagramService: {e}")
        logger.error("Skipping Instagram profile fixes")
        return
    
    fixed_count = 0
    error_count = 0
    skipped_count = 0
    
    for i, conv in enumerate(conversations, 1):
        try:
            if not conv.external_id:
                logger.warning(f"Conversation {conv.id} has no external_id, skipping")
                skipped_count += 1
                continue
            
            # Перевірити чи вже є ім'я в meta_data
            has_name = False
            if conv.meta_data and "client_name" in conv.meta_data:
                client_name = conv.meta_data.get("client_name")
                # Якщо ім'я не є IGSID (не схоже на UUID)
                if client_name and client_name != conv.external_id and len(client_name) < 50:
                    has_name = True
            
            # Якщо є Client, перевірити чи в нього є ім'я
            if conv.client_id:
                try:
                    client = db.query(Client).filter(Client.id == conv.client_id).first()
                    if client and client.full_name:
                        has_name = True
                except Exception as e:
                    logger.warning(f"Error checking client for conversation {conv.id}: {e}")
            
            if has_name:
                logger.debug(f"[{i}/{len(conversations)}] Conversation {conv.id} already has client name")
                skipped_count += 1
                continue
            
            logger.info(f"[{i}/{len(conversations)}] Fetching profile for IGSID: {conv.external_id[:20]}...")
            
            # Rate limiting: затримка між запитами
            if i > 1:
                time.sleep(rate_limit_delay)
            
            # Отримати профіль через Instagram API
            profile = None
            try:
                import asyncio
                # Створити event loop якщо його немає
                try:
                    loop = asyncio.get_event_loop()
                except RuntimeError:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                
                profile = loop.run_until_complete(
                    instagram_service.get_user_profile(conv.external_id, rate_limit_delay=0)
                )
            except Exception as e:
                logger.warning(f"Failed to fetch profile for {conv.external_id[:20]}...: {e}")
                error_count += 1
                continue
            
            if profile:
                # Отримати ім'я з профілю
                client_name = profile.get("name") or profile.get("username") or conv.external_id
                avatar_url = profile.get("profile_pic")
                
                # Зберегти дані через SQL (оскільки Conversation не має meta_data)
                # Можна зберегти в окремій таблиці або створити Client
                # Для швидкого виправлення зберігаємо через SQL якщо є колонка meta_data
                import json
                
                try:
                    # Спробувати оновити через SQL (якщо колонка meta_data існує)
                    result = db.execute(
                        text("""
                            SELECT column_name 
                            FROM information_schema.columns 
                            WHERE table_name = 'communications_conversations' 
                            AND column_name = 'meta_data'
                        """)
                    )
                    has_meta_data = result.fetchone() is not None
                    
                    if has_meta_data:
                        # Отримати поточний meta_data
                        result = db.execute(
                            text("SELECT meta_data FROM communications_conversations WHERE id = :id"),
                            {"id": str(conv.id)}
                        )
                        row = result.fetchone()
                        current_meta = {}
                        if row and row[0]:
                            current_meta = row[0] if isinstance(row[0], dict) else json.loads(row[0])
                        
                        old_name = current_meta.get("client_name", "N/A")
                        current_meta["client_name"] = client_name
                        if avatar_url:
                            current_meta["avatar_url"] = avatar_url
                        
                        db.execute(
                            text("""
                                UPDATE communications_conversations 
                                SET meta_data = :meta_data::jsonb
                                WHERE id = :id
                            """),
                            {
                                "meta_data": json.dumps(current_meta),
                                "id": str(conv.id)
                            }
                        )
                        db.commit()
                        logger.info(f"  ✓ Updated: {old_name} → {client_name}")
                    else:
                        # Якщо немає meta_data, просто логуємо (ім'я буде братися з Client якщо створений)
                        logger.info(f"  ✓ Profile fetched: {client_name} (meta_data column not available)")
                    
                    fixed_count += 1
                except Exception as e:
                    logger.warning(f"Could not save profile data for conversation {conv.id}: {e}")
                    error_count += 1
                    try:
                        db.rollback()
                    except Exception:
                        pass  # Ігноруємо помилки rollback
            else:
                logger.warning(f"  ✗ No profile data for {conv.external_id[:20]}...")
                error_count += 1
        
        except Exception as e:
            logger.error(f"Error processing conversation {conv.id}: {e}", exc_info=True)
            error_count += 1
            try:
                db.rollback()
            except Exception:
                pass  # Ігноруємо помилки rollback
            continue
    
    logger.info(f"\nInstagram profiles fixed: {fixed_count} successful, {error_count} errors, {skipped_count} skipped")


def fix_email_mime_headers(db):
    """
    Розкодувати MIME-заголовки в email повідомленнях.
    Шукає повідомлення з MIME-кодуванням у meta_data або content.
    """
    logger.info("=" * 60)
    logger.info("Fixing email MIME headers...")
    logger.info("=" * 60)
    
    # Знайти всі email повідомлення
    email_messages = db.query(Message).join(Conversation).filter(
        Conversation.platform == PlatformEnum.EMAIL
    ).all()
    
    logger.info(f"Found {len(email_messages)} email messages")
    
    if not email_messages:
        logger.info("No email messages to fix")
        return
    
    fixed_count = 0
    
    for i, msg in enumerate(email_messages, 1):
        try:
            updated = False
            
            # Перевірити meta_data на наявність MIME-кодованих полів
            if msg.meta_data:
                # Якщо в meta_data є sender_email або subject з MIME-кодуванням
                if "sender_email" in msg.meta_data:
                    original = msg.meta_data["sender_email"]
                    decoded = decode_mime(original)
                    if decoded != original:
                        msg.meta_data["sender_email"] = decoded
                        updated = True
                        logger.debug(f"  Decoded sender_email: {original[:50]}... → {decoded[:50]}...")
                
                if "subject" in msg.meta_data:
                    original = msg.meta_data["subject"]
                    decoded = decode_mime(original)
                    if decoded != original:
                        msg.meta_data["subject"] = decoded
                        updated = True
                        logger.debug(f"  Decoded subject: {original[:50]}... → {decoded[:50]}...")
            
            # Перевірити content на наявність MIME-кодування (рідкісний випадок)
            if msg.content and "=?" in msg.content:
                decoded_content = decode_mime(msg.content)
                if decoded_content != msg.content:
                    msg.content = decoded_content
                    updated = True
                    logger.debug(f"  Decoded content in message {msg.id}")
            
            if updated:
                db.commit()
                fixed_count += 1
                if fixed_count % 100 == 0:
                    logger.info(f"  Processed {i}/{len(email_messages)} messages, fixed {fixed_count}")
        
        except Exception as e:
            logger.error(f"Error processing message {msg.id}: {e}", exc_info=True)
            db.rollback()
            continue
    
    logger.info(f"\nEmail MIME headers fixed: {fixed_count} messages updated")


def cleanup_old_auto_emails(db, days_old=7):
    """
    Видалити старі автоматично підтягнуті email повідомлення.
    
    Args:
        db: Database session
        days_old: Видалити мейли старіше N днів (за замовчуванням 7)
    """
    logger.info("=" * 60)
    logger.info(f"Cleaning up old auto-imported emails (older than {days_old} days)...")
    logger.info("=" * 60)
    
    from datetime import datetime, timedelta, timezone
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
    
    # Знайти всі email повідомлення старіше cutoff_date
    old_messages = db.query(Message).join(Conversation).filter(
        Conversation.platform == PlatformEnum.EMAIL,
        Message.created_at < cutoff_date,
        Message.direction == "inbound"  # Тільки вхідні (автоматично імпортовані)
    ).all()
    
    logger.info(f"Found {len(old_messages)} old email messages to delete")
    
    if not old_messages:
        logger.info("No old email messages to clean up")
        return
    
    # Підтвердження
    response = input(f"\n⚠️  Are you sure you want to delete {len(old_messages)} old email messages? (yes/no): ")
    if response.lower() != "yes":
        logger.info("Cleanup cancelled by user")
        return
    
    deleted_count = 0
    for msg in old_messages:
        try:
            db.delete(msg)
            deleted_count += 1
            if deleted_count % 100 == 0:
                logger.info(f"  Deleted {deleted_count}/{len(old_messages)} messages...")
        except Exception as e:
            logger.error(f"Error deleting message {msg.id}: {e}")
            db.rollback()
            continue
    
    db.commit()
    logger.info(f"\n✓ Deleted {deleted_count} old email messages")


def main():
    """Головна функція скрипта."""
    logger.info("=" * 60)
    logger.info("Maintenance Fix Script")
    logger.info("=" * 60)
    logger.info("This script will:")
    logger.info("  1. Fix Instagram profile names (replace IGSID with real names)")
    logger.info("  2. Decode MIME headers in email messages")
    logger.info("  3. Clean up old auto-imported emails (optional)")
    logger.info("=" * 60)
    
    db = SessionLocal()
    
    try:
        # 1. Виправити Instagram профілі
        fix_instagram_profiles(db, rate_limit_delay=1.0)
        
        # 2. Виправити MIME заголовки в email
        fix_email_mime_headers(db)
        
        # 3. Очистити старі мейли (опціонально, закоментовано за замовчуванням)
        # Розкоментуйте наступний рядок якщо потрібно видалити старі мейли:
        # cleanup_old_auto_emails(db, days_old=7)
        
        logger.info("=" * 60)
        logger.info("✓ Maintenance fix completed successfully!")
        logger.info("=" * 60)
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        db.rollback()
        sys.exit(1)
    
    finally:
        db.close()


if __name__ == "__main__":
    main()

