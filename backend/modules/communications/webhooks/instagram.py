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
            
            # Обробити вкладення
            attachments = []
            if "attachments" in message_data:
                for att in message_data["attachments"]:
                    attachments.append({
                        "type": att.get("type"),
                        "url": att.get("payload", {}).get("url"),
                        "title": att.get("title"),
                    })
            
            # Обробити повідомлення
            message = await service.receive_message(
                external_id=external_id_to_use,  # Використовуємо @username якщо є, інакше IGSID
                content=content,
                sender_info=sender_info,
                attachments=attachments if attachments else None,
                metadata={
                    "message_id": message_data.get("mid"),
                    "timestamp": event.get("timestamp"),
                    "sender_id": sender_id,
                    "recipient_id": recipient_id,
                    "igsid": client_igsid,  # Зберігаємо оригінальний IGSID в metadata
                },
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

