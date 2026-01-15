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

