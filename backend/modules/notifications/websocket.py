"""
WebSocket Manager for Real-time Notifications
"""
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
from uuid import UUID
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time notifications"""
    
    def __init__(self):
        self.active_connections: Dict[UUID, WebSocket] = {}
    
    async def connect(self, user_id: UUID, websocket: WebSocket):
        """Accept and store WebSocket connection"""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected: user={user_id}")
        
        # Send welcome message
        await self.send_personal_notification(
            user_id,
            {
                "type": "connection_established",
                "message": "З'єднання встановлено",
            }
        )
    
    def disconnect(self, user_id: UUID):
        """Remove WebSocket connection"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected: user={user_id}")
    
    async def send_personal_notification(self, user_id: UUID, notification: dict):
        """Send notification to specific user"""
        if user_id in self.active_connections:
            try:
                websocket = self.active_connections[user_id]
                await websocket.send_json(notification)
                logger.debug(f"Notification sent to user={user_id}: {notification.get('type')}")
            except Exception as e:
                logger.error(f"Failed to send notification to user={user_id}: {e}")
                # Remove broken connection
                self.disconnect(user_id)
    
    async def broadcast(self, notification: dict, exclude_user: UUID = None):
        """Send notification to all connected users (except excluded)"""
        disconnected = []
        
        for user_id, websocket in self.active_connections.items():
            if exclude_user and user_id == exclude_user:
                continue
            
            try:
                await websocket.send_json(notification)
            except Exception as e:
                logger.error(f"Failed to broadcast to user={user_id}: {e}")
                disconnected.append(user_id)
        
        # Clean up disconnected users
        for user_id in disconnected:
            self.disconnect(user_id)


# Global instance
manager = ConnectionManager()


# Notification helpers
async def notify_new_message(user_id: UUID, conversation_id: str, message_preview: str, sender: str):
    """Notify about new message in conversation"""
    await manager.send_personal_notification(user_id, {
        "type": "new_message",
        "title": "💬 Нове повідомлення",
        "message": f"{sender}: {message_preview}",
        "conversation_id": conversation_id,
        "action_url": f"/communications?conversation={conversation_id}",
        "sound": True,
    })


async def notify_payment_received(user_id: UUID, order_id: str, order_number: str, amount: float):
    """Notify about payment received"""
    await manager.send_personal_notification(user_id, {
        "type": "payment_received",
        "title": "💰 Оплату отримано!",
        "message": f"Замовлення {order_number}: {amount} zł",
        "order_id": order_id,
        "action_url": f"/crm/orders/{order_id}",
        "sound": True,
    })


async def notify_translator_response(user_id: UUID, order_id: str, order_number: str, translator_name: str, accepted: bool):
    """Notify about translator response"""
    if accepted:
        await manager.send_personal_notification(user_id, {
            "type": "translator_accepted",
            "title": "✅ Перекладач прийняв замовлення",
            "message": f"{translator_name} → {order_number}",
            "order_id": order_id,
            "action_url": f"/crm/orders/{order_id}",
            "sound": True,
        })
    else:
        await manager.send_personal_notification(user_id, {
            "type": "translator_declined",
            "title": "❌ Перекладач відхилив замовлення",
            "message": f"{translator_name} → {order_number}",
            "order_id": order_id,
            "action_url": f"/crm/orders/{order_id}",
            "sound": False,
        })


async def notify_translation_ready(user_id: UUID, order_id: str, order_number: str, translator_name: str):
    """Notify about translation completed"""
    await manager.send_personal_notification(user_id, {
        "type": "translation_ready",
        "title": "✅ Переклад завершено",
        "message": f"{translator_name} завершив {order_number}",
        "order_id": order_id,
        "action_url": f"/crm/orders/{order_id}",
        "sound": True,
    })


async def notify_internal_note(user_id: UUID, entity_type: str, entity_id: str, author_name: str, note_preview: str):
    """Notify about new internal note"""
    await manager.send_personal_notification(user_id, {
        "type": "internal_note",
        "title": "📝 Нова нотатка",
        "message": f"{author_name}: {note_preview}",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action_url": f"/crm/{entity_type}s/{entity_id}",
        "sound": False,
    })


async def notify_deadline_warning(user_id: UUID, order_id: str, order_number: str, hours_left: int):
    """Notify about approaching deadline"""
    await manager.send_personal_notification(user_id, {
        "type": "deadline_warning",
        "title": f"⚠️ Дедлайн через {hours_left} год!",
        "message": f"Замовлення {order_number}",
        "order_id": order_id,
        "action_url": f"/crm/orders/{order_id}",
        "sound": hours_left <= 2,  # Sound only if very urgent
    })

