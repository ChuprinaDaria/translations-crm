from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from db import Base, engine
from core.config import settings
from modules.auth.router import router as auth_router
from modules.auth.models import User
from modules.crm.router import router as crm_router
from modules.crm.models import Client, Order, InternalNote, TimelineStep, Translator, TranslatorLanguage, TranslationRequest, Office, Language, Specialization, TranslatorLanguageRate
from modules.finance.router import router as finance_router
from modules.finance.models import Transaction
from modules.communications.router import router as communications_router, messages_manager
from modules.communications.models import Conversation, Message
from modules.notifications.router import router as notifications_router
from modules.notifications.models import Notification, NotificationSettings
from modules.smart_paste.router import router as smart_paste_router
from modules.drag_upload.router import router as drag_upload_router
from modules.audio_notes.router import router as audio_notes_router
from routes import router as legacy_router
# Імпортуємо моделі з routes для автоматичного створення таблиць
import models  # noqa: F401
import logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables using synchronous engine
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="CRM System",
    lifespan=lifespan
)

# CORS налаштування
import os
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
# Дозволяємо запити з localhost (dev) та production домену
allowed_origins = [
    "http://localhost:5173",
    "ws://localhost:5173",
    "https://tlumaczeniamt.com.pl",
    "http://tlumaczeniamt.com.pl",
    "https://www.tlumaczeniamt.com.pl",
    "http://www.tlumaczeniamt.com.pl",
    "http://5.78.152.139:8082",
]
# Додаємо FRONTEND_URL якщо він встановлений
if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)
    # Додаємо також ws:// версію для WebSocket
    if FRONTEND_URL.startswith("http://"):
        allowed_origins.append(FRONTEND_URL.replace("http://", "ws://"))
    elif FRONTEND_URL.startswith("https://"):
        allowed_origins.append(FRONTEND_URL.replace("https://", "wss://"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)}
    )


app.include_router(auth_router, prefix="/auth")
app.include_router(crm_router, prefix="/api/v1/crm")
app.include_router(finance_router, prefix="/api/v1/finance")
app.include_router(communications_router, prefix="/api/v1/communications")
app.include_router(notifications_router, prefix="/api/v1/notifications")
app.include_router(smart_paste_router, prefix="/api/v1")
app.include_router(drag_upload_router, prefix="/api/v1")
app.include_router(audio_notes_router, prefix="/api/v1")
app.include_router(legacy_router, prefix="/api/v1")


@app.get("/")
def root():
    """Root endpoint - simple health check."""
    return {"status": "ok", "service": "CRM System"}


@app.get("/health")
def health_check():
    """Health check endpoint for deployment monitoring."""
    try:
        # Simple database connectivity check
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "error": str(e)}
        )


# WebSocket endpoint for real-time messages (defined at app level to avoid middleware issues)
@app.websocket("/api/v1/communications/ws/{user_id}")
async def websocket_messages_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time message updates."""
    logger.info(f"WebSocket connection attempt from user: {user_id}")
    
    try:
        await websocket.accept()
        logger.info(f"WebSocket accepted for user: {user_id}")
        messages_manager.active_connections[user_id] = websocket
        
        # Send welcome message
        await websocket.send_json({
            "type": "connection_established",
            "message": "Connected to real-time messages"
        })
        
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user: {user_id}")
        messages_manager.disconnect(user_id)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        messages_manager.disconnect(user_id)


# Endpoint to broadcast a new message notification (used by telegram_listener.py)
@app.post("/api/v1/communications/broadcast-message")
async def broadcast_message(notification: dict = None):
    """Broadcast a new message notification to all connected WebSocket clients."""
    from uuid import uuid4
    from datetime import datetime
    from fastapi import Body
    
    logger.info(f"Broadcast endpoint called. Active connections: {list(messages_manager.active_connections.keys())}")
    
    if notification:
        # Use provided notification
        logger.info(f"Broadcasting notification: {notification.get('type')} for conversation: {notification.get('conversation_id')}")
        await messages_manager.broadcast(notification)
        return {"status": "ok", "message": "Notification broadcast", "connected_users": len(messages_manager.active_connections)}
    
    # Default test message
    test_message = {
        "type": "new_message",
        "conversation_id": "test-conv-id",
        "message": {
            "id": str(uuid4()),
            "conversation_id": "test-conv-id",
            "direction": "inbound",
            "type": "text",
            "content": "🔔 Це тестове повідомлення для перевірки сповіщень!",
            "status": "sent",
            "created_at": datetime.utcnow().isoformat(),
        },
        "conversation": {
            "id": "test-conv-id",
            "platform": "telegram",
            "external_id": "+380501234567",
            "client_name": "Тестовий Клієнт",
        }
    }
    
    await messages_manager.broadcast(test_message)
    
    return {"status": "ok", "message": "Test notification sent", "connected_users": len(messages_manager.active_connections)}


# Test endpoint (kept for backward compatibility)
@app.post("/api/v1/communications/test-notification")
async def send_test_notification(notification: dict = None):
    """Send a test notification to all connected WebSocket clients."""
    return await broadcast_message(notification)
