"""
Media background tasks - асинхронне завантаження та обробка медіа файлів.
"""
import logging
from typing import Optional, Dict
from uuid import UUID
from sqlalchemy.orm import Session

from tasks.celery_app import celery_app
from core.database import SessionLocal

logger = logging.getLogger(__name__)


@celery_app.task(name="download_and_save_media_task")
def download_and_save_media_task(
    message_id: str,
    url: str,
    mime_type: str,
    original_name: str,
    headers: Optional[Dict[str, str]] = None,
    file_type: Optional[str] = None
):
    """
    Асинхронне завантаження та збереження медіа файлу.
    
    Args:
        message_id: ID повідомлення
        url: URL для завантаження
        mime_type: MIME тип файлу
        original_name: Оригінальна назва файлу
        headers: Додаткові HTTP заголовки (наприклад, Authorization)
        file_type: Тип файлу (image, video, audio, document) - опціонально
    
    Returns:
        dict: Результат завантаження
    """
    db: Session = SessionLocal()
    try:
        from modules.communications.utils.media import download_and_save_media
        
        # Викликати async функцію
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        attachment = loop.run_until_complete(
            download_and_save_media(
                db=db,
                message_id=UUID(message_id),
                url=url,
                mime_type=mime_type,
                original_name=original_name,
                file_type=file_type,
                headers=headers
            )
        )
        
        if attachment:
            db.commit()
            logger.info(f"✅ Media downloaded and saved: {original_name} ({attachment.file_size} bytes)")
            return {
                "status": "success",
                "attachment_id": str(attachment.id),
                "file_size": attachment.file_size,
                "file_path": attachment.file_path
            }
        else:
            logger.warning(f"⚠️ Failed to download media from {url}")
            return {
                "status": "failed",
                "error": "Download failed"
            }
            
    except Exception as e:
        logger.error(f"❌ Failed to download and save media from {url}: {e}", exc_info=True)
        return {
            "status": "error",
            "error": str(e)
        }
        
    finally:
        db.close()

