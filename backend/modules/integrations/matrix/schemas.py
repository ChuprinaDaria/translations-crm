"""
Matrix Bridge schemas - Pydantic моделі для Matrix інтеграції.
"""
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime


class MatrixSystemConfig(BaseModel):
    """Системна конфігурація Matrix (вводить адмін)."""
    homeserver_url: str  # https://matrix.your-server.com
    server_name: str  # your-server.com (для формування user ID)
    admin_login: str  # Логін головного адміна
    admin_password: str  # Пароль головного адміна
    bridge_admin_secret: str  # Токен з registration.yaml


class MatrixUserConfig(BaseModel):
    """Конфігурація Matrix користувача (автоматично генерується)."""
    user_id: str  # @user:server.com
    access_token: str  # Отримується при логіні, зберігається в БД
    device_id: Optional[str] = None  # Генерується Matrix при логіні


class MatrixConfig(BaseModel):
    """Конфігурація Matrix клієнта (legacy, для сумісності)."""
    homeserver: str
    access_token: str
    user_id: Optional[str] = None
    device_id: Optional[str] = None


class MatrixQRResponse(BaseModel):
    """Відповідь з QR-кодом для підключення WhatsApp."""
    qr_code: str  # Base64 або raw текст QR-коду
    qr_url: Optional[str] = None  # URL для відображення QR-коду
    expires_at: Optional[datetime] = None  # Коли QR-код стане невалідним


class MatrixRoomInfo(BaseModel):
    """Інформація про Matrix кімнату."""
    room_id: str
    name: Optional[str] = None
    topic: Optional[str] = None
    members: List[str] = []
    is_direct: bool = False
    metadata: Optional[Dict[str, Any]] = None


class MatrixEventInfo(BaseModel):
    """Інформація про Matrix подію."""
    event_id: str
    room_id: str
    sender: str
    event_type: str
    content: Dict[str, Any]
    timestamp: datetime
    metadata: Optional[Dict[str, Any]] = None


class MatrixMessageContent(BaseModel):
    """Контент Matrix повідомлення."""
    body: str
    msgtype: str  # m.text, m.image, m.video, etc.
    format: Optional[str] = None
    formatted_body: Optional[str] = None
    url: Optional[str] = None  # Для медіа
    info: Optional[Dict[str, Any]] = None  # Метадані медіа


class MatrixSyncResponse(BaseModel):
    """Відповідь від Matrix sync API."""
    next_batch: str
    rooms: Optional[Dict[str, Any]] = None
    presence: Optional[Dict[str, Any]] = None
    account_data: Optional[Dict[str, Any]] = None

