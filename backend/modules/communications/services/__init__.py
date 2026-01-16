"""
Messaging services for different platforms.
"""
from .base import MessengerService
from .telegram import TelegramService
from .whatsapp import WhatsAppService
from .email import EmailService
from .facebook import FacebookService

__all__ = [
    "MessengerService",
    "TelegramService",
    "WhatsAppService",
    "EmailService",
    "FacebookService",
]

