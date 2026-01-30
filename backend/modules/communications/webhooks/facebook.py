"""
Facebook Messenger webhook handler for Meta Messenger API.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from modules.communications.services.facebook import FacebookService


async def handle_facebook_webhook(
    db: Session,
    webhook_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Обробити webhook від Facebook Messenger (Meta Messenger API).
    
    Args:
        db: Database session
        webhook_data: Дані з webhook
        
    Returns:
        Результат обробки
    """
    service = FacebookService(db)
    
    # Meta Messenger webhook структура:
    # {
    #     "object": "page",
    #     "entry": [{
    #         "id": "...",
    #         "time": 1234567890,
    #         "messaging": [{
    #             "sender": {"id": "PSID"},
    #             "recipient": {"id": "PAGE_ID"},
    #             "timestamp": 1234567890,
    #             "message": {
    #                 "mid": "...",
    #                 "text": "Hello",
    #                 "attachments": [...]
    #             }
    #         }]
    #     }]
    # }
    
    entries = webhook_data.get("entry", [])
    results = []
    
    for entry in entries:
        messaging = entry.get("messaging", [])
        
        for event in messaging:
            # Перевірити, чи це повідомлення (не delivery, read тощо)
            if "message" not in event:
                continue
            
            sender = event.get("sender", {})
            message_data = event.get("message", {})
            
            sender_id = sender.get("id")  # PSID (Page-Scoped ID)
            content = message_data.get("text", "")
            
            # Отримати інформацію про відправника
            sender_info = {
                "facebook_id": sender_id,
                "name": "Facebook User",  # Можна отримати через Graph API
            }
            
            # Спочатку створюємо повідомлення, щоб отримати message_id для збереження файлів
            temp_message = await service.receive_message(
                external_id=sender_id,
                content=content,
                sender_info=sender_info,
                attachments=None,  # Спочатку без вкладень
                metadata={
                    "message_id": message_data.get("mid"),
                    "timestamp": event.get("timestamp"),
                },
            )
            
            # Обробити вкладення - завантажити та зберегти
            attachments = []
            if "attachments" in message_data:
                from modules.communications.utils.media import download_and_save_media
                from uuid import UUID
                
                access_token = service.config.get("access_token")
                headers = {"Authorization": f"Bearer {access_token}"} if access_token else None
                
                for att in message_data["attachments"]:
                    url = att.get("payload", {}).get("url")
                    att_type = att.get("type", "image")
                    title = att.get("title", "")
                    
                    # Визначити mime_type та original_name
                    mime_type = "image/jpeg"  # За замовчуванням
                    if att_type == "video":
                        mime_type = "video/mp4"
                    elif att_type == "audio":
                        mime_type = "audio/mpeg"
                    elif att_type == "file":
                        mime_type = "application/octet-stream"
                    
                    original_name = title or f"facebook_{att_type}_{sender_id[:10]}"
                    if att_type == "image" and not original_name.endswith((".jpg", ".jpeg", ".png")):
                        original_name += ".jpg"
                    elif att_type == "video" and not original_name.endswith((".mp4", ".mov")):
                        original_name += ".mp4"
                    
                    if url:
                        # Завантажити та зберегти (Meta API потребує access_token в заголовках)
                        attachment = await download_and_save_media(
                            db=db,
                            message_id=UUID(str(temp_message.id)),
                            url=url,
                            mime_type=mime_type,
                            original_name=original_name,
                            file_type=att_type,
                            headers=headers,  # Передаємо access_token для Meta API
                        )
                        if attachment:
                            attachments.append({
                                "id": str(attachment.id),
                                "type": att_type,
                                "filename": attachment.original_name,
                                "mime_type": attachment.mime_type,
                                "size": attachment.file_size,
                                "url": f"/api/v1/communications/media/{attachment.file_path}",
                            })
            
            # Оновити повідомлення з інформацією про вкладення
            if attachments:
                import json
                from sqlalchemy import text
                
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

