"""
Webhook handlers for incoming messages from different platforms.
"""
from .telegram import handle_telegram_webhook
from .whatsapp import handle_whatsapp_webhook
from .facebook import handle_facebook_webhook

__all__ = [
    "handle_telegram_webhook",
    "handle_whatsapp_webhook",
    "handle_facebook_webhook",
]

