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
    
    # Meta Instagram webhook структура (подібна до Facebook Messenger):
    # {
    #     "object": "instagram",
    #     "entry": [{
    #         "id": "...",
    #         "time": 1234567890,
    #         "messaging": [{
    #             "sender": {"id": "INSTAGRAM_USER_ID"},
    #             "recipient": {"id": "INSTAGRAM_PAGE_ID"},
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
            
            sender_id = sender.get("id")  # Instagram User ID
            content = message_data.get("text", "")
            
            # Отримати інформацію про відправника
            sender_info = {
                "instagram_id": sender_id,
                "name": "Instagram User",  # Можна отримати через Graph API
            }
            
            # Обробити вкладення
            attachments = []
            if "attachments" in message_data:
                for att in message_data["attachments"]:
                    attachments.append({
                        "type": att.get("type"),
                        "url": att.get("payload", {}).get("url"),
                        "title": att.get("title"),
                    })
            
            # Обробити вхідне повідомлення
            message = await service.receive_message(
                external_id=sender_id,
                content=content,
                sender_info=sender_info,
                attachments=attachments if attachments else None,
                metadata={
                    "message_id": message_data.get("mid"),
                    "timestamp": event.get("timestamp"),
                },
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

