"""
Meta API provider - реалізація для Meta (Messenger/WhatsApp).
"""
import hmac
import hashlib
import json
from typing import Dict, Optional
import httpx
import logging

from .base import BaseProvider, Message, ProviderResponse

logger = logging.getLogger(__name__)


class MetaProvider(BaseProvider):
    """
    Провайдер для Meta API (Messenger/WhatsApp Business).
    
    Підтримує:
    - Відправку повідомлень
    - Webhook верифікацію
    - Обробку вхідних повідомлень
    """
    
    def __init__(self, config: Dict):
        """
        Ініціалізація Meta провайдера.
        
        Config має містити:
        - access_token: Access token для Meta API
        - app_secret: App Secret для верифікації webhook
        - verify_token: Verification token для webhook
        - phone_number_id: Phone Number ID (для WhatsApp)
        - api_version: API версія (за замовчуванням v21.0)
        """
        super().__init__(config)
        self.access_token = config.get("access_token")
        self.app_secret = config.get("app_secret")
        self.verify_token = config.get("verify_token", "default_verify_token")
        self.phone_number_id = config.get("phone_number_id")
        self.api_version = config.get("api_version", "v21.0")
        self.base_url = f"https://graph.facebook.com/{self.api_version}"
    
    def validate_config(self) -> bool:
        """Перевірити чи конфігурація валідна."""
        if not self.access_token:
            logger.error("Meta provider: access_token is required")
            return False
        if not self.app_secret:
            logger.warning("Meta provider: app_secret not set, webhook verification will fail")
        return True
    
    async def send_message(self, message: Message) -> ProviderResponse:
        """
        Відправити повідомлення через Meta API.
        
        Для WhatsApp використовує phone_number_id.
        Для Messenger використовує recipient_id напряму.
        """
        if not self.validate_config():
            return ProviderResponse(
                success=False,
                error="Invalid provider configuration"
            )
        
        try:
            # Визначаємо чи це WhatsApp чи Messenger
            is_whatsapp = self.phone_number_id is not None
            
            if is_whatsapp:
                # WhatsApp API
                url = f"{self.base_url}/{self.phone_number_id}/messages"
                payload = {
                    "messaging_product": "whatsapp",
                    "to": message.recipient_id,
                    "type": "text",
                    "text": {"body": message.text}
                }
            else:
                # Messenger API
                url = f"{self.base_url}/me/messages"
                payload = {
                    "recipient": {"id": message.recipient_id},
                    "message": {"text": message.text}
                }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {self.access_token}",
                        "Content-Type": "application/json"
                    },
                    timeout=30.0
                )
                
                if response.status_code == 200:
                    data = response.json()
                    message_id = data.get("messages", [{}])[0].get("id") if is_whatsapp else data.get("message_id")
                    return ProviderResponse(
                        success=True,
                        message_id=message_id,
                        metadata=data
                    )
                else:
                    error_data = response.json()
                    return ProviderResponse(
                        success=False,
                        error=f"Meta API error: {error_data}"
                    )
        
        except Exception as e:
            logger.error(f"Failed to send Meta message: {e}")
            return ProviderResponse(
                success=False,
                error=str(e)
            )
    
    async def verify_webhook(self, signature: str, payload: bytes) -> bool:
        """
        Перевірити підпис webhook від Meta.
        
        Meta використовує HMAC SHA256 для підпису.
        """
        if not self.app_secret:
            logger.warning("Cannot verify webhook: app_secret not set")
            return False
        
        try:
            # Meta підписує payload з app_secret
            expected_signature = hmac.new(
                self.app_secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
            
            # Meta надсилає підпис як "sha256=..."
            received_signature = signature.replace("sha256=", "")
            
            return hmac.compare_digest(expected_signature, received_signature)
        
        except Exception as e:
            logger.error(f"Webhook verification failed: {e}")
            return False
    
    async def process_webhook(self, payload: dict) -> Dict:
        """
        Обробити webhook від Meta.
        
        Повертає структуровані дані для збереження в БД.
        """
        try:
            # Meta надсилає дані в форматі:
            # {
            #   "object": "whatsapp_business_account" | "page",
            #   "entry": [...]
            # }
            
            result = {
                "provider": "meta",
                "object": payload.get("object"),
                "entries": []
            }
            
            for entry in payload.get("entry", []):
                entry_data = {
                    "id": entry.get("id"),
                    "time": entry.get("time"),
                    "changes": []
                }
                
                for change in entry.get("changes", []):
                    change_data = {
                        "value": change.get("value"),
                        "field": change.get("field")
                    }
                    entry_data["changes"].append(change_data)
                
                result["entries"].append(entry_data)
            
            return result
        
        except Exception as e:
            logger.error(f"Failed to process Meta webhook: {e}")
            return {"error": str(e)}
    
    def get_webhook_verification_token(self) -> str:
        """Отримати verification token для Meta webhook."""
        return self.verify_token

