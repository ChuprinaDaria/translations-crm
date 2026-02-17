"""
Matrix Provider - клієнт для Matrix через matrix-nio.
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone

try:
    from nio import AsyncClient, MatrixRoom, RoomMessageText, RoomMessageMedia, RoomMessage, RoomEncryptedMedia
    from nio.responses import SyncResponse, RoomSendResponse
    MATRIX_NIO_AVAILABLE = True
except ImportError:
    MATRIX_NIO_AVAILABLE = False
    logging.warning("matrix-nio not installed. Install with: pip install matrix-nio")

from .schemas import MatrixConfig, MatrixRoomInfo, MatrixEventInfo
from .mapper import MatrixMapper

logger = logging.getLogger(__name__)


class MatrixProvider:
    """
    Провайдер для роботи з Matrix через matrix-nio AsyncClient.
    
    Виступає як клієнт до mautrix-whatsapp bridge.
    """
    
    def __init__(self, config: MatrixConfig):
        """
        Ініціалізація Matrix провайдера.
        
        Args:
            config: Конфігурація Matrix клієнта
        """
        if not MATRIX_NIO_AVAILABLE:
            raise ImportError("matrix-nio is required. Install with: pip install matrix-nio")
        
        self.config = config
        self.client: Optional[AsyncClient] = None
        self.sync_token: Optional[str] = None
    
    async def connect(self) -> None:
        """Підключитися до Matrix homeserver."""
        if self.client:
            return
        
        self.client = AsyncClient(
            homeserver=self.config.homeserver,
            user=self.config.user_id or "",
            access_token=self.config.access_token,
            device_id=self.config.device_id,
        )
        
        # Перевіряємо підключення
        try:
            response = await self.client.whoami()
            if response.user_id:
                logger.info(f"✅ Matrix connected as {response.user_id}")
                self.config.user_id = response.user_id
            else:
                raise ValueError("Failed to authenticate with Matrix")
        except Exception as e:
            logger.error(f"Failed to connect to Matrix: {e}")
            raise
    
    async def disconnect(self) -> None:
        """Відключитися від Matrix homeserver."""
        if self.client:
            await self.client.close()
            self.client = None
            logger.info("Matrix disconnected")
    
    async def sync(self, timeout: int = 30000) -> Optional[SyncResponse]:
        """
        Синхронізувати стан з Matrix homeserver.
        
        Args:
            timeout: Timeout в мілісекундах
            
        Returns:
            SyncResponse або None
        """
        if not self.client:
            await self.connect()
        
        try:
            response = await self.client.sync(
                sync_token=self.sync_token,
                timeout=timeout,
            )
            
            if response:
                self.sync_token = response.next_batch
                return response
        except Exception as e:
            logger.error(f"Matrix sync failed: {e}")
            return None
    
    async def get_rooms(self) -> List[MatrixRoomInfo]:
        """
        Отримати список кімнат.
        
        Returns:
            Список MatrixRoomInfo
        """
        if not self.client:
            await self.connect()
        
        rooms = []
        for room_id, room in self.client.rooms.items():
            room_info = MatrixRoomInfo(
                room_id=room_id,
                name=room.name,
                topic=room.topic,
                members=list(room.users.keys()),
                is_direct=room.is_direct if hasattr(room, "is_direct") else False,
                metadata={
                    "aliases": room.aliases if hasattr(room, "aliases") else [],
                },
            )
            rooms.append(room_info)
        
        return rooms
    
    async def get_room_messages(
        self,
        room_id: str,
        limit: int = 50,
        from_token: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Отримати повідомлення з кімнати.
        
        Args:
            room_id: Matrix room ID
            limit: Кількість повідомлень
            from_token: Token для пагінації
            
        Returns:
            Список events
        """
        if not self.client:
            await self.connect()
        
        try:
            response = await self.client.room_messages(
                room_id=room_id,
                start=from_token,
                limit=limit,
            )
            
            if response and hasattr(response, "chunk"):
                events = []
                for event in response.chunk:
                    event_dict = {
                        "event_id": event.event_id,
                        "room_id": room_id,
                        "sender": event.sender,
                        "type": event.type,
                        "content": event.source.get("content", {}),
                        "timestamp": datetime.fromtimestamp(
                            event.server_timestamp / 1000,
                            tz=timezone.utc
                        ),
                    }
                    events.append(event_dict)
                return events
        except Exception as e:
            logger.error(f"Failed to get room messages: {e}")
        
        return []
    
    async def send_text_message(
        self,
        room_id: str,
        text: str,
        formatted: Optional[str] = None,
    ) -> Optional[str]:
        """
        Відправити текстове повідомлення.
        
        Args:
            room_id: Matrix room ID
            text: Текст повідомлення
            formatted: HTML-форматований текст (опціонально)
            
        Returns:
            Event ID або None
        """
        if not self.client:
            await self.connect()
        
        try:
            content = {
                "body": text,
                "msgtype": "m.text",
            }
            
            if formatted:
                content["format"] = "org.matrix.custom.html"
                content["formatted_body"] = formatted
            
            response: RoomSendResponse = await self.client.room_send(
                room_id=room_id,
                message_type="m.room.message",
                content=content,
            )
            
            if response and response.event_id:
                logger.info(f"Message sent to {room_id}: {response.event_id}")
                return response.event_id
        except Exception as e:
            logger.error(f"Failed to send message: {e}")
        
        return None
    
    async def send_media_message(
        self,
        room_id: str,
        url: str,
        msgtype: str,
        body: str,
        info: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Відправити медіа-повідомлення.
        
        Args:
            room_id: Matrix room ID
            url: URL медіа (mxc://)
            msgtype: Тип повідомлення (m.image, m.video, m.audio, m.file)
            body: Опис файлу
            info: Метадані файлу
            
        Returns:
            Event ID або None
        """
        if not self.client:
            await self.connect()
        
        try:
            content = {
                "body": body,
                "msgtype": msgtype,
                "url": url,
            }
            
            if info:
                content["info"] = info
            
            response: RoomSendResponse = await self.client.room_send(
                room_id=room_id,
                message_type="m.room.message",
                content=content,
            )
            
            if response and response.event_id:
                logger.info(f"Media message sent to {room_id}: {response.event_id}")
                return response.event_id
        except Exception as e:
            logger.error(f"Failed to send media message: {e}")
        
        return None
    
    async def upload_media(
        self,
        file_data: bytes,
        content_type: str,
        filename: str,
    ) -> Optional[str]:
        """
        Завантажити медіа на Matrix homeserver.
        
        Args:
            file_data: Дані файлу
            content_type: MIME тип
            filename: Ім'я файлу
            
        Returns:
            MXC URL або None
        """
        if not self.client:
            await self.connect()
        
        try:
            response = await self.client.upload(
                data=file_data,
                content_type=content_type,
                filename=filename,
            )
            
            if response and hasattr(response, "content_uri"):
                return response.content_uri
        except Exception as e:
            logger.error(f"Failed to upload media: {e}")
        
        return None
    
    def parse_sync_events(self, sync_response: SyncResponse) -> List[Dict[str, Any]]:
        """
        Парсити events з SyncResponse.
        
        Args:
            sync_response: SyncResponse від matrix-nio
            
        Returns:
            Список events у форматі dict
        """
        events = []
        
        if not sync_response or not hasattr(sync_response, "rooms"):
            return events
        
        # Обробляємо нові повідомлення
        for room_id, room_data in sync_response.rooms.join.items():
            if hasattr(room_data, "timeline") and room_data.timeline:
                for event in room_data.timeline.events:
                    if isinstance(event, (RoomMessageText, RoomMessageMedia)):
                        event_dict = {
                            "event_id": event.event_id,
                            "room_id": room_id,
                            "sender": event.sender,
                            "type": event.type,
                            "content": event.source.get("content", {}),
                            "timestamp": datetime.fromtimestamp(
                                event.server_timestamp / 1000,
                                tz=timezone.utc
                            ),
                        }
                        events.append(event_dict)
        
        return events
    
    async def create_user(
        self,
        username: str,
        password: str,
        admin_access_token: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Створити нового користувача в Matrix (потрібен admin access token).
        
        Args:
            username: Ім'я користувача (без @ та домену)
            password: Пароль користувача
            admin_access_token: Access token адміна
            
        Returns:
            Dict з user_id та access_token або None
        """
        import httpx
        
        if not self.config.homeserver:
            raise ValueError("Homeserver not configured")
        
        url = f"{self.config.homeserver}/_matrix/client/r0/admin/register"
        headers = {
            "Authorization": f"Bearer {admin_access_token}",
            "Content-Type": "application/json",
        }
        
        # Визначити server name з homeserver URL
        server_name = self.config.homeserver.replace("https://", "").replace("http://", "").split("/")[0]
        if server_name.startswith("matrix."):
            server_name = server_name.replace("matrix.", "")
        
        user_id = f"@{username}:{server_name}"
        
        payload = {
            "username": username,
            "password": password,
            "admin": False,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                result = response.json()
                
                return {
                    "user_id": result.get("user_id", user_id),
                    "access_token": result.get("access_token"),
                    "device_id": result.get("device_id"),
                }
        except Exception as e:
            logger.error(f"Failed to create Matrix user: {e}")
            return None
    
    async def login_user(
        self,
        username: str,
        password: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Залогінити користувача в Matrix та отримати access token.
        
        Args:
            username: Ім'я користувача (без @ та домену) або повний user_id
            password: Пароль користувача
            
        Returns:
            Dict з access_token та device_id або None
        """
        import httpx
        
        if not self.config.homeserver:
            raise ValueError("Homeserver not configured")
        
        url = f"{self.config.homeserver}/_matrix/client/r0/login"
        payload = {
            "type": "m.login.password",
            "user": username,
            "password": password,
        }
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                result = response.json()
                
                return {
                    "access_token": result.get("access_token"),
                    "device_id": result.get("device_id"),
                    "user_id": result.get("user_id"),
                }
        except Exception as e:
            logger.error(f"Failed to login Matrix user: {e}")
            return None

