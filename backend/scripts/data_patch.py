#!/usr/bin/env python3
"""
Скрипт для нормалізації даних:
1. Виправляє Instagram імена (замінює IGSID на реальні імена та @username)
2. Розкодовує MIME-заголовки в email (From, Subject)
3. Очищає HTML контент в email повідомленнях
"""
import os
import sys
import time
import email.header
import asyncio
from pathlib import Path

# Додаємо шлях до backend
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session
from core.database import SessionLocal
from modules.crm.models import Client
from modules.communications.models import Conversation, Message, PlatformEnum
from modules.communications.services.instagram import InstagramService
from modules.communications.utils.html_sanitizer import html_to_text
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def decode_mime(text):
    """Розкодувати MIME-заголовок."""
    if not text or "=?" not in str(text):
        return text
    try:
        parts = email.header.decode_header(str(text))
        decoded = ""
        for content, charset in parts:
            if isinstance(content, bytes):
                decoded += content.decode(charset or "utf-8", errors='ignore')
            else:
                decoded += str(content)
        return decoded.strip()
    except Exception as e:
        logger.warning(f"Failed to decode MIME header '{text[:50] if text else ''}...': {e}")
        return text


async def fix_instagram_profiles(db: Session, rate_limit_delay: float = 1.0):
    """
    Виправити Instagram профілі: замінити IGSID на @username.
    
    Args:
        db: Database session
        rate_limit_delay: Затримка між запитами до Instagram API (секунди)
    """
    logger.info("=" * 60)
    logger.info("📸 Оновлюємо Instagram юзернейми...")
    logger.info("=" * 60)
    
    # Знайти всі Instagram розмови
    insta_convs = db.query(Conversation).filter(
        Conversation.platform == PlatformEnum.INSTAGRAM
    ).all()
    
    logger.info(f"Знайдено {len(insta_convs)} Instagram розмов")
    
    if not insta_convs:
        logger.info("Немає Instagram розмов для оновлення")
        return
    
    # Створити Instagram сервіс
    try:
        ig_service = InstagramService(db)
    except Exception as e:
        logger.error(f"❌ Не вдалося ініціалізувати InstagramService: {e}")
        logger.error("Пропускаємо оновлення Instagram профілів")
        return
    
    fixed_count = 0
    error_count = 0
    skipped_count = 0
    
    for i, conv in enumerate(insta_convs, 1):
        try:
            # Якщо external_id - це просто цифри (IGSID), оновлюємо
            if conv.external_id and conv.external_id.isdigit():
                logger.info(f"[{i}/{len(insta_convs)}] Оновлюю профіль для {conv.external_id[:20]}...")
                
                # Отримати профіль через API
                profile = await ig_service.get_user_profile(conv.external_id, rate_limit_delay=0)
                
                if profile:
                    username = profile.get('username')
                    name = profile.get('name') or username
                    
                    # Оновити external_id на @username якщо є
                    if username:
                        old_external_id = conv.external_id
                        conv.external_id = f"@{username}"
                        logger.info(f"  ✅ Оновлено: {old_external_id} -> @{username}")
                        fixed_count += 1
                    else:
                        logger.warning(f"  ⚠️ Профіль знайдено, але username відсутній")
                        skipped_count += 1
                else:
                    logger.warning(f"  ⚠️ Профіль не знайдено для {conv.external_id[:20]}...")
                    skipped_count += 1
                
                # Rate limiting
                if rate_limit_delay > 0:
                    await asyncio.sleep(rate_limit_delay)
            else:
                # Якщо вже @username, пропускаємо
                if conv.external_id and conv.external_id.startswith("@"):
                    logger.debug(f"[{i}/{len(insta_convs)}] Пропускаємо (вже @username): {conv.external_id}")
                    skipped_count += 1
                else:
                    logger.debug(f"[{i}/{len(insta_convs)}] Пропускаємо (не IGSID): {conv.external_id}")
                    skipped_count += 1
                    
        except Exception as e:
            logger.error(f"❌ Помилка при обробці розмови {conv.id}: {e}")
            error_count += 1
            continue
    
    db.commit()
    logger.info(f"\n✅ Instagram профілі оновлено: {fixed_count} успішно, {error_count} помилок, {skipped_count} пропущено")


def fix_email_messages(db: Session):
    """
    Декодувати MIME-заголовки та очистити HTML в email повідомленнях.
    
    Args:
        db: Database session
    """
    logger.info("=" * 60)
    logger.info("📧 Декодуємо Email повідомлення...")
    logger.info("=" * 60)
    
    # Знайти всі email повідомлення
    email_messages = db.query(Message).join(Conversation).filter(
        Conversation.platform == PlatformEnum.EMAIL
    ).all()
    
    logger.info(f"Знайдено {len(email_messages)} email повідомлень")
    
    if not email_messages:
        logger.info("Немає email повідомлень для обробки")
        return
    
    fixed_count = 0
    
    for i, msg in enumerate(email_messages, 1):
        try:
            updated = False
            
            # Декодувати заголовки з meta_data
            if msg.meta_data:
                # Subject
                if "subject" in msg.meta_data:
                    original = msg.meta_data["subject"]
                    decoded = decode_mime(original)
                    if decoded != original:
                        msg.meta_data["subject"] = decoded
                        updated = True
                        logger.debug(f"  Декодовано subject: {original[:50]}... -> {decoded[:50]}...")
                
                # Sender email
                if "sender_email" in msg.meta_data:
                    original = msg.meta_data["sender_email"]
                    decoded = decode_mime(original)
                    if decoded != original:
                        msg.meta_data["sender_email"] = decoded
                        updated = True
                        logger.debug(f"  Декодовано sender_email: {original[:50]}... -> {decoded[:50]}...")
            
            # Очистити HTML контент
            if msg.content and "<" in msg.content:
                original_content = msg.content
                cleaned_content = html_to_text(msg.content)
                if cleaned_content != original_content:
                    msg.content = cleaned_content
                    updated = True
                    logger.debug(f"  Очищено HTML контент (довжина: {len(original_content)} -> {len(cleaned_content)})")
            
            if updated:
                fixed_count += 1
                if i % 100 == 0:
                    logger.info(f"  Оброблено {i}/{len(email_messages)} повідомлень...")
                    
        except Exception as e:
            logger.error(f"❌ Помилка при обробці повідомлення {msg.id}: {e}")
            continue
    
    db.commit()
    logger.info(f"\n✅ Email повідомлення оброблено: {fixed_count} оновлено")


async def run_patch():
    """Запустити всі патчі."""
    db = SessionLocal()
    try:
        logger.info("🚀 Починаємо нормалізацію даних...\n")
        
        # 1. Фікс Instagram профілів
        await fix_instagram_profiles(db, rate_limit_delay=0.5)
        
        # 2. Фікс Email повідомлень
        fix_email_messages(db)
        
        logger.info("\n✅ Всі патчі успішно застосовано!")
        
    except Exception as e:
        logger.error(f"❌ Критична помилка: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    # Створити event loop для async функцій
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    loop.run_until_complete(run_patch())

