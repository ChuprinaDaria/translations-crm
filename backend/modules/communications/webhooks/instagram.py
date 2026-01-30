"""
Instagram Direct Messages webhook handler for Meta Instagram Graph API.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from modules.communications.services.instagram import InstagramService


async def handle_instagram_webhook(
    db: Session,
    webhook_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Обробити webhook від Instagram Direct Messages (Meta Instagram Graph API).
    
    Args:
        db: Database session
        webhook_data: Дані з webhook
        
    Returns:
        Результат обробки
    """
    service = InstagramService(db)
    
    # Отримати наш Instagram Business Account ID (page_id) для порівняння
    instagram_business_account_id = service.config.get("page_id", "")
    
    # Meta Instagram webhook структура (подібна до Facebook Messenger):
    # {
    #     "object": "instagram",
    #     "entry": [{
    #         "id": "...",
    #         "time": 1234567890,
    #         "messaging": [{
    #             "sender": {"id": "INSTAGRAM_USER_ID (IGSID)"},
    #             "recipient": {"id": "INSTAGRAM_PAGE_ID (наш Business Account ID)"},
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
            recipient = event.get("recipient", {})
            message_data = event.get("message", {})
            
            sender_id = sender.get("id")  # IGSID (Instagram Scoped ID)
            recipient_id = recipient.get("id")  # Наш Instagram Business Account ID
            
            # Визначити, чи повідомлення від нас (якщо sender_id == наш page_id)
            is_from_me = (sender_id == instagram_business_account_id)
            
            # Якщо повідомлення від нас, то external_id для conversation - це recipient_id (IGSID клієнта)
            # Якщо повідомлення від клієнта, то external_id - це sender_id (IGSID клієнта)
            client_igsid = recipient_id if is_from_me else sender_id
            
            content = message_data.get("text", "")
            
            # Отримати інформацію про відправника через Graph API
            sender_info = {
                "instagram_id": sender_id,
                "name": "Instagram User",  # Буде оновлено через Graph API
            }
            
            # Якщо це повідомлення від клієнта, отримати профіль через Graph API
            username = None
            if not is_from_me:
                try:
                    profile = await service.get_user_profile(sender_id)
                    if profile:
                        sender_info["name"] = profile.get("name") or profile.get("username", "Instagram User")
                        username = profile.get("username")
                        sender_info["username"] = username
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warning(f"Failed to fetch Instagram profile for {sender_id}: {e}")
            
            # Оновити external_id якщо є username (додати @username)
            external_id_to_use = client_igsid
            if username:
                external_id_to_use = f"@{username}"
            
            # Підготувати metadata з усією необхідною інформацією
            # Важливо: metadata має бути dict, не JSON-рядок
            metadata = {
                "message_id": message_data.get("mid"),
                "timestamp": event.get("timestamp"),
                "sender_id": sender_id,
                "recipient_id": recipient_id,
                "igsid": client_igsid,  # Числовий Instagram Scoped ID
            }
            # Додати username якщо є
            if username:
                metadata["username"] = username
            
            # Обробити вкладення - завантажити з URL та зберегти
            attachments = []
            if "attachments" in message_data:
                from modules.communications.utils.media import download_and_save_media
                from uuid import UUID
                
                # Спочатку створюємо повідомлення, щоб отримати message_id
                temp_message = await service.receive_message(
                    external_id=external_id_to_use,
                    content=content,
                    sender_info=sender_info,
                    attachments=None,  # Спочатку без вкладень
                    metadata=metadata,
                    is_from_me=is_from_me,
                )
                
                # Завантажити та зберегти вкладення
                for att in message_data["attachments"]:
                    url = att.get("payload", {}).get("url")
                    att_type = att.get("type", "image")
                    mime_type = "image/jpeg"  # За замовчуванням для Instagram
                    if att_type == "video":
                        mime_type = "video/mp4"
                    elif att_type == "audio":
                        mime_type = "audio/mpeg"
                    
                    original_name = f"instagram_{att_type}_{sender_id[:10]}.jpg"
                    if att_type == "video":
                        original_name = f"instagram_video_{sender_id[:10]}.mp4"
                    
                    if url:
                        # Завантажити та зберегти (Meta API потребує access_token в заголовках)
                        access_token = service.config.get("access_token")
                        headers = {"Authorization": f"Bearer {access_token}"} if access_token else None
                        
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
            else:
                # Обробити повідомлення без вкладень
                message = await service.receive_message(
                    external_id=external_id_to_use,
                    content=content,
                    sender_info=sender_info,
                    attachments=None,
                    metadata=metadata,
                    is_from_me=is_from_me,
                )
            
            results.append({
                "status": "processed",
                "message_id": str(message.id),
                "conversation_id": str(message.conversation_id),
            })
    
    return {
        "status": "processed",
        "results": results,
    }

