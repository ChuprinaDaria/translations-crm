"""
Matrix Bridge Integration - WhatsApp через mautrix-whatsapp.
"""
from .provider import MatrixProvider
from .service import MatrixWhatsAppService
from .schemas import MatrixConfig, MatrixRoomInfo, MatrixEventInfo

__all__ = [
    "MatrixProvider",
    "MatrixWhatsAppService",
    "MatrixConfig",
    "MatrixRoomInfo",
    "MatrixEventInfo",
]

