"""
Telegram webhook handler.
"""
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
import httpx
import os
import logging

from modules.communications.services.telegram import TelegramService
from modules.communications.models import PlatformEnum
from modules.communications.utils.media import save_media_file
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)


async def download_telegram_file(
    bot_token: str,
    file_id: str,
    file_type: str,
    mime_type: str,
    filename: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Завантажити файл з Telegram через Bot API.
    
    Args:
        bot_token: Telegram Bot Token
        file_id: Telegram file_id
        file_type: Тип файлу (image, document, video, audio, voice, sticker)
        mime_type: MIME тип файлу
        filename: Оригінальна назва файлу (опціонально)
        
    Returns:
        Dict з інформацією про attachment або None якщо помилка
    """
    try:
        # 1. Отримати file_path через getFile
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://api.telegram.org/bot{bot_token}/getFile",
                params={"file_id": file_id}
            )
            file_info = response.json()
            
            if not file_info.get("ok"):
                logger.error(f"Failed to get file info from Telegram: {file_info}")
                return None
            
            file_path = file_info["result"]["file_path"]
            file_size = file_info["result"].get("file_size", 0)
            
            # 2. Завантажити файл
            file_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
            file_response = await client.get(file_url, timeout=60.0)
            
            if file_response.status_code != 200:
                logger.error(f"Failed to download file from Telegram: {file_response.status_code}")
                return None
            
            file_data = file_response.content
            
            # 3. Визначити filename
            if not filename:
                # Витягнути розширення з file_path
                ext = ""
                if "." in file_path:
                    ext = "." + file_path.split(".")[-1]
                filename = f"{file_type}_{file_id[:10]}{ext}"
            
            return {
                "file_data": file_data,
                "filename": filename,
                "mime_type": mime_type,
                "file_type": file_type,
                "size": file_size,
            }
            
    except Exception as e:
        logger.error(f"Failed to download Telegram file {file_id}: {e}", exc_info=True)
        return None


async def handle_telegram_webhook(
    db: Session,
    webhook_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Обробити webhook від Telegram.
    
    Args:
        db: Database session
        webhook_data: Дані з webhook
        
    Returns:
        Результат обробки
    """
    service = TelegramService(db)
    
    # Отримати bot token для завантаження файлів
    from crud import get_telegram_api_settings
    settings = get_telegram_api_settings(db)
    bot_token = settings.get("telegram_bot_token") or os.getenv("TELEGRAM_BOT_TOKEN")
    
    # Telegram webhook структура залежить від того, як налаштований бот
    # Приклад структури:
    # {
    #     "message": {
    #         "message_id": 123,
    #         "from": {"id": 123456, "first_name": "John", "username": "john"},
    #         "chat": {"id": 123456, "type": "private"},
    #         "date": 1234567890,
    #         "text": "Hello",
    #         "photo": [...],
    #         "document": {...}
    #     }
    # }
    
    message_data = webhook_data.get("message", {})
    if not message_data:
        return {"status": "ignored", "reason": "No message data"}
    
    # Отримати інформацію про відправника
    from_data = message_data.get("from", {})
    chat_data = message_data.get("chat", {})
    
    chat_id = chat_data.get("id", 0)
    chat_type = chat_data.get("type", "private")
    
    # Determine if this is a group/channel (chat_id < 0 or type is group/channel)
    is_group_or_channel = chat_id < 0 or chat_type in ["group", "supergroup", "channel"]
    
    # Determine external_id based on chat type
    if is_group_or_channel:
        # For groups/channels: use chat_id as external_id (one conversation per group)
        external_id = str(chat_id)
        conversation_subject = chat_data.get("title", f"Група {chat_id}")
    else:
        # For private chats: use user_id (or phone/username if available)
        user_id = from_data.get("id", "")
        username = from_data.get("username")
        if username:
            external_id = f"@{username}"
        else:
            external_id = str(user_id)
        conversation_subject = None
    
    content = message_data.get("text", "")
    
    sender_info = {
        "telegram_id": str(from_data.get("id", "")),
        "name": from_data.get("first_name", "") + " " + from_data.get("last_name", "").strip(),
        "username": from_data.get("username"),
    }
    
    # Prepare metadata
    metadata = {
        "message_id": message_data.get("message_id"),
        "date": message_data.get("date"),
        "telegram_chat_id": chat_id,
        "is_group_message": is_group_or_channel,
    }
    if from_data.get("id"):
        metadata["telegram_user_id"] = from_data.get("id")
    if from_data.get("username"):
        metadata["telegram_username"] = from_data.get("username")
    
    # Обробити вкладення (фото, документи, відео, тощо)
    attachments: List[Dict[str, Any]] = []
    
    # Спочатку створюємо повідомлення, щоб отримати message_id для збереження файлів
    temp_content = content or "[Медіа повідомлення]"
    temp_message = await service.receive_message(
        external_id=external_id,
        content=temp_content,
        sender_info=sender_info,
        metadata=metadata,
        subject=conversation_subject,
        attachments=None,  # Спочатку без вкладень
    )
    
    # Обробка фото (Telegram надсилає масив розмірів, беремо найбільший)
    if "photo" in message_data and bot_token:
        photos = message_data["photo"]
        if photos:
            # Беремо найбільший розмір (останній в масиві)
            largest_photo = photos[-1]
            file_id = largest_photo["file_id"]
            
            file_info = await download_telegram_file(
                bot_token=bot_token,
                file_id=file_id,
                file_type="image",
                mime_type="image/jpeg",
                filename="photo.jpg",
            )
            
            if file_info:
                # Зберегти файл
                attachment = save_media_file(
                    db=db,
                    message_id=UUID(str(temp_message.id)),
                    file_data=file_info["file_data"],
                    mime_type=file_info["mime_type"],
                    original_name=file_info["filename"],
                    file_type=file_info["file_type"],
                )
                
                attachments.append({
                    "id": str(attachment.id),
                    "type": "image",
                    "filename": attachment.original_name,
                    "mime_type": attachment.mime_type,
                    "size": attachment.file_size,
                    "url": f"/api/v1/communications/media/{attachment.file_path}",
                })
                
                # Якщо є caption — використовуємо як текст
                if "caption" in message_data:
                    content = message_data["caption"]
                elif not content:
                    content = ""
    
    # Обробка документів
    if "document" in message_data and bot_token:
        doc = message_data["document"]
        file_id = doc["file_id"]
        mime_type = doc.get("mime_type", "application/octet-stream")
        filename = doc.get("file_name", "document")
        
        file_info = await download_telegram_file(
            bot_token=bot_token,
            file_id=file_id,
            file_type="document",
            mime_type=mime_type,
            filename=filename,
        )
        
        if file_info:
            attachment = save_media_file(
                db=db,
                message_id=UUID(str(temp_message.id)),
                file_data=file_info["file_data"],
                mime_type=file_info["mime_type"],
                original_name=file_info["filename"],
                file_type=file_info["file_type"],
            )
            
            attachments.append({
                "id": str(attachment.id),
                "type": "document",
                "filename": attachment.original_name,
                "mime_type": attachment.mime_type,
                "size": attachment.file_size,
                "url": f"/api/v1/communications/media/{attachment.file_path}",
            })
            
            if "caption" in message_data:
                content = message_data["caption"]
            elif not content:
                content = ""
    
    # Обробка відео
    if "video" in message_data and bot_token:
        video = message_data["video"]
        file_id = video["file_id"]
        mime_type = video.get("mime_type", "video/mp4")
        filename = video.get("file_name", "video.mp4")
        
        file_info = await download_telegram_file(
            bot_token=bot_token,
            file_id=file_id,
            file_type="video",
            mime_type=mime_type,
            filename=filename,
        )
        
        if file_info:
            attachment = save_media_file(
                db=db,
                message_id=UUID(str(temp_message.id)),
                file_data=file_info["file_data"],
                mime_type=file_info["mime_type"],
                original_name=file_info["filename"],
                file_type=file_info["file_type"],
            )
            
            attachments.append({
                "id": str(attachment.id),
                "type": "video",
                "filename": attachment.original_name,
                "mime_type": attachment.mime_type,
                "size": attachment.file_size,
                "url": f"/api/v1/communications/media/{attachment.file_path}",
            })
            
            if "caption" in message_data:
                content = message_data["caption"]
            elif not content:
                content = ""
    
    # Обробка голосових повідомлень
    if "voice" in message_data and bot_token:
        voice = message_data["voice"]
        file_id = voice["file_id"]
        mime_type = voice.get("mime_type", "audio/ogg")
        
        file_info = await download_telegram_file(
            bot_token=bot_token,
            file_id=file_id,
            file_type="audio",
            mime_type=mime_type,
            filename="voice.ogg",
        )
        
        if file_info:
            attachment = save_media_file(
                db=db,
                message_id=UUID(str(temp_message.id)),
                file_data=file_info["file_data"],
                mime_type=file_info["mime_type"],
                original_name=file_info["filename"],
                file_type=file_info["file_type"],
            )
            
            attachments.append({
                "id": str(attachment.id),
                "type": "audio",
                "filename": attachment.original_name,
                "mime_type": attachment.mime_type,
                "size": attachment.file_size,
                "url": f"/api/v1/communications/media/{attachment.file_path}",
            })
    
    # Обробка стікерів
    if "sticker" in message_data and bot_token:
        sticker = message_data["sticker"]
        file_id = sticker["file_id"]
        
        # Стікери зазвичай webp
        mime_type = "image/webp"
        if sticker.get("is_animated"):
            mime_type = "application/x-tgsticker"
        
        file_info = await download_telegram_file(
            bot_token=bot_token,
            file_id=file_id,
            file_type="image",
            mime_type=mime_type,
            filename="sticker.webp",
        )
        
        if file_info:
            attachment = save_media_file(
                db=db,
                message_id=UUID(str(temp_message.id)),
                file_data=file_info["file_data"],
                mime_type=file_info["mime_type"],
                original_name=file_info["filename"],
                file_type=file_info["file_type"],
            )
            
            attachments.append({
                "id": str(attachment.id),
                "type": "image",
                "filename": attachment.original_name,
                "mime_type": attachment.mime_type,
                "size": attachment.file_size,
                "url": f"/api/v1/communications/media/{attachment.file_path}",
            })
    
    # Оновити повідомлення з інформацією про вкладення
    if attachments:
        import json
        from sqlalchemy import text
        
        # Якщо немає тексту і є attachments — не ставимо [Пусте повідомлення]
        if not content:
            content = ""
        
        db.execute(text("""
            UPDATE communications_messages 
            SET content = :content, attachments = CAST(:attachments AS jsonb)
            WHERE id = :msg_id
        """), {
            "content": content,
            "attachments": json.dumps(attachments),
            "msg_id": str(temp_message.id)
        })
        db.commit()
        db.refresh(temp_message)
    elif not content:
        # Якщо немає тексту і немає attachments — ставимо placeholder
        content = "[Пусте повідомлення]"
        from sqlalchemy import text
        db.execute(text("""
            UPDATE communications_messages 
            SET content = :content
            WHERE id = :msg_id
        """), {
            "content": content,
            "msg_id": str(temp_message.id)
        })
        db.commit()
        db.refresh(temp_message)
    
    return {
        "status": "processed",
        "message_id": str(temp_message.id),
        "conversation_id": str(temp_message.conversation_id),
    }

