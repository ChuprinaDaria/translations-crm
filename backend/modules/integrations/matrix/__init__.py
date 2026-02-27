"""
Matrix Bridge Integration - WhatsApp через mautrix-whatsapp.
"""
from .schemas import MatrixConfig, MatrixRoomInfo, MatrixEventInfo

try:
    from .provider import MatrixProvider
    from .service import MatrixWhatsAppService
except Exception:
    MatrixProvider = None  # type: ignore[assignment,misc]
    MatrixWhatsAppService = None  # type: ignore[assignment,misc]

__all__ = [
    "MatrixProvider",
    "MatrixWhatsAppService",
    "MatrixConfig",
    "MatrixRoomInfo",
    "MatrixEventInfo",
]

