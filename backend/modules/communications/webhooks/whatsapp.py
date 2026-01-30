"""
WhatsApp webhook handler for Meta Business API.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session
import httpx

from modules.communications.services.whatsapp import WhatsAppService
from modules.communications.utils.media import save_media_file


async def handle_whatsapp_webhook(
    db: Session,
    webhook_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Обробити webhook від WhatsApp (Meta Business API).
    
    Args:
        db: Database session
        webhook_data: Дані з webhook
        
    Returns:
        Результат обробки
    """
    service = WhatsAppService(db)
    
    # Meta webhook структура:
    # {
    #     "object": "whatsapp_business_account",
    #     "entry": [{
    #         "id": "...",
    #         "changes": [{
    #             "value": {
    #                 "messaging_product": "whatsapp",
    #                 "metadata": {
    #                     "display_phone_number": "...",
    #                     "phone_number_id": "..."
    #                 },
    #                 "contacts": [{
    #                     "profile": {"name": "John"},
    #                     "wa_id": "1234567890"
    #                 }],
    #                 "messages": [{
    #                     "from": "1234567890",
    #                     "id": "...",
    #                     "timestamp": "1234567890",
    #                     "type": "text",
    #                     "text": {"body": "Hello"}
    #                 }]
    #             }
    #         }]
    #     }]
    # }
    
    entries = webhook_data.get("entry", [])
    results = []
    
    for entry in entries:
        changes = entry.get("changes", [])
        
        for change in changes:
            value = change.get("value", {})
            messages = value.get("messages", [])
            contacts = value.get("contacts", [])
            
            # Створити словник контактів
            contacts_map = {}
            for contact in contacts:
                wa_id = contact.get("wa_id")
                profile = contact.get("profile", {})
                contacts_map[wa_id] = {
                    "name": profile.get("name", ""),
                    "phone": wa_id,
                }
            
            # Обробити кожне повідомлення
            for msg in messages:
                from_id = msg.get("from")
                msg_type = msg.get("type")
                
                # Отримати текст повідомлення
                content = ""
                if msg_type == "text":
                    content = msg.get("text", {}).get("body", "")
                elif msg_type == "image" or msg_type == "document":
                    # Для медіа повідомлень можна додати опис
                    caption = msg.get(msg_type, {}).get("caption", "")
                    content = caption or f"[{msg_type}]"
                
                # Отримати інформацію про відправника
                sender_info = contacts_map.get(from_id, {
                    "name": "Unknown",
                    "phone": from_id,
                })
                
                # Спочатку створюємо повідомлення, щоб отримати message_id для збереження файлів
                temp_message = await service.receive_message(
                    external_id=from_id,
                    content=content,
                    sender_info=sender_info,
                    attachments=None,  # Спочатку без вкладень
                    metadata={
                        "message_id": msg.get("id"),
                        "timestamp": msg.get("timestamp"),
                        "type": msg_type,
                    },
                )
                
                # Обробити вкладення - завантажити та зберегти
                attachments = []
                if msg_type in ["image", "document", "video", "audio"]:
                    from modules.communications.utils.media import download_and_save_media
                    from uuid import UUID
                    
                    media_data = msg.get(msg_type, {})
                    media_id = media_data.get("id")
                    mime_type = media_data.get("mime_type", "application/octet-stream")
                    filename = media_data.get("filename") or f"{msg_type}_{media_id[:10]}"
                    
                    if media_id:
                        # Отримати URL для завантаження через Meta API
                        access_token = service.config.get("access_token")
                        if access_token:
                            try:
                                async with httpx.AsyncClient(timeout=30.0) as client:
                                    # Отримати URL файлу
                                    url = f"{service.base_url}/{media_id}"
                                    headers = {"Authorization": f"Bearer {access_token}"}
                                    response = await client.get(url, headers=headers)
                                    response.raise_for_status()
                                    file_info = response.json()
                                    
                                    # Завантажити файл
                                    file_url = file_info.get("url")
                                    if file_url:
                                        # Завантажити файл (потрібен access_token в заголовку)
                                        file_response = await client.get(
                                            file_url,
                                            headers=headers,
                                            timeout=60.0
                                        )
                                        file_response.raise_for_status()
                                        
                                        # Визначити розширення файлу
                                        if not filename or "." not in filename:
                                            # Спробувати визначити з mime_type
                                            ext_map = {
                                                "image/jpeg": ".jpg",
                                                "image/png": ".png",
                                                "image/gif": ".gif",
                                                "image/webp": ".webp",
                                                "video/mp4": ".mp4",
                                                "video/quicktime": ".mov",
                                                "audio/mpeg": ".mp3",
                                                "audio/ogg": ".ogg",
                                                "application/pdf": ".pdf",
                                            }
                                            ext = ext_map.get(mime_type, "")
                                            if not filename:
                                                filename = f"{msg_type}{ext}"
                                            elif not filename.endswith(ext):
                                                filename = filename + ext
                                        
                                        # Зберегти файл
                                        attachment = save_media_file(
                                            db=db,
                                            message_id=UUID(str(temp_message.id)),
                                            file_data=file_response.content,
                                            mime_type=mime_type,
                                            original_name=filename,
                                            file_type=msg_type,
                                        )
                                        
                                        if attachment:
                                            attachments.append({
                                                "id": str(attachment.id),
                                                "type": msg_type,
                                                "filename": attachment.original_name,
                                                "mime_type": attachment.mime_type,
                                                "size": attachment.file_size,
                                                "url": f"/api/v1/communications/files/{attachment.id}",
                                            })
                            except Exception as e:
                                import logging
                                logging.getLogger(__name__).error(f"Failed to download WhatsApp media {media_id}: {e}", exc_info=True)
                
                # Оновити повідомлення з інформацією про вкладення
                if attachments:
                    import json
                    from sqlalchemy import text
                    
                    # Якщо немає тексту і є attachments — не ставимо placeholder
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
                
                message = temp_message
                
                results.append({
                    "status": "processed",
                    "message_id": str(message.id),
                    "conversation_id": str(message.conversation_id),
                })
    
    return {
        "status": "processed",
        "results": results,
    }

