"""
Утиліти для роботи з медіа-файлами.
"""
import os
from pathlib import Path
from uuid import UUID, uuid4
from typing import Optional, Dict, Any, BinaryIO
from sqlalchemy.orm import Session
import httpx
import logging

from modules.communications.models import Attachment, Message
from core.config import settings

logger = logging.getLogger(__name__)

def get_media_dir() -> Path:
    """Get media directory path, creating it if necessary."""
    media_dir = settings.get_media_dir()
    # Try to create directory, but don't fail if we can't (e.g., in CI)
    try:
        media_dir.mkdir(parents=True, exist_ok=True)
    except (PermissionError, OSError) as e:
        logger.warning(f"Could not create media directory {media_dir}: {e}. Will attempt to create on first use.")
    return media_dir


def determine_file_type(mime_type: str, filename: str = "") -> str:
    """Визначити тип файлу на основі MIME типу."""
    mime_lower = mime_type.lower()
    
    if mime_lower.startswith('image/'):
        return 'image'
    elif mime_lower.startswith('video/'):
        return 'video'
    elif mime_lower.startswith('audio/'):
        return 'audio'
    elif mime_lower in ('application/pdf', 'application/msword', 
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                       'application/vnd.ms-excel',
                       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                       'application/vnd.ms-powerpoint',
                       'application/vnd.openxmlformats-officedocument.presentationml.presentation',
                       'text/plain', 'text/csv'):
        return 'document'
    else:
        return 'file'


def save_media_file(
    db: Session,
    message_id: UUID,
    file_data: bytes,
    mime_type: str,
    original_name: str,
    file_type: Optional[str] = None,
) -> Attachment:
    """
    Зберегти медіа-файл на диск та створити запис в БД.
    
    Args:
        db: Database session
        message_id: ID повідомлення
        file_data: Байти файлу
        mime_type: MIME тип файлу
        original_name: Оригінальна назва файлу
        file_type: Тип файлу (image, document, audio, video). Якщо None, визначається автоматично.
        
    Returns:
        Attachment об'єкт
    """
    # Визначити тип файлу якщо не вказано
    if not file_type:
        file_type = determine_file_type(mime_type, original_name)
    
    # Створити унікальну назву файлу
    file_id = uuid4()
    ext = Path(original_name).suffix or ""
    filename = f"{file_id}{ext}"
    
    # Зберегти файл в підпапці attachments
    media_dir = get_media_dir()
    attachments_dir = media_dir / "attachments"
    # Ensure directory exists before writing
    try:
        attachments_dir.mkdir(parents=True, exist_ok=True)
    except (PermissionError, OSError) as e:
        logger.error(f"Cannot create attachments directory {attachments_dir}: {e}")
        raise
    
    file_path = attachments_dir / filename
    with open(file_path, "wb") as f:
        f.write(file_data)
    
    file_size = len(file_data)
    
    # Створити запис в БД - зберігаємо відносний шлях без префіксу media/
    attachment = Attachment(
        message_id=message_id,
        file_path=f"attachments/{filename}",  # Відносний шлях: attachments/filename
        file_type=file_type,
        mime_type=mime_type,
        original_name=original_name,
        file_size=file_size,
    )
    
    # Додати до сесії, але НЕ робити commit - це зробить викликаючий код
    try:
        db.add(attachment)
        db.flush()  # Flush щоб отримати ID, але не commit
        
        logger.info(f"💾 Saved media file: {original_name} ({file_size} bytes) -> {file_path}")
        
        return attachment
    except Exception as e:
        logger.error(f"❌ Failed to save attachment to database: {e}", exc_info=True)
        # Try to remove file if DB save failed
        try:
            if file_path.exists():
                file_path.unlink()
                logger.info(f"🗑️ Removed file after DB save failure: {file_path}")
        except Exception as cleanup_error:
            logger.warning(f"⚠️ Failed to cleanup file after DB error: {cleanup_error}")
        raise  # Re-raise the exception so caller knows it failed


async def download_and_save_media(
    db: Session,
    message_id: UUID,
    url: str,
    mime_type: str,
    original_name: str,
    file_type: Optional[str] = None,
    headers: Optional[Dict[str, str]] = None,
) -> Optional[Attachment]:
    """
    Завантажити медіа з URL та зберегти.
    
    Args:
        db: Database session
        message_id: ID повідомлення
        url: URL для завантаження
        mime_type: MIME тип файлу
        original_name: Оригінальна назва файлу
        file_type: Тип файлу. Якщо None, визначається автоматично.
        headers: Додаткові HTTP заголовки (наприклад, Authorization для Meta API)
        
    Returns:
        Attachment об'єкт або None якщо помилка
    """
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(url, headers=headers or {})
            response.raise_for_status()
            file_data = response.content
            
        return save_media_file(
            db=db,
            message_id=message_id,
            file_data=file_data,
            mime_type=mime_type,
            original_name=original_name,
            file_type=file_type,
        )
    except Exception as e:
        logger.error(f"❌ Failed to download media from {url}: {e}", exc_info=True)
        return None


def get_attachment_url(attachment: Attachment, base_url: str = "") -> str:
    """Отримати URL для доступу до файлу."""
    # Використовуємо повний шлях з БД (attachments/filename.pdf)
    # URL буде: /media/attachments/filename.pdf
    return f"{base_url}/media/{attachment.file_path}"

