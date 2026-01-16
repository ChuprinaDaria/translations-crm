"""
Provider factory - створює провайдерів на основі конфігурації.
"""
from typing import Dict, Optional
import logging

from .base import BaseProvider
from .meta import MetaProvider
from .twilio import TwilioProvider

logger = logging.getLogger(__name__)


class ProviderFactory:
    """
    Фабрика для створення провайдерів комунікацій.
    
    Підтримує:
    - meta: Meta API (Messenger/WhatsApp)
    - twilio: Twilio API
    """
    
    _providers = {
        "meta": MetaProvider,
        "twilio": TwilioProvider,
    }
    
    @classmethod
    def create_provider(cls, provider_type: str, config: Dict) -> Optional[BaseProvider]:
        """
        Створити провайдера.
        
        Args:
            provider_type: Тип провайдера ("meta", "twilio")
            config: Конфігурація провайдера
            
        Returns:
            Екземпляр провайдера або None якщо тип не підтримується
        """
        provider_class = cls._providers.get(provider_type.lower())
        
        if not provider_class:
            logger.error(f"Unknown provider type: {provider_type}")
            return None
        
        try:
            provider = provider_class(config)
            if not provider.validate_config():
                logger.error(f"Invalid configuration for provider {provider_type}")
                return None
            return provider
        except Exception as e:
            logger.error(f"Failed to create provider {provider_type}: {e}")
            return None
    
    @classmethod
    def register_provider(cls, provider_type: str, provider_class: type):
        """
        Зареєструвати новий тип провайдера.
        
        Args:
            provider_type: Назва типу провайдера
            provider_class: Клас провайдера (має наслідувати BaseProvider)
        """
        cls._providers[provider_type.lower()] = provider_class
        logger.info(f"Registered provider type: {provider_type}")

