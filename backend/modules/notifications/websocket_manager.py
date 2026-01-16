"""
WebSocket Connection Manager для нотифікацій
"""
from typing import Dict, Set
from fastapi import WebSocket, WebSocketDisconnect
from uuid import UUID
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Менеджер WebSocket з'єднань для нотифікацій"""
    
    def __init__(self):
        # Зберігаємо активні з'єднання: user_id -> WebSocket
        self.active_connections: Dict[UUID, WebSocket] = {}
    
    async def connect(self, user_id: UUID, websocket: WebSocket):
        """Підключити користувача до WebSocket"""
        await websocket.accept()
        # Якщо вже є з'єднання, закриваємо старе
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].close()
            except Exception as e:
                logger.warning(f"Error closing old connection for user {user_id}: {e}")
        
        self.active_connections[user_id] = websocket
        logger.info(f"User {user_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, user_id: UUID):
        """Відключити користувача"""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"User {user_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_notification(self, user_id: UUID, notification: dict):
        """Відправити нотифікацію користувачу через WebSocket"""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            try:
                await websocket.send_json(notification)
                logger.debug(f"Notification sent to user {user_id}")
                return True
            except Exception as e:
                logger.error(f"Error sending notification to user {user_id}: {e}")
                # Видаляємо з'єднання при помилці
                self.disconnect(user_id)
                return False
        else:
            logger.debug(f"User {user_id} is not connected")
            return False
    
    async def broadcast(self, notification: dict, user_ids: Set[UUID] = None):
        """Відправити нотифікацію кільком користувачам"""
        if user_ids:
            for user_id in user_ids:
                await self.send_notification(user_id, notification)
        else:
            # Відправити всім підключеним
            for user_id, websocket in list(self.active_connections.items()):
                try:
                    await websocket.send_json(notification)
                except Exception as e:
                    logger.error(f"Error broadcasting to user {user_id}: {e}")
                    self.disconnect(user_id)
    
    def is_connected(self, user_id: UUID) -> bool:
        """Перевірити чи користувач підключений"""
        return user_id in self.active_connections


# Глобальний менеджер з'єднань
manager = ConnectionManager()

