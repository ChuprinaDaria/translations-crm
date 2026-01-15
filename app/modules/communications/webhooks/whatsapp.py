"""
WhatsApp webhook handler for Meta Business API.
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from modules.communications.services.whatsapp import WhatsAppService


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
                
                # Обробити вкладення
                attachments = []
                if msg_type in ["image", "document", "video", "audio"]:
                    media_data = msg.get(msg_type, {})
                    attachments.append({
                        "type": msg_type,
                        "id": media_data.get("id"),
                        "mime_type": media_data.get("mime_type"),
                        "filename": media_data.get("filename"),
                    })
                
                # Обробити вхідне повідомлення
                message = await service.receive_message(
                    external_id=from_id,
                    content=content,
                    sender_info=sender_info,
                    attachments=attachments if attachments else None,
                    metadata={
                        "message_id": msg.get("id"),
                        "timestamp": msg.get("timestamp"),
                        "type": msg_type,
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

