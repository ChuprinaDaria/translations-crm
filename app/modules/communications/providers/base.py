"""
Base provider interface - абстракція для всіх провайдерів комунікацій.
"""
from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from pydantic import BaseModel


class Message(BaseModel):
    """Базовий клас для повідомлення."""
    recipient_id: str
    text: str
    attachments: Optional[List[Dict]] = None
    metadata: Optional[Dict] = None


class ProviderResponse(BaseModel):
    """Відповідь від провайдера."""
    success: bool
    message_id: Optional[str] = None
    error: Optional[str] = None
    metadata: Optional[Dict] = None


class BaseProvider(ABC):
    """
    Базовий інтерфейс для провайдерів комунікацій.
    Всі провайдери повинні реалізувати цей інтерфейс.
    """
    
    def __init__(self, config: Dict):
        """
        Ініціалізація провайдера.
        
        Args:
            config: Конфігурація провайдера (токени, API keys тощо)
        """
        self.config = config
        self.name = self.__class__.__name__
    
    @abstractmethod
    async def send_message(self, message: Message) -> ProviderResponse:
        """
        Відправити повідомлення.
        
        Args:
            message: Об'єкт повідомлення
            
        Returns:
            ProviderResponse з результатом
        """
        pass
    
    @abstractmethod
    async def verify_webhook(self, signature: str, payload: bytes) -> bool:
        """
        Перевірити підпис webhook.
        
        Args:
            signature: Підпис з заголовків
            payload: Тіло запиту
            
        Returns:
            True якщо підпис валідний
        """
        pass
    
    @abstractmethod
    async def process_webhook(self, payload: dict) -> Dict:
        """
        Обробити webhook від провайдера.
        
        Args:
            payload: Дані з webhook
            
        Returns:
            Результат обробки
        """
        pass
    
    @abstractmethod
    def get_webhook_verification_token(self) -> str:
        """
        Отримати токен для верифікації webhook (для Meta API).
        
        Returns:
            Verification token
        """
        pass
    
    def validate_config(self) -> bool:
        """
        Перевірити чи конфігурація валідна.
        
        Returns:
            True якщо конфігурація валідна
        """
        return True

