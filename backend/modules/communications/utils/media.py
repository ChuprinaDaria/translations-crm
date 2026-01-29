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

logger = logging.getLogger(__name__)

# Шлях до папки з медіа
MEDIA_DIR = Path("/app/media")
MEDIA_DIR.mkdir(parents=True, exist_ok=True)


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
    
    # Зберегти файл
    file_path = MEDIA_DIR / filename
    with open(file_path, "wb") as f:
        f.write(file_data)
    
    file_size = len(file_data)
    
    # Створити запис в БД
    attachment = Attachment(
        message_id=message_id,
        file_path=f"media/{filename}",  # Відносний шлях для URL
        file_type=file_type,
        mime_type=mime_type,
        original_name=original_name,
        file_size=file_size,
    )
    
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    logger.info(f"💾 Saved media file: {original_name} ({file_size} bytes) -> {file_path}")
    
    return attachment


async def download_and_save_media(
    db: Session,
    message_id: UUID,
    url: str,
    mime_type: str,
    original_name: str,
    file_type: Optional[str] = None,
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
        
    Returns:
        Attachment об'єкт або None якщо помилка
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
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
        logger.error(f"❌ Failed to download media from {url}: {e}")
        return None


def get_attachment_url(attachment: Attachment, base_url: str = "") -> str:
    """Отримати URL для доступу до файлу."""
    return f"{base_url}/media/{Path(attachment.file_path).name}"

