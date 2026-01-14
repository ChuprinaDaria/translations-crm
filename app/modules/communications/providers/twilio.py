"""
Twilio provider - альтернативний провайдер для WhatsApp/SMS.
"""
from typing import Dict
import httpx
import logging

from .base import BaseProvider, Message, ProviderResponse

logger = logging.getLogger(__name__)


class TwilioProvider(BaseProvider):
    """
    Провайдер для Twilio API.
    
    Підтримує:
    - WhatsApp через Twilio
    - SMS
    - Voice calls
    """
    
    def __init__(self, config: Dict):
        """
        Ініціалізація Twilio провайдера.
        
        Config має містити:
        - account_sid: Twilio Account SID
        - auth_token: Twilio Auth Token
        - whatsapp_from: WhatsApp номер відправника (формат: whatsapp:+1234567890)
        """
        super().__init__(config)
        self.account_sid = config.get("account_sid")
        self.auth_token = config.get("auth_token")
        self.whatsapp_from = config.get("whatsapp_from")
        self.base_url = f"https://api.twilio.com/2010-04-01/Accounts/{self.account_sid}"
    
    def validate_config(self) -> bool:
        """Перевірити чи конфігурація валідна."""
        if not all([self.account_sid, self.auth_token, self.whatsapp_from]):
            logger.error("Twilio provider: account_sid, auth_token, and whatsapp_from are required")
            return False
        return True
    
    async def send_message(self, message: Message) -> ProviderResponse:
        """Відправити повідомлення через Twilio."""
        if not self.validate_config():
            return ProviderResponse(
                success=False,
                error="Invalid provider configuration"
            )
        
        try:
            url = f"{self.base_url}/Messages.json"
            
            # Twilio використовує form-data
            data = {
                "From": self.whatsapp_from,
                "To": f"whatsapp:{message.recipient_id}",
                "Body": message.text
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    data=data,
                    auth=(self.account_sid, self.auth_token),
                    timeout=30.0
                )
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    return ProviderResponse(
                        success=True,
                        message_id=data.get("sid"),
                        metadata=data
                    )
                else:
                    return ProviderResponse(
                        success=False,
                        error=f"Twilio API error: {response.text}"
                    )
        
        except Exception as e:
            logger.error(f"Failed to send Twilio message: {e}")
            return ProviderResponse(
                success=False,
                error=str(e)
            )
    
    async def verify_webhook(self, signature: str, payload: bytes) -> bool:
        """Twilio використовує X-Twilio-Signature для верифікації."""
        # TODO: Реалізувати Twilio webhook verification
        return True
    
    async def process_webhook(self, payload: dict) -> Dict:
        """Обробити webhook від Twilio."""
        return {
            "provider": "twilio",
            "data": payload
        }
    
    def get_webhook_verification_token(self) -> str:
        """Twilio не використовує verification token."""
        return ""

