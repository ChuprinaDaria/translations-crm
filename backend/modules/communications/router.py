"""
Communications routes - unified inbox endpoints for Telegram, Email, etc.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, UploadFile, File, Body, Request, Header, status, Response
from fastapi.responses import FileResponse, PlainTextResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, distinct
from typing import Optional, List, Dict
from uuid import UUID
from pathlib import Path
from pydantic import BaseModel
import logging
import json
import uuid as uuid_module
import os

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
from modules.integrations.dependencies import verify_rag_token
from fastapi import Header
from modules.communications.models import (
    Conversation, 
    Message, 
    PlatformEnum, 
    MessageDirection, 
    MessageType, 
    MessageStatus,
    WhatsAppAccount
)
from modules.communications import schemas
from modules.communications.webhooks import (
    handle_whatsapp_webhook,
    handle_instagram_webhook,
    handle_facebook_webhook,
    handle_telegram_webhook,
)
from modules.communications.router_telegram_webhook import router as telegram_webhook_router
from modules.communications.services.whatsapp import WhatsAppService
from modules.communications.services.instagram import InstagramService
from modules.communications.services.facebook import FacebookService
from modules.crm.models import Client, ClientSource
import models
import crud

logger = logging.getLogger(__name__)

router = APIRouter(tags=["communications"])

# WebSocket connection manager for real-time messages
class MessagesConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"WebSocket connected for user: {user_id}")
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user: {user_id}")
    
    async def send_message(self, user_id: str, message: dict):
        if user_id in self.active_connections:
            try:
                logger.info(f"WebSocket sending message to user {user_id}: {message.get('type', 'unknown')} - {message}")
                await self.active_connections[user_id].send_json(message)
                logger.info(f"WebSocket successfully sent message to user {user_id}")
            except Exception as e:
                logger.error(f"Error sending message to {user_id}: {e}")
                self.disconnect(user_id)
    
    async def broadcast(self, message: dict):
        active_count = len(self.active_connections)
        message_type = message.get('type', 'unknown')
        logger.info(f"Broadcasting {message_type} to {active_count} active WebSocket connections")
        
        if not self.active_connections:
            logger.warning(f"No active WebSocket connections to broadcast {message_type} to!")
            return
        
        success_count = 0
        error_count = 0
        
        for user_id, connection in list(self.active_connections.items()):
            try:
                logger.debug(f"Sending {message_type} to user: {user_id}")
                await connection.send_json(message)
                success_count += 1
                logger.debug(f"Successfully sent {message_type} to user: {user_id}")
            except Exception as e:
                error_count += 1
                logger.error(f"Error broadcasting {message_type} to {user_id}: {e}", exc_info=True)
                self.disconnect(user_id)
        
        logger.info(f"Broadcast {message_type} completed: {success_count} successful, {error_count} errors")

messages_manager = MessagesConnectionManager()


# Dependency для альтернативної авторизації (X-RAG-TOKEN або JWT)
def get_current_user_or_rag(
    request: Request,
    x_rag_token: Optional[str] = Header(None, alias="X-RAG-TOKEN"),
    db: Session = Depends(get_db),
) -> Optional[models.User]:
    """
    Отримати поточного користувача через X-RAG-TOKEN або JWT.
    Якщо є валідний X-RAG-TOKEN - повертає None (RAG авторизація).
    Якщо немає X-RAG-TOKEN - використовує JWT через get_current_user_db.
    """
    from core.security import get_current_user_payload
    import crud_user
    
    # Спочатку перевіряємо X-RAG-TOKEN
    if x_rag_token:
        try:
            # Перевіряємо RAG токен напряму
            from modules.ai_integration.models import AISettings
            ai_settings = db.query(AISettings).first()
            
            if ai_settings and ai_settings.rag_token and x_rag_token == ai_settings.rag_token:
                logger.info("✅ Авторизація через X-RAG-TOKEN успішна")
                return None  # RAG авторизація - user=None
            else:
                # Невірний RAG токен
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Invalid RAG Token"
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Помилка перевірки RAG токену: {e}")
            # Якщо помилка перевірки RAG токену, продовжуємо до JWT
    
    # Якщо немає X-RAG-TOKEN, використовуємо JWT
    # Отримуємо payload з токена вручну
    try:
        # Отримуємо токен з заголовка Authorization
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required: Provide either X-RAG-TOKEN header or valid JWT token"
            )
        
        token = auth_header.replace("Bearer ", "")
        
        # Декодуємо токен
        from core.security import decode_access_token
        user_payload = decode_access_token(token)
        
        if not user_payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        user_id_str = user_payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = crud_user.get_user_by_id(db, user_id_str)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"JWT авторизація не вдалася: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required: Provide either X-RAG-TOKEN header or valid JWT token"
        )


# WebSocket endpoint is defined in main.py to avoid middleware issues


@router.get("/inbox", response_model=schemas.InboxResponse)
def get_inbox(
    filter: Optional[str] = Query(None),
    platform: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """
    Get unified inbox conversations.
    
    - filter: 'all', 'new' (unread), 'in_progress', 'needs_reply', 'archived'
    - platform: 'telegram', 'whatsapp', 'email', 'facebook', 'instagram'
    - search: search in client name or message content
    
    ОПТИМІЗОВАНО: Batch loading клієнтів та останніх повідомлень.
    """
    from sqlalchemy.orm import lazyload
    from sqlalchemy import text
    from datetime import datetime, timezone, timedelta
    
    # Build base query with joins
    query = db.query(
        Conversation.id,
        Conversation.client_id,
        Conversation.platform,
        Conversation.external_id,
        Conversation.subject,
        Conversation.created_at,
        Conversation.updated_at,
        Conversation.assigned_manager_id,
        Conversation.last_manager_response_at,
        Conversation.is_archived,
        Conversation.last_message_at,
        func.count(Message.id).filter(
            Message.status != MessageStatus.READ, 
            Message.direction == MessageDirection.INBOUND
        ).label('unread_count'),
        func.max(Message.created_at).label('last_message_time'),
    ).outerjoin(Message, Message.conversation_id == Conversation.id)
    
    # Apply archive filter
    if filter == 'archived':
        query = query.filter(Conversation.is_archived == True)
    else:
        # For 'all' and 'new' - show only non-archived
        query = query.filter(Conversation.is_archived == False)
    
    # Add Client join if search is needed
    if search:
        query = query.outerjoin(Client, Conversation.client_id == Client.id)
    
    # Apply platform filter
    if platform:
        try:
            platform_enum = PlatformEnum(platform)
            query = query.filter(Conversation.platform == platform_enum)
        except ValueError:
            pass
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(or_(
            Client.name.ilike(search_pattern),
            Client.full_name.ilike(search_pattern),
            Conversation.external_id.ilike(search_pattern),
            Conversation.subject.ilike(search_pattern),
        ))
    
    # GROUP BY - include Client columns if search is active
    group_by_cols = [
        Conversation.id,
        Conversation.client_id,
        Conversation.platform,
        Conversation.external_id,
        Conversation.subject,
        Conversation.created_at,
        Conversation.updated_at,
        Conversation.assigned_manager_id,
        Conversation.last_manager_response_at,
        Conversation.is_archived,
        Conversation.last_message_at,
    ]
    if search:
        group_by_cols.extend([Client.id, Client.name, Client.full_name])
    
    query = query.group_by(*group_by_cols)
    
    # Apply filter
    if filter == 'new':
        # Only conversations with unread messages
        query = query.having(func.count(Message.id).filter(
            Message.status != MessageStatus.READ, 
            Message.direction == MessageDirection.INBOUND
        ) > 0)
    
    # Get total - count all results before pagination
    # Create a subquery from the grouped query
    total_subquery = query.statement.alias()
    total = db.query(func.count()).select_from(total_subquery).scalar() or 0
    
    # Order by last_message_at (preferred) or last_message_time (fallback), nulls last
    query = query.order_by(
        desc(Conversation.last_message_at),
        desc('last_message_time')
    )
    
    # Apply pagination
    results = query.offset(offset).limit(limit).all()
    
    # Build response
    conversations = []
    unread_total = 0
    
    # ОПТИМІЗАЦІЯ: Batch loading клієнтів
    client_ids = [r.client_id for r in results if r.client_id]
    clients_map = {}
    if client_ids:
        clients = db.query(Client).filter(Client.id.in_(client_ids)).all()
        clients_map = {c.id: c for c in clients}
    
    # ОПТИМІЗАЦІЯ: Batch loading останніх повідомлень (один запит замість N)
    conversation_ids = [r.id for r in results]
    last_messages_map = {}
    if conversation_ids:
        # Використовуємо DISTINCT ON для PostgreSQL - отримуємо останнє повідомлення для кожної розмови
        from sqlalchemy import text
        last_messages_query = db.query(Message).filter(
            Message.conversation_id.in_(conversation_ids)
        ).order_by(
            Message.conversation_id,
            desc(Message.created_at)
        ).all()
        
        # Групуємо по conversation_id, беремо перше (останнє за датою)
        for msg in last_messages_query:
            if msg.conversation_id not in last_messages_map:
                last_messages_map[msg.conversation_id] = msg
    
    for row in results:
        # Get last message from map
        last_message = last_messages_map.get(row.id)
        
        # Get client name from map
        client_name = None
        if row.client_id and row.client_id in clients_map:
            client = clients_map[row.client_id]
            client_name = getattr(client, 'name', None) or getattr(client, 'full_name', None)
        
        # Перевірка спливючого чату (10 хв без відповіді менеджера)
        needs_attention = False
        if row.assigned_manager_id and row.last_manager_response_at:
            # Якщо є остання відповідь менеджера, перевіряємо чи пройшло 10+ хвилин
            time_since_response = datetime.now(timezone.utc) - row.last_manager_response_at
            if time_since_response >= timedelta(minutes=10):
                # Перевіряємо чи є нові вхідні повідомлення після останньої відповіді
                if last_message and last_message.direction == MessageDirection.INBOUND:
                    if last_message.created_at > row.last_manager_response_at:
                        needs_attention = True
        elif row.assigned_manager_id and not row.last_manager_response_at:
            # Якщо менеджер призначений, але ніколи не відповідав, і є нові повідомлення
            if last_message and last_message.direction == MessageDirection.INBOUND:
                needs_attention = True
        
        # Use last_message_at from conversation if available, otherwise from message
        last_message_at_value = row.last_message_at if hasattr(row, 'last_message_at') and row.last_message_at else (last_message.created_at if last_message else None)
        
        is_archived_value = row.is_archived if hasattr(row, 'is_archived') else False
        
        conversations.append(schemas.ConversationListItem(
            id=row.id,
            platform=row.platform,
            external_id=row.external_id,
            subject=row.subject,
            client_id=row.client_id,
            client_name=client_name,
            unread_count=row.unread_count or 0,
            last_message=last_message.content if last_message else None,
            last_message_at=last_message_at_value,
            updated_at=row.updated_at,
            assigned_manager_id=row.assigned_manager_id,
            needs_attention=needs_attention,
            is_archived=is_archived_value,
        ))
        unread_total += row.unread_count or 0
    
    # Check if there are more results
    has_more = offset + limit < total
    
    return schemas.InboxResponse(
        conversations=conversations,
        total=total,
        unread_total=unread_total,
        has_more=has_more,
    )


@router.get("/conversations/{conversation_id}", response_model=schemas.ConversationWithMessages)
def get_conversation(
    conversation_id: str,  # Приймаємо string для підтримки як UUID так і custom ID
    limit: int = Query(100, ge=1, le=500, description="Кількість повідомлень (пагінація)"),
    offset: int = Query(0, ge=0, description="Зміщення для пагінації"),
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """
    Get conversation with messages.
    
    ОПТИМІЗОВАНО:
    - Пагінація повідомлень (limit/offset) для швидшого завантаження
    - Eager loading для attachments
    - Один запит для unread_count
    """
    from uuid import UUID as UUID_type
    from sqlalchemy.orm import joinedload, selectinload
    
    # Спробуємо конвертувати conversation_id в UUID
    try:
        conv_uuid = UUID_type(conversation_id)
        conversation = db.query(Conversation).filter(Conversation.id == conv_uuid).first()
    except (ValueError, TypeError):
        # Якщо не UUID, шукаємо по external_id
        logger.info(f"conversation_id '{conversation_id}' не є UUID, шукаємо по external_id")
        conversation = db.query(Conversation).filter(Conversation.external_id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # ОПТИМІЗОВАНО: Отримуємо повідомлення з eager loading для attachments
    # Використовуємо conversation.id (UUID) замість string conversation_id
    messages_query = db.query(Message)\
        .options(selectinload(Message.attachment_objects))\
        .filter(Message.conversation_id == conversation.id)\
        .order_by(desc(Message.created_at))
    
    # Загальна кількість повідомлень
    total_messages = messages_query.count()
    
    # Застосовуємо пагінацію та отримуємо повідомлення
    # Сортуємо DESC для пагінації (останні спочатку), потім реверсуємо для відображення
    messages = messages_query.offset(offset).limit(limit).all()
    messages = list(reversed(messages))  # Реверсуємо для хронологічного порядку
    
    # ОПТИМІЗОВАНО: Count unread в одному запиті
    unread_count = db.query(func.count(Message.id))\
        .filter(
            Message.conversation_id == conversation.id,
            Message.status != MessageStatus.READ,
            Message.direction == MessageDirection.INBOUND
        ).scalar() or 0
    
    # Get last message
    last_message = messages[-1] if messages else None
    
    # Конвертувати повідомлення з правильними вкладеннями
    message_reads = []
    for m in messages:
        # Використовуємо from_orm_with_attachments для правильного формату вкладень
        if hasattr(schemas.MessageRead, 'from_orm_with_attachments'):
            msg_read = schemas.MessageRead.from_orm_with_attachments(m)
        else:
            msg_read = schemas.MessageRead.model_validate(m)
        message_reads.append(msg_read)
    
    last_message_read = None
    if last_message:
        if hasattr(schemas.MessageRead, 'from_orm_with_attachments'):
            last_message_read = schemas.MessageRead.from_orm_with_attachments(last_message)
        else:
            last_message_read = schemas.MessageRead.model_validate(last_message)
    
    return schemas.ConversationWithMessages(
        id=conversation.id,
        client_id=conversation.client_id,
        platform=conversation.platform,
        external_id=conversation.external_id,
        subject=conversation.subject,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
        messages=message_reads,
        unread_count=unread_count,
        last_message=last_message_read,
        # Додаємо інформацію про пагінацію
        total_messages=total_messages,
        has_more_messages=offset + limit < total_messages,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=schemas.MessageRead)
async def send_message(
    conversation_id: str,  # Приймаємо string для підтримки як UUID так і custom ID
    request: schemas.MessageSendRequest,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Send a message in a conversation."""
    # Спробуємо конвертувати conversation_id в UUID
    from uuid import UUID as UUID_type
    try:
        conv_uuid = UUID_type(conversation_id)
        conversation = db.query(Conversation).filter(Conversation.id == conv_uuid).first()
    except (ValueError, TypeError):
        # Якщо не UUID, шукаємо по external_id
        logger.info(f"conversation_id '{conversation_id}' не є UUID, шукаємо по external_id")
        conversation = db.query(Conversation).filter(Conversation.external_id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Формуємо ім'я автора для ідентифікації менеджера
    # Якщо user=None (RAG авторизація), використовуємо дефолтні значення
    if user:
        if user.first_name and user.last_name:
            author_name = f"{user.first_name} {user.last_name}"
        elif user.first_name:
            author_name = user.first_name
        else:
            author_name = user.email
        
        # Додаємо роль до імені для ідентифікації
        user_role_str = user.role or "MANAGER"
        try:
            from modules.auth.models import UserRole
            user_role = UserRole(user_role_str.upper())
            role_label = {
                UserRole.OWNER: "Власник",
                UserRole.ACCOUNTANT: "Бухгалтер",
                UserRole.MANAGER: "Менеджер"
            }.get(user_role, "Менеджер")
            author_display = f"{author_name} ({role_label})"
        except (ValueError, ImportError):
            author_display = f"{author_name} (Менеджер)"
        
        user_id_str = str(user.id)
    else:
        # RAG авторизація - використовуємо дефолтні значення
        author_name = "AI Assistant"
        author_display = "AI Assistant (RAG)"
        user_role_str = "AI"
        user_id_str = "ai-rag-system"
    
    # Створюємо meta_data з інформацією про автора
    meta_data = {
        "author_id": user_id_str,
        "author_name": author_name,
        "author_display": author_display,
        "author_role": user_role_str,
    }
    if request.meta_data:
        meta_data.update(request.meta_data)
    
    # Автоматично призначаємо менеджера при першій відповіді (тільки для user, не для RAG)
    from datetime import datetime, timezone
    if user and not conversation.assigned_manager_id:
        conversation.assigned_manager_id = user.id
        logger.info(f"Assigned manager {user.id} to conversation {conversation_id}")
    
    # Оновлюємо час останньої відповіді менеджера
    conversation.last_manager_response_at = datetime.now(timezone.utc)
    db.commit()
    
    # Send via appropriate service based on platform
    # Сервіси самі створюють повідомлення в БД
    try:
        logger.info(f"Sending message via {conversation.platform} to conversation {conversation_id}")
        
        if conversation.platform == PlatformEnum.TELEGRAM:
            from modules.communications.services.telegram import TelegramService
            service = TelegramService(db)
            message = await service.send_message(
                conversation_id=conversation_id,
                content=request.content,
                attachments=request.attachments,
                metadata=meta_data,
            )
            
        elif conversation.platform == PlatformEnum.INSTAGRAM:
            from modules.communications.services.instagram import InstagramService
            service = InstagramService(db)
            message = await service.send_message(
                conversation_id=conversation_id,
                content=request.content,
                attachments=request.attachments,
                metadata=meta_data,
            )
            
        elif conversation.platform == PlatformEnum.WHATSAPP:
            from modules.communications.services.whatsapp import WhatsAppService
            service = WhatsAppService(db)
            message = await service.send_message(
                conversation_id=conversation_id,
                content=request.content,
                attachments=request.attachments,
                metadata=meta_data,
            )
            
        elif conversation.platform == PlatformEnum.FACEBOOK:
            from modules.communications.services.facebook import FacebookService
            service = FacebookService(db)
            message = await service.send_message(
                conversation_id=conversation_id,
                content=request.content,
                attachments=request.attachments,
                metadata=meta_data,
            )
            
        elif conversation.platform == PlatformEnum.EMAIL:
            from modules.communications.services.email import EmailService
            service = EmailService(db)
            message = await service.send_message(
                conversation_id=conversation_id,
                content=request.content,
                attachments=request.attachments,
                metadata=meta_data,
            )
            
        else:
            # Unknown platform - create message manually and mark as sent
            logger.warning(f"Unknown platform {conversation.platform}, message not actually sent")
            message = Message(
                conversation_id=conversation_id,
                direction=MessageDirection.OUTBOUND,
                type=MessageType.TEXT,
                content=request.content,
                status=MessageStatus.SENT,
                attachments=request.attachments,
                meta_data=meta_data,
            )
            db.add(message)
            from datetime import datetime
            message.sent_at = datetime.utcnow()
            db.commit()
        
        db.refresh(message)
        
        # Broadcast to WebSocket
        # Додаємо platform та platform_name для правильної обробки на фронтенді
        platform_icons = {
            PlatformEnum.TELEGRAM: '✈️',
            PlatformEnum.WHATSAPP: '💬',
            PlatformEnum.EMAIL: '📧',
            PlatformEnum.INSTAGRAM: '📷',
            PlatformEnum.FACEBOOK: '👥',
        }
        platform_names = {
            PlatformEnum.TELEGRAM: 'Telegram',
            PlatformEnum.WHATSAPP: 'WhatsApp',
            PlatformEnum.EMAIL: 'Email',
            PlatformEnum.INSTAGRAM: 'Instagram',
            PlatformEnum.FACEBOOK: 'Facebook',
        }
        
        await messages_manager.broadcast({
            "type": "new_message",
            "conversation_id": str(conversation_id),
            "platform": str(conversation.platform.value) if hasattr(conversation.platform, 'value') else str(conversation.platform),
            "platform_name": platform_names.get(conversation.platform, str(conversation.platform)),
            "platform_icon": platform_icons.get(conversation.platform, '💬'),
            "message": {
                "id": str(message.id),
                "conversation_id": str(message.conversation_id),
                "direction": str(message.direction),
                "type": str(message.type),
                "content": message.content,
                "status": str(message.status),
                "attachments": message.attachments,
                "created_at": message.created_at.isoformat(),
                "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            }
        })
        
    except Exception as e:
        logger.error(f"Failed to send message via {conversation.platform}: {e}", exc_info=True)
        # Якщо повідомлення було створено сервісом, оновити його статус
        if 'message' in locals() and message:
            try:
                message.status = MessageStatus.FAILED
                db.commit()
            except Exception as commit_error:
                logger.error(f"Failed to update message status: {commit_error}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")
    
    return schemas.MessageRead.model_validate(message)


@router.post("/conversations/{conversation_id}/mark-read")
def mark_conversation_read(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Mark all messages in conversation as read."""
    db.query(Message).filter(
        Message.conversation_id == conversation_id,
        Message.direction == MessageDirection.INBOUND,
        Message.status != MessageStatus.READ,
    ).update({Message.status: MessageStatus.READ})
    
    db.commit()
    
    return {"status": "ok"}


@router.post("/conversations/{conversation_id}/archive")
def archive_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Archive a conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.is_archived = True
    db.commit()
    
    if user:
        logger.info(f"Conversation {conversation_id} archived by user {user.id}")
    else:
        logger.info(f"Conversation {conversation_id} archived by RAG")
    
    return {"status": "ok", "conversation_id": str(conversation_id), "is_archived": True}


@router.post("/conversations/{conversation_id}/unarchive")
def unarchive_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Unarchive a conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation.is_archived = False
    db.commit()
    
    if user:
        logger.info(f"Conversation {conversation_id} unarchived by user {user.id}")
    else:
        logger.info(f"Conversation {conversation_id} unarchived by RAG")
    
    return {"status": "ok", "conversation_id": str(conversation_id), "is_archived": False}


@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Delete a message by ID."""
    message = db.query(Message).filter(Message.id == message_id).first()
    
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    conversation_id = message.conversation_id
    
    # Видалити повідомлення (cascade видалить attachments автоматично)
    db.delete(message)
    db.commit()
    
    if user:
        logger.info(f"Message {message_id} deleted by user {user.id}")
    else:
        logger.info(f"Message {message_id} deleted by RAG")
    
    # Notify via WebSocket
    await notify_message_deleted(message_id, conversation_id)
    
    return {"status": "success", "message_id": str(message_id)}


@router.post("/conversations/{conversation_id}/assign-manager")
async def assign_manager_to_conversation(
    conversation_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Assign current user as manager to conversation."""
    logger.info(f"Attempting to assign manager to conversation {conversation_id}")
    
    # Спробуємо знайти розмову за UUID
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    # Якщо не знайдено за UUID, спробуємо знайти за external_id (для сумісності)
    if not conversation:
        logger.warning(f"Conversation {conversation_id} not found by UUID, trying external_id")
        conversation = db.query(Conversation).filter(Conversation.external_id == str(conversation_id)).first()
    
    if not conversation:
        # Додаткова діагностика: перевіримо, чи взагалі є розмови в БД
        total_conversations = db.query(Conversation).count()
        logger.error(f"Conversation {conversation_id} not found in database. Total conversations in DB: {total_conversations}")
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    logger.info(f"Found conversation {conversation_id}, platform: {conversation.platform}, archived: {conversation.is_archived}")
    
    # Перевіряємо наявність користувача
    if not user:
        logger.error(f"User not found for assigning manager to conversation {conversation_id}")
        raise HTTPException(status_code=401, detail="User authentication required")
    
    # Перевіряємо, чи розмова не видалена (якщо є поле deleted_at)
    # Але навіть архівовані розмови можна призначати менеджера
    
    # Assign manager if not already assigned
    if not conversation.assigned_manager_id:
        conversation.assigned_manager_id = user.id
        logger.info(f"Assigned manager {user.id} to conversation {conversation_id}")
        db.commit()
        db.refresh(conversation)
        
        # Broadcast assignment to all connected managers via WebSocket
        from modules.communications.router import messages_manager
        assignment_notification = {
            "type": "manager_assigned",
            "conversation_id": str(conversation_id),
            "manager_id": str(user.id),
            "manager_name": f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email,
            "timestamp": conversation.updated_at.isoformat() if conversation.updated_at else None,
        }
        await messages_manager.broadcast(assignment_notification)
        logger.info(f"Broadcasted manager assignment for conversation {conversation_id}")
    
    return {
        "status": "ok",
        "assigned_manager_id": str(conversation.assigned_manager_id),
        "assigned": conversation.assigned_manager_id == user.id if user else False,
    }


@router.post("/conversations/{conversation_id}/create-client")
def create_client_from_conversation(
    conversation_id: str,  # Приймаємо string для підтримки як UUID так і custom ID від RAG
    data: Optional[schemas.ClientFromConversation] = None,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Create a client from conversation."""
    # Спробуємо конвертувати conversation_id в UUID
    from uuid import UUID as UUID_type
    try:
        conv_uuid = UUID_type(conversation_id)
        conversation = db.query(Conversation).filter(Conversation.id == conv_uuid).first()
    except (ValueError, TypeError):
        # Якщо не UUID, шукаємо по external_id (для RAG може бути custom ID)
        logger.info(f"conversation_id '{conversation_id}' не є UUID, шукаємо по external_id")
        conversation = db.query(Conversation).filter(Conversation.external_id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    if conversation.client_id:
        return {"client_id": str(conversation.client_id), "status": "already_exists"}
    
    # Map platform to client source
    platform_to_source = {
        PlatformEnum.TELEGRAM: ClientSource.TELEGRAM,
        PlatformEnum.WHATSAPP: ClientSource.WHATSAPP,
        PlatformEnum.EMAIL: ClientSource.EMAIL,
        PlatformEnum.INSTAGRAM: ClientSource.INSTAGRAM,
        PlatformEnum.FACEBOOK: ClientSource.FACEBOOK,
    }
    client_source = platform_to_source.get(conversation.platform, ClientSource.MANUAL)
    
    # Create client with source from conversation platform
    client = Client(
        full_name=data.name if data and data.name else f"Клієнт {conversation.external_id}",
        phone=data.phone if data and data.phone else (conversation.external_id if conversation.platform == PlatformEnum.TELEGRAM else ""),
        email=data.email if data and data.email else (conversation.external_id if conversation.platform == PlatformEnum.EMAIL else None),
        source=client_source,
    )
    db.add(client)
    db.flush()
    
    # Link conversation to client
    conversation.client_id = client.id
    db.commit()
    
    return {"client_id": str(client.id), "status": "created"}


@router.post("/conversations/{conversation_id}/link-client/{client_id}")
def link_client_to_conversation(
    conversation_id: UUID,
    client_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Link an existing client to conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if conversation.client_id:
        return {"client_id": str(conversation.client_id), "status": "already_linked"}
    
    # Link conversation to client
    conversation.client_id = client.id
    db.commit()
    
    return {"client_id": str(client.id), "status": "linked"}


@router.post("/conversations/{conversation_id}/quick-action")
def quick_action(
    conversation_id: UUID,
    request: schemas.QuickActionRequest,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Handle quick actions on conversation."""
    conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    action = request.action
    
    if action == "download_files":
        # Get all file attachments from conversation
        messages_with_files = db.query(Message).filter(
            Message.conversation_id == conversation_id,
            Message.attachments.isnot(None),
        ).all()
        
        files = []
        for msg in messages_with_files:
            if msg.attachments:
                files.extend(msg.attachments)
        
        return {"status": "success", "files_downloaded": len(files), "files": files}
    
    elif action == "create_order":
        # Create order from conversation
        return {"status": "success", "order_id": None, "message": "Order creation not implemented"}
    
    elif action == "mark_important":
        # Mark conversation as important (would need a field for this)
        return {"status": "success", "important": True}
    
    return {"status": "error", "message": f"Unknown action: {action}"}


# File upload configuration
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOADS_DIR = BASE_DIR / "uploads" / "messages"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Max file size: 50MB
MAX_FILE_SIZE = 50 * 1024 * 1024

# Allowed file types
ALLOWED_TYPES = {
    # Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/heic', 'image/heif',
    # Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    # Text
    'text/plain', 'text/csv',
    # Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
    # Audio/Video
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm', 'video/quicktime',
}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Upload a file attachment for messages."""
    # Validate content type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail=f"File type not allowed: {file.content_type}")
    
    # Read file content
    content = await file.read()
    
    # Validate size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)} MB")
    
    # Generate unique filename
    ext = Path(file.filename).suffix.lower() if file.filename else ''
    unique_id = str(uuid_module.uuid4())
    filename = f"{unique_id}{ext}"
    
    # Save file
    file_path = UPLOADS_DIR / filename
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Determine file type category
    mime_type = file.content_type or ''
    if mime_type.startswith('image/'):
        file_type = 'image'
    elif mime_type.startswith('video/'):
        file_type = 'video'
    elif mime_type.startswith('audio/'):
        file_type = 'audio'
    elif mime_type == 'application/pdf' or 'document' in mime_type or 'msword' in mime_type or 'spreadsheet' in mime_type:
        file_type = 'document'
    else:
        file_type = 'file'
    
    return {
        "id": unique_id,
        "filename": file.filename,
        "type": file_type,
        "url": f"/api/v1/communications/files/{filename}",
        "mime_type": file.content_type,
        "size": len(content),
    }


@router.get("/files/{filename}")
async def get_file(filename: str, response: Response):
    """
    Download a file attachment.
    
    ОПТИМІЗОВАНО: Додано кешування заголовки.
    """
    file_path = UPLOADS_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Визначаємо MIME тип для правильного кешування
    import mimetypes
    mime_type, _ = mimetypes.guess_type(str(file_path))
    
    # Кешування на 1 день для статичних файлів
    headers = {
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
    }
    
    return FileResponse(
        file_path, 
        filename=filename,
        media_type=mime_type,
        headers=headers
    )


@router.get("/media/{path:path}")
async def get_media_file(
    path: str,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Download a media file from communications_attachments.
    Підтримує шляхи з підпапками, наприклад: /media/attachments/filename.pdf
    Також підтримує UUID для зворотної сумісності: /media/{uuid}
    
    ОПТИМІЗОВАНО:
    - Кешування на рівні HTTP (Cache-Control)
    - ETag для умовних запитів
    - Оптимізований пошук в БД
    """
    from modules.communications.models import Attachment
    from modules.communications.utils.media import get_media_dir
    from uuid import UUID
    import hashlib
    
    attachment = None
    
    # Спробувати знайти за UUID (для зворотної сумісності)
    try:
        attachment_id = UUID(path)
        attachment = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    except (ValueError, TypeError):
        pass
    
    # Якщо не знайдено за UUID, спробувати за повним шляхом
    if not attachment:
        attachment = db.query(Attachment).filter(
            Attachment.file_path == path
        ).first()
    
    # Якщо не знайдено за повним шляхом, спробувати знайти за ім'ям файлу (для сумісності)
    if not attachment:
        filename = Path(path).name
        attachment = db.query(Attachment).filter(
            Attachment.file_path.like(f"%/{filename}")
        ).first()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found in database")
    
    # Базовий шлях до медіа файлів
    MEDIA_DIR = get_media_dir()
    # Склеюємо базовий шлях з тим, що зберігається в БД
    # Якщо в БД: "attachments/filename.pdf", то шукаємо в /app/media/attachments/filename.pdf
    file_path = MEDIA_DIR / attachment.file_path
    
    if not file_path.exists():
        logger.error(f"File not found on disk: {file_path} (from DB: {attachment.file_path})")
        raise HTTPException(status_code=404, detail="Media file not found on disk")
    
    download_filename = attachment.original_name if attachment.original_name else Path(path).name
    
    # ОПТИМІЗАЦІЯ: Генеруємо ETag на основі ID та розміру файлу
    etag = hashlib.md5(f"{attachment.id}-{attachment.file_size}".encode()).hexdigest()
    
    # Кешування заголовки - файли не змінюються, можна кешувати довго
    headers = {
        "Cache-Control": "public, max-age=604800, immutable",  # 7 днів
        "ETag": f'"{etag}"',
        "X-Content-Type-Options": "nosniff",
    }
    
    return FileResponse(
        file_path, 
        filename=download_filename,
        media_type=attachment.mime_type,
        headers=headers
    )


class PaymentLinkRequest(BaseModel):
    amount: Optional[float] = None
    currency: str = "pln"


@router.post("/orders/{order_id}/payment-link")
async def create_payment_link(
    order_id: UUID,
    request: PaymentLinkRequest,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Create payment link for order using active payment provider (Stripe or Przelewy24)."""
    from modules.crm.models import Order
    from modules.payment.models import PaymentSettings, PaymentProvider
    from modules.payment.services.stripe_service import StripeService
    from modules.payment.services.przelewy24_service import Przelewy24Service
    from modules.payment.schemas import P24TransactionRegisterRequest
    from decimal import Decimal
    import os
    from uuid import uuid4
    
    amount = request.amount
    currency = request.currency or "PLN"
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # If amount not provided, calculate from order or use default
    if not amount:
        # Try to get amount from order transactions or use a default
        amount = float(order.price_brutto) if order.price_brutto else 100.0
    
    # Отримати налаштування оплати (створити дефолтні, якщо не існують)
    from modules.payment.router import get_or_create_settings
    payment_settings = get_or_create_settings(db)
    
    # Визначити активну систему оплати
    active_provider = payment_settings.active_payment_provider
    
    # Якщо не встановлено, вибрати автоматично на основі enabled статусів
    if not active_provider:
        if payment_settings.stripe_enabled and payment_settings.stripe_secret_key:
            active_provider = PaymentProvider.STRIPE
        elif payment_settings.przelewy24_enabled and payment_settings.przelewy24_merchant_id:
            active_provider = PaymentProvider.PRZELEWY24
        else:
            raise HTTPException(
                status_code=400, 
                detail="No active payment provider configured. Please configure Stripe or Przelewy24 in Payment Settings and select an active provider."
            )
    
    # Створити посилання на оплату в залежності від вибраної системи
    try:
        if active_provider == PaymentProvider.STRIPE:
            # Stripe payment link
            if not payment_settings.stripe_enabled or not payment_settings.stripe_secret_key:
                raise HTTPException(status_code=500, detail="Stripe is not configured or enabled")
            
            import stripe
            stripe.api_key = payment_settings.stripe_secret_key
            
            # Create Price
            price = stripe.Price.create(
                unit_amount=int(amount * 100),  # Stripe works in cents
                currency=currency.lower(),
                product_data={
                    "name": f"Замовлення {order.order_number}",
                },
            )

            # Create Payment Link
            payment_link_obj = stripe.PaymentLink.create(
                line_items=[
                    {
                        "price": price.id,
                        "quantity": 1,
                    },
                ],
                metadata={
                    "order_id": str(order.id),
                },
                after_completion={
                    "type": "redirect",
                    "redirect": {
                        "url": f"{os.getenv('FRONTEND_URL', 'http://localhost:5173')}/orders/{order.id}/success"
                    }
                }
            )

            payment_url = payment_link_obj.url
            
        elif active_provider == PaymentProvider.PRZELEWY24:
            # Przelewy24 payment link
            if not payment_settings.przelewy24_enabled or not payment_settings.przelewy24_merchant_id:
                raise HTTPException(status_code=500, detail="Przelewy24 is not configured or enabled")
            
            p24_service = Przelewy24Service(payment_settings)
            
            # Отримати email клієнта
            customer_email = order.client.email if order.client and order.client.email else "customer@example.com"
            customer_name = order.client.full_name if order.client else "Клієнт"
            
            # Створити session_id
            session_id = str(uuid4())
            
            # URLs
            frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
            backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
            return_url = f"{frontend_url}/orders/{order.id}/success"
            status_url = f"{backend_url}/api/v1/payment/webhooks/przelewy24"
            
            # Зареєструвати транзакцію в Przelewy24
            p24_request = P24TransactionRegisterRequest(
                order_id=order.id,
                amount=Decimal(str(amount)),
                currency=currency,
                customer_email=customer_email,
                customer_name=customer_name,
                description=f"Замовлення {order.order_number}",
            )
            
            result = await p24_service.register_transaction(
                request=p24_request,
                session_id=session_id,
                return_url=return_url,
                status_url=status_url,
            )
            
            payment_url = result.payment_url
        else:
            raise HTTPException(status_code=500, detail=f"Unsupported payment provider: {active_provider}")

        return {
            "payment_link": payment_url,
            "order_id": str(order.id),
            "amount": amount,
            "currency": currency,
            "provider": active_provider.value,
        }
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"Payment library not installed: {str(e)}")
    except Exception as e:
        logger.error(f"Payment error ({active_provider}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create payment link: {str(e)}")


@router.get("/orders/{order_id}/tracking")
async def get_tracking(
    order_id: UUID,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Get InPost tracking number for order."""
    from modules.crm.models import Order
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    try:
        import httpx
        import os
        
        # Завантажити InPost ключ з бази даних
        inpost_settings = crud.get_inpost_settings(db)
        inpost_api_key = inpost_settings.get("inpost_api_key") or os.getenv("INPOST_API_KEY", "")
        if not inpost_api_key:
            raise HTTPException(status_code=500, detail="InPost API key not configured")
        
        base_url = "https://api-shipx-pl.easypack24.net/v1"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{base_url}/shipments",
                headers={
                    "Authorization": f"Bearer {inpost_api_key}",
                },
                params={
                    "order_id": str(order.id),
                }
            )

            if response.status_code == 200:
                data = response.json()
                tracking_number = data.get("tracking_number") or data.get("number")
                
                if tracking_number:
                    return {
                        "number": tracking_number,
                        "trackingUrl": f"https://inpost.pl/sledzenie-przesylek?number={tracking_number}",
                        "order_id": str(order.id),
                    }
            
            return {
                "number": None,
                "trackingUrl": None,
                "message": "Tracking number not found",
                "order_id": str(order.id),
            }
    except ImportError:
        raise HTTPException(status_code=500, detail="httpx library not installed")
    except Exception as e:
        logger.error(f"InPost API error: {e}")
        return {
            "number": None,
            "trackingUrl": None,
            "message": f"Error: {str(e)}",
            "order_id": str(order.id),
        }


@router.post("/clients/{client_id}/update-contact")
async def update_client_contact(
    client_id: UUID,
    data: dict = Body(...),
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Update client email or phone and optionally link conversation."""
    from modules.crm.models import Client
    
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    email = data.get("email")
    phone = data.get("phone")
    conversation_id = data.get("conversation_id")  # Опціонально: ID conversation для прив'язки
    
    if email:
        client.email = email
    if phone:
        client.phone = phone
    
    # Якщо передано conversation_id, прив'язуємо conversation до клієнта
    if conversation_id:
        try:
            conv_uuid = UUID(conversation_id) if isinstance(conversation_id, str) else conversation_id
            conversation = db.query(Conversation).filter(Conversation.id == conv_uuid).first()
            if conversation and not conversation.client_id:
                conversation.client_id = client.id
        except (ValueError, TypeError):
            # Ігноруємо помилки парсингу UUID
            pass
    
    db.commit()
    db.refresh(client)
    
    return {
        "client_id": str(client.id),
        "email": client.email,
        "phone": client.phone,
        "conversation_linked": conversation_id is not None,
    }


class AddFileRequest(BaseModel):
    file_url: str
    file_name: str


class AddAddressRequest(BaseModel):
    address: str
    is_paczkomat: bool
    paczkomat_code: Optional[str] = None


@router.post("/orders/{order_id}/add-file")
async def add_file_to_order(
    order_id: UUID,
    request: AddFileRequest,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Add file to order."""
    from modules.crm.models import Order
    
    file_url = request.file_url
    file_name = request.file_name
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order file_url if not set, or append to description
    if not order.file_url:
        order.file_url = file_url
    else:
        # Append to description
        if order.description:
            order.description += f"\n\nФайл: {file_name} ({file_url})"
        else:
            order.description = f"Файл: {file_name} ({file_url})"
    
    db.commit()
    db.refresh(order)
    
    return {
        "order_id": str(order.id),
        "file_url": order.file_url,
        "message": "File added to order",
    }


@router.post("/orders/{order_id}/add-address")
async def add_address_to_order(
    order_id: UUID,
    request: AddAddressRequest,
    db: Session = Depends(get_db),
    user: Optional[models.User] = Depends(get_current_user_or_rag),
):
    """Add address or paczkomat to order."""
    from modules.crm.models import Order
    from datetime import date
    from decimal import Decimal
    
    address = request.address
    is_paczkomat = request.is_paczkomat
    paczkomat_code = request.paczkomat_code
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Add address/paczkomat to description
    if is_paczkomat and paczkomat_code:
        address_text = f"Доставка: InPost пачкомат {paczkomat_code}\nАдреса: {address}\nВартість доставки: 13.99 zł"
    else:
        address_text = f"Доставка: Адреса\n{address}"
    
    if order.description:
        order.description += f"\n\n{address_text}"
    else:
        order.description = address_text
    
    # Note: Transaction creation requires payment_date, service_date, receipt_number, payment_method
    # Delivery cost (13.99 zł) is added to description for now
    # Transaction can be created manually later if needed
    
    db.commit()
    db.refresh(order)
    
    return {
        "order_id": str(order.id),
        "message": "Address added to order",
        "delivery_cost": 13.99 if is_paczkomat else None,
    }


# Helper function to notify about new incoming messages
async def notify_new_message(message: Message, conversation: Conversation):
    """Send WebSocket notification about new message."""
    try:
        # Іконки та назви для різних платформ
        platform_icons = {
            'telegram': '✈️',
            'whatsapp': '💬',
            'email': '📧',
            'instagram': '📷',
            'facebook': '👥',
        }
        platform_names = {
            'telegram': 'Telegram',
            'whatsapp': 'WhatsApp',
            'email': 'Email',
            'instagram': 'Instagram',
            'facebook': 'Facebook',
        }
        
        platform_str = str(conversation.platform)
        
        await messages_manager.broadcast({
            "type": "new_message",
            "conversation_id": str(conversation.id),
            "platform": platform_str,  # Додаємо platform
            "platform_icon": platform_icons.get(platform_str, '💬'),
            "platform_name": platform_names.get(platform_str, platform_str.title()),
            "message": {
                "id": str(message.id),
                "conversation_id": str(message.conversation_id),
                "direction": str(message.direction),
                "type": str(message.type),
                "content": message.content,
                "status": str(message.status),
                "attachments": message.attachments,
                "created_at": message.created_at.isoformat(),
                "sent_at": message.sent_at.isoformat() if message.sent_at else None,
            },
            "conversation": {
                "id": str(conversation.id),
                "platform": platform_str,
                "external_id": conversation.external_id,
                "client_name": conversation.client.name if conversation.client else None,
            }
        })
        logger.info(f"WebSocket notification sent for new message {message.id}")
    except Exception as e:
        logger.error(f"Failed to send WebSocket notification for new message: {e}", exc_info=True)


# Helper function to notify about deleted message
async def notify_message_deleted(message_id: UUID, conversation_id: UUID):
    """Send WebSocket notification about deleted message."""
    try:
        await messages_manager.broadcast({
            "type": "message_deleted",
            "message_id": str(message_id),
            "conversation_id": str(conversation_id),
        })
        logger.info(f"WebSocket notification sent for deleted message {message_id}")
    except Exception as e:
        logger.error(f"Failed to send WebSocket notification for deleted message: {e}", exc_info=True)


# ============================================================================
# Webhook endpoints for receiving messages from platforms
# ============================================================================

@router.get("/webhooks/whatsapp")
async def whatsapp_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    db: Session = Depends(get_db),
):
    """
    WhatsApp webhook verification endpoint (GET).
    Meta requires this for webhook setup.
    """
    logger.info(f"WhatsApp webhook verification: mode={hub_mode}, token={hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token:
        service = WhatsAppService(db)
        verify_token = service.config.get("verify_token", "")
        
        logger.info(f"WhatsApp verify_token from config: {verify_token[:10]}..." if verify_token else "WhatsApp verify_token from config: (empty)")
        logger.info(f"WhatsApp verify_token from Meta: {hub_verify_token[:10]}..." if hub_verify_token else "WhatsApp verify_token from Meta: (empty)")
        
        if hub_verify_token == verify_token:
            logger.info("WhatsApp webhook verified successfully")
            return int(hub_challenge) if hub_challenge else 200
        else:
            logger.warning(f"WhatsApp webhook verification failed: token mismatch. Expected: {verify_token[:10] if verify_token else '(empty)'}..., Got: {hub_verify_token[:10] if hub_verify_token else '(empty)'}...")
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    
    logger.warning(f"WhatsApp webhook verification failed: invalid request. mode={hub_mode}, has_token={bool(hub_verify_token)}")
    raise HTTPException(status_code=400, detail="Invalid verification request")


@router.post("/webhooks/whatsapp")
async def whatsapp_webhook_receive(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    WhatsApp webhook endpoint (POST) - receives messages from Meta.
    """
    try:
        # Get signature from headers
        signature = request.headers.get("X-Hub-Signature-256", "")
        
        # Read raw body for signature verification
        body_bytes = await request.body()
        
        # Verify webhook signature
        service = WhatsAppService(db)
        if signature and not service.verify_webhook(signature, body_bytes):
            logger.warning("WhatsApp webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse JSON payload
        webhook_data = await request.json()
        logger.info(f"WhatsApp webhook received: {webhook_data.get('object', 'unknown')}")
        
        # Process webhook
        result = await handle_whatsapp_webhook(db, webhook_data)
        
        return result
    except Exception as e:
        logger.error(f"WhatsApp webhook error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# WhatsApp OAuth endpoints (Facebook Login for Business)
# ============================================================================

@router.post("/webhooks/whatsapp/connect")
async def whatsapp_connect(
    request: Request,
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """
    Обмін authorization code на access token для WhatsApp через Facebook Login for Business.
    Приймає code, app_id та app_secret з фронту.
    """
    import httpx
    import json
    
    try:
        body = await request.json()
        code = body.get("code")
        app_id = body.get("app_id")
        app_secret = body.get("app_secret")
        redirect_uri = body.get("redirect_uri")  # Опціональний redirect_uri
        
        if not code:
            raise HTTPException(status_code=400, detail="Code не вказано")
        if not app_id:
            raise HTTPException(status_code=400, detail="App ID не вказано")
        if not app_secret:
            raise HTTPException(status_code=400, detail="App Secret не вказано")
        
        # Обмінюємо code на access_token (використовуємо v22.0)
        # Використовуємо POST замість GET, як рекомендовано для WhatsApp Business Messaging
        token_url = "https://graph.facebook.com/v22.0/oauth/access_token"
        token_params = {
            "client_id": app_id,
            "client_secret": app_secret,
            "grant_type": "authorization_code",
            "code": code,
        }
        
        # Додаємо redirect_uri якщо він переданий (потрібен для WhatsApp Business Messaging)
        # Для WhatsApp Business Messaging з встроенной регистрацией redirect_uri обов'язковий
        if redirect_uri:
            token_params["redirect_uri"] = redirect_uri
            logger.info(f"Using redirect_uri for WhatsApp Business Messaging: {redirect_uri[:100]}...")
        else:
            # Для стандартного OAuth flow redirect_uri може не бути потрібним
            logger.info("redirect_uri not provided, using standard OAuth flow")
        
        logger.info(f"Exchanging authorization code for access token (app_id: {app_id})")
        
        async with httpx.AsyncClient() as client:
            # Використовуємо POST з JSON body (як у прикладі curl для WhatsApp Business Messaging)
            # Meta приймає як form-data, так і JSON, але для WhatsApp Business Messaging краще використовувати JSON
            response = await client.post(
                token_url, 
                json=token_params,  # Використовуємо json= замість data= для JSON body
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            token_response = response.json()
            
            logger.info("Successfully exchanged authorization code for access token")
        
        access_token = token_response.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Access token не отримано від Meta")
        
        # Отримуємо інформацію про WhatsApp Business акаунти
        pages_url = "https://graph.facebook.com/v22.0/me/accounts"
        pages_params = {"access_token": access_token}
        
        async with httpx.AsyncClient() as client:
            pages_response = await client.get(pages_url, params=pages_params)
            pages_response.raise_for_status()
            pages_data = pages_response.json()
        
        # Збираємо інформацію про WhatsApp Business акаунти
        whatsapp_accounts = []
        phone_number_id = None
        waba_id = None
        
        for page in pages_data.get("data", []):
            if "whatsapp_business_account" in page:
                whatsapp_info = page["whatsapp_business_account"]
                waba_id = whatsapp_info.get("id")
                
                # Отримуємо phone_number_id з WhatsApp Business Account
                try:
                    waba_url = f"https://graph.facebook.com/v22.0/{waba_id}/phone_numbers"
                    waba_params = {"access_token": access_token}
                    async with httpx.AsyncClient() as client:
                        waba_response = await client.get(waba_url, params=waba_params)
                        waba_response.raise_for_status()
                        phone_numbers_data = waba_response.json()
                        
                        if phone_numbers_data.get("data") and len(phone_numbers_data["data"]) > 0:
                            phone_number_id = phone_numbers_data["data"][0].get("id")
                            # Валідація: phone_number_id має бути цифровим ID
                            if phone_number_id and not phone_number_id.isdigit():
                                logger.warning(f"Invalid phone_number_id format (not numeric): {phone_number_id}")
                                phone_number_id = None
                            logger.info(f"Retrieved phone_number_id: {phone_number_id} for WABA: {waba_id}")
                        else:
                            logger.warning(f"No phone numbers found for WABA: {waba_id}")
                except httpx.HTTPStatusError as e:
                    error_detail = f"HTTP {e.response.status_code}"
                    try:
                        error_data = e.response.json()
                        error_detail = error_data.get("error", {}).get("message", error_detail)
                    except:
                        pass
                    logger.warning(f"Failed to get phone_number_id for WABA {waba_id}: {error_detail}")
                except Exception as e:
                    logger.warning(f"Failed to get phone_number_id for WABA {waba_id}: {e}")
                
                whatsapp_accounts.append({
                    "waba_id": waba_id,
                    "page_id": page.get("id"),
                    "page_name": page.get("name", ""),
                    "phone_number_id": phone_number_id,
                })
                
                # Зберігаємо акаунт в БД, якщо phone_number_id є
                if phone_number_id:
                    # Перевіряємо чи акаунт вже існує
                    existing_account = db.query(WhatsAppAccount).filter(
                        WhatsAppAccount.phone_number_id == phone_number_id
                    ).first()
                    
                    if existing_account:
                        # Оновлюємо існуючий акаунт
                        existing_account.waba_id = waba_id
                        existing_account.page_id = page.get("id")
                        existing_account.page_name = page.get("name", "")
                        existing_account.is_active = True
                    else:
                        # Створюємо новий акаунт
                        # Спробуємо отримати відображуваний номер телефону з Meta API
                        phone_number_display = None
                        try:
                            phone_url = f"https://graph.facebook.com/v22.0/{phone_number_id}"
                            phone_params = {"access_token": access_token, "fields": "display_phone_number,verified_name"}
                            async with httpx.AsyncClient() as client:
                                phone_response = await client.get(phone_url, params=phone_params)
                                if phone_response.status_code == 200:
                                    phone_data = phone_response.json()
                                    phone_number_display = phone_data.get("display_phone_number")
                                    verified_name = phone_data.get("verified_name")
                                    if verified_name:
                                        name = verified_name
                                    else:
                                        name = phone_number_display or f"WhatsApp {phone_number_id[:6]}..."
                                else:
                                    name = f"WhatsApp {phone_number_id[:6]}..."
                        except Exception as e:
                            logger.warning(f"Failed to get phone number details: {e}")
                            name = f"WhatsApp {phone_number_id[:6]}..."
                        
                        new_account = WhatsAppAccount(
                            phone_number_id=phone_number_id,
                            phone_number=phone_number_display,
                            name=name,
                            waba_id=waba_id,
                            page_id=page.get("id"),
                            page_name=page.get("name", ""),
                            is_active=True
                        )
                        db.add(new_account)
                    
                    db.commit()
        
        # Зберігаємо access_token та phone_number_id в налаштуваннях WhatsApp
        crud.set_setting(db, "whatsapp_access_token", access_token)
        if phone_number_id:
            crud.set_setting(db, "whatsapp_phone_number_id", phone_number_id)
        if waba_id:
            crud.set_setting(db, "whatsapp_waba_id", waba_id)
        
        logger.info(f"WhatsApp connected successfully. WABA ID: {waba_id}, Phone Number ID: {phone_number_id}")
        
        return {
            "status": "ok",
            "access_token": access_token,
            "phone_number_id": phone_number_id,
            "waba_id": waba_id,
            "whatsapp_accounts": whatsapp_accounts,
        }
        
    except httpx.HTTPStatusError as e:
        error_detail = f"HTTP {e.response.status_code}"
        try:
            error_data = e.response.json()
            error_detail = error_data.get("error", {}).get("message", error_detail)
        except:
            pass
        logger.error(f"WhatsApp connect error: {error_detail}")
        raise HTTPException(status_code=400, detail=f"Помилка обміну коду: {error_detail}")
    except Exception as e:
        logger.error(f"WhatsApp connect error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Помилка підключення: {str(e)}")


@router.get("/webhooks/whatsapp/status")
async def whatsapp_status(
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """Перевірка статусу підключення WhatsApp."""
    settings = crud.get_whatsapp_settings(db)
    access_token = settings.get("whatsapp_access_token")
    
    return {
        "connected": bool(access_token),
        "has_phone_number_id": bool(settings.get("whatsapp_phone_number_id")),
        "has_waba_id": bool(settings.get("whatsapp_waba_id")),
    }


@router.post("/webhooks/whatsapp/disconnect")
async def whatsapp_disconnect(
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """Відключення WhatsApp - видаляє токени з бази даних."""
    # Видаляємо токени
    crud.set_setting(db, "whatsapp_access_token", "")
    crud.set_setting(db, "whatsapp_phone_number_id", "")
    crud.set_setting(db, "whatsapp_waba_id", "")
    
    logger.info("WhatsApp disconnected")
    
    return {"status": "removed"}


@router.get("/whatsapp/accounts")
async def get_whatsapp_accounts(
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """Отримати список всіх підключених WhatsApp акаунтів."""
    accounts = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.is_active == True
    ).order_by(WhatsAppAccount.created_at.desc()).all()
    
    return [
        {
            "id": account.id,
            "phone_number_id": account.phone_number_id,
            "phone_number": account.phone_number,
            "name": account.name or f"WhatsApp {account.phone_number_id[:6]}...",
            "waba_id": account.waba_id,
            "page_id": account.page_id,
            "page_name": account.page_name,
            "is_active": account.is_active,
            "created_at": account.created_at.isoformat() if account.created_at else None,
        }
        for account in accounts
    ]


@router.delete("/whatsapp/accounts/{account_id}")
async def delete_whatsapp_account(
    account_id: int,
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """Видалити WhatsApp акаунт за ID."""
    account = db.query(WhatsAppAccount).filter(
        WhatsAppAccount.id == account_id
    ).first()
    
    if not account:
        raise HTTPException(status_code=404, detail="WhatsApp акаунт не знайдено")
    
    # Видаляємо акаунт (або деактивуємо)
    account.is_active = False
    db.commit()
    
    logger.info(f"WhatsApp account {account_id} deleted")
    
    return {"status": "deleted", "id": account_id}


@router.get("/instagram/webhook")
async def instagram_webhook_verify(
    request: Request,
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    db: Session = Depends(get_db),
):
    """
    Верифікація webhook від Instagram/Facebook.
    Facebook надсилає GET запит з параметрами для перевірки.
    """
    logger.info(f"Instagram webhook verification: mode={hub_mode}, token={hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token:
        # Примусово перечитуємо налаштування з БД (без кешування)
        db.expire_all()  # Скидаємо кеш SQLAlchemy
        service = InstagramService(db)
        verify_token = service.config.get("verify_token", "")
        
        logger.info(f"Instagram verify_token from config: {verify_token[:10]}..." if verify_token else "Instagram verify_token from config: (empty)")
        logger.info(f"Instagram verify_token from Meta: {hub_verify_token[:10]}..." if hub_verify_token else "Instagram verify_token from Meta: (empty)")
        print(f"[Instagram Webhook] verify_token from config: {verify_token[:10] if verify_token else '(empty)'}...", flush=True)
        print(f"[Instagram Webhook] verify_token from Meta: {hub_verify_token[:10] if hub_verify_token else '(empty)'}...", flush=True)
        
        if hub_verify_token == verify_token:
            logger.info("Instagram webhook verified successfully")
            # Повертаємо challenge для підтвердження
            return PlainTextResponse(content=hub_challenge, status_code=200)
        else:
            logger.warning(f"Instagram webhook verification failed: token mismatch. Expected: {verify_token[:10] if verify_token else '(empty)'}..., Got: {hub_verify_token[:10] if hub_verify_token else '(empty)'}...")
            print(f"[Instagram Webhook] Token mismatch! Expected: '{verify_token}' (len={len(verify_token)}), Got: '{hub_verify_token}' (len={len(hub_verify_token)})", flush=True)
            raise HTTPException(status_code=403, detail="Verification failed")
    
    logger.warning(f"Instagram webhook verification failed: invalid request. mode={hub_mode}, has_token={bool(hub_verify_token)}")
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/instagram/webhook")
async def instagram_webhook_handler(request: Request, db: Session = Depends(get_db)):
    """
    Обробка вхідних повідомлень від Instagram
    """
    try:
        # Get signature from headers
        signature = request.headers.get("X-Hub-Signature-256", "")
        
        # Read raw body for signature verification
        body_bytes = await request.body()
        
        # Verify webhook signature
        service = InstagramService(db)
        if signature and not service.verify_webhook(signature, body_bytes):
            logger.warning("Instagram webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse JSON payload
        data = await request.json()
        logger.info(f"Instagram webhook received: {data}")
        
        # Process webhook
        result = await handle_instagram_webhook(db, data)
        
        return result
    except Exception as e:
        logger.error(f"Instagram webhook error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Instagram Data Deletion and Deauthorization endpoints (Meta requirements)
# ============================================================================

@router.post("/instagram/deauthorize")
async def instagram_deauthorize(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint для деавторизації Instagram (Meta requirement).
    Викликається Meta коли користувач видаляє додаток або відкликає дозволи.
    """
    try:
        # Meta надсилає signed_request
        body = await request.body()
        data = await request.json() if body else {}
        
        logger.info(f"Instagram deauthorization request received: {data}")
        
        # Отримуємо user_id з запиту (Meta надсилає signed_request)
        signed_request = data.get("signed_request", "")
        user_id = data.get("user_id") or data.get("psid")
        
        if user_id:
            # Видаляємо access_token для цього користувача
            # В нашому випадку ми зберігаємо один access_token для всієї сторінки
            # Тому просто очищаємо налаштування
            crud.set_setting(db, "instagram_access_token", "")
            logger.info(f"Instagram access token cleared for user: {user_id}")
        
        # Meta очікує 200 OK
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Instagram deauthorization error: {e}", exc_info=True)
        # Все одно повертаємо 200, щоб Meta не повторював запити
        return {"status": "ok", "error": str(e)}


@router.post("/instagram/data-deletion")
async def instagram_data_deletion(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint для видалення даних Instagram (Meta requirement).
    Викликається Meta коли користувач запитує видалення своїх даних.
    """
    try:
        body = await request.body()
        data = await request.json() if body else {}
        
        logger.info(f"Instagram data deletion request received: {data}")
        
        # Отримуємо user_id з запиту
        user_id = data.get("user_id") or data.get("psid")
        confirmation_code = data.get("confirmation_code", "")
        
        if user_id:
            # Видаляємо дані користувача з Instagram conversations
            # Знаходимо всі розмови Instagram для цього користувача
            conversations = db.query(Conversation).filter(
                Conversation.platform == PlatformEnum.INSTAGRAM,
                Conversation.external_id == str(user_id)
            ).all()
            
            deleted_count = 0
            for conversation in conversations:
                # Видаляємо повідомлення
                db.query(Message).filter(
                    Message.conversation_id == conversation.id
                ).delete()
                # Видаляємо розмову
                db.delete(conversation)
                deleted_count += 1
            
            db.commit()
            logger.info(f"Deleted {deleted_count} Instagram conversations for user: {user_id}")
        
        # Meta очікує confirmation_code в відповіді
        return {
            "url": f"https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status?confirmation_code={confirmation_code}",
            "confirmation_code": confirmation_code
        }
    except Exception as e:
        logger.error(f"Instagram data deletion error: {e}", exc_info=True)
        return {
            "url": "",
            "confirmation_code": data.get("confirmation_code", "")
        }


@router.get("/instagram/data-deletion-status")
async def instagram_data_deletion_status(
    confirmation_code: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Endpoint для перевірки статусу видалення даних (Meta requirement).
    """
    logger.info(f"Instagram data deletion status check: {confirmation_code}")
    
    # В реальному застосунку тут можна перевірити статус видалення
    # Для простоти повертаємо підтвердження
    return {
        "status": "completed",
        "confirmation_code": confirmation_code,
        "message": "Data deletion completed"
    }


@router.get("/webhooks/facebook")
async def facebook_webhook_verify(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    db: Session = Depends(get_db),
):
    """
    Facebook webhook verification endpoint (GET).
    Meta requires this for webhook setup.
    """
    logger.info(f"Facebook webhook verification: mode={hub_mode}, token={hub_verify_token}")
    
    if hub_mode == "subscribe" and hub_verify_token:
        service = FacebookService(db)
        verify_token = service.config.get("verify_token", "")
        
        logger.info(f"Facebook verify_token from config: {verify_token[:10]}..." if verify_token else "Facebook verify_token from config: (empty)")
        logger.info(f"Facebook verify_token from Meta: {hub_verify_token[:10]}..." if hub_verify_token else "Facebook verify_token from Meta: (empty)")
        
        if hub_verify_token == verify_token:
            logger.info("Facebook webhook verified successfully")
            return int(hub_challenge) if hub_challenge else 200
        else:
            logger.warning(f"Facebook webhook verification failed: token mismatch. Expected: {verify_token[:10] if verify_token else '(empty)'}..., Got: {hub_verify_token[:10] if hub_verify_token else '(empty)'}...")
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    
    logger.warning(f"Facebook webhook verification failed: invalid request. mode={hub_mode}, has_token={bool(hub_verify_token)}")
    raise HTTPException(status_code=400, detail="Invalid verification request")


@router.post("/webhooks/facebook")
async def facebook_webhook_receive(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Facebook webhook endpoint (POST) - receives messages from Meta.
    """
    try:
        # Get signature from headers
        signature = request.headers.get("X-Hub-Signature-256", "")
        
        # Read raw body for signature verification
        body_bytes = await request.body()
        
        # Verify webhook signature
        service = FacebookService(db)
        if signature and not service.verify_webhook(signature, body_bytes):
            logger.warning("Facebook webhook signature verification failed")
            raise HTTPException(status_code=403, detail="Invalid signature")
        
        # Parse JSON payload
        webhook_data = await request.json()
        logger.info(f"Facebook webhook received: {webhook_data.get('object', 'unknown')}")
        
        # Process webhook
        result = await handle_facebook_webhook(db, webhook_data)
        
        return result
    except Exception as e:
        logger.error(f"Facebook webhook error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# OAuth endpoints for Facebook authorization
# ============================================================================

@router.get("/facebook/auth")
async def facebook_oauth_start(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Початок OAuth flow для Facebook.
    Перенаправляє користувача на Meta OAuth сторінку.
    """
    import urllib.parse
    from fastapi.responses import RedirectResponse
    
    # Отримуємо налаштування Facebook
    settings = crud.get_facebook_settings(db)
    app_id = settings.get("facebook_app_id")
    
    # Якщо немає facebook_app_id, спробуємо отримати з Instagram (можуть використовувати один App ID)
    if not app_id:
        instagram_settings = crud.get_instagram_settings(db)
        app_id = instagram_settings.get("instagram_app_id")
    
    if not app_id:
        raise HTTPException(
            status_code=400,
            detail="Facebook App ID не налаштовано. Будь ласка, введіть App ID в Settings → Facebook або Instagram."
        )
    
    # Формуємо redirect_uri (повний URL) - завжди використовуємо HTTPS
    base_url = str(request.base_url).rstrip('/')
    # Замінюємо HTTP на HTTPS (для production завжди використовуємо HTTPS)
    base_url = base_url.replace("http://", "https://", 1)
    redirect_uri = f"{base_url}/api/v1/communications/facebook/callback"
    
    # Перевіряємо, чи використовується Facebook Login for Business (config_id)
    config_id = settings.get("facebook_config_id")
    
    # OAuth параметри для Meta
    oauth_params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "state": str(uuid_module.uuid4()),  # CSRF protection
    }
    
    # Якщо є config_id, використовуємо Facebook Login for Business
    if config_id:
        oauth_params["config_id"] = config_id
        logger.info(f"Using Facebook Login for Business with config_id: {config_id}")
    else:
        # Стандартний Facebook Login з scope
        oauth_params["scope"] = "pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging"
        logger.info("Using standard Facebook Login with scope")
    
    # Meta OAuth URL (використовуємо v22.0)
    oauth_url = "https://www.facebook.com/v22.0/dialog/oauth?" + urllib.parse.urlencode(oauth_params)
    
    logger.info(f"Facebook OAuth redirect: {oauth_url}")
    return RedirectResponse(url=oauth_url)


@router.get("/facebook/callback")
async def facebook_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_reason: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    OAuth callback endpoint для Facebook.
    Обробляє redirect від Meta після авторизації.
    """
    import httpx
    import urllib.parse
    from fastapi.responses import HTMLResponse
    
    # Перевірка на помилки
    if error:
        error_msg = f"OAuth помилка: {error}"
        if error_description:
            error_msg += f" - {error_description}"
        logger.error(f"Facebook OAuth error: {error_msg}")
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Facebook OAuth Error</title></head>
                <body>
                    <h1>Помилка авторизації Facebook</h1>
                    <p>{error_msg}</p>
                    <p><a href="/settings">Повернутися до налаштувань</a></p>
                </body>
            </html>
            """,
            status_code=400
        )
    
    if not code:
        raise HTTPException(status_code=400, detail="OAuth code не отримано")
    
    # Отримуємо налаштування
    settings = crud.get_facebook_settings(db)
    app_id = settings.get("facebook_app_id")
    app_secret = settings.get("facebook_app_secret")
    
    # Якщо немає facebook налаштувань, спробуємо Instagram (можуть використовувати один App)
    if not app_id or not app_secret:
        instagram_settings = crud.get_instagram_settings(db)
        app_id = app_id or instagram_settings.get("instagram_app_id")
        app_secret = app_secret or instagram_settings.get("instagram_app_secret")
    
    if not app_id or not app_secret:
        raise HTTPException(
            status_code=400,
            detail="Facebook App ID або App Secret не налаштовано"
        )
    
    try:
        # Обмінюємо code на access_token (використовуємо v22.0)
        token_url = "https://graph.facebook.com/v22.0/oauth/access_token"
        token_params = {
            "client_id": app_id,
            "client_secret": app_secret,
            "grant_type": "authorization_code",
            "code": code,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(token_url, params=token_params)
            response.raise_for_status()
            token_data = response.json()
        
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Access token не отримано від Meta")
        
        # Отримуємо інформацію про сторінки користувача (використовуємо v22.0)
        pages_url = "https://graph.facebook.com/v22.0/me/accounts"
        pages_params = {"access_token": access_token}
        
        async with httpx.AsyncClient() as client:
            pages_response = await client.get(pages_url, params=pages_params)
            pages_response.raise_for_status()
            pages_data = pages_response.json()
        
        # Беремо першу сторінку (або можна додати вибір сторінки)
        facebook_page_id = None
        if pages_data.get("data"):
            facebook_page_id = pages_data["data"][0]["id"]
        
        # Зберігаємо access_token та page_id в налаштуваннях
        crud.set_setting(db, "facebook_access_token", access_token)
        if facebook_page_id:
            crud.set_setting(db, "facebook_page_id", facebook_page_id)
        
        logger.info(f"Facebook OAuth successful. Access token saved. Page ID: {facebook_page_id}")
        
        return HTMLResponse(
            content=f"""
            <html>
                <head>
                    <title>Facebook OAuth Success</title>
                    <meta http-equiv="refresh" content="3;url=/settings">
                </head>
                <body>
                    <h1>✅ Facebook успішно підключено!</h1>
                    <p>Access token збережено. Перенаправлення до налаштувань...</p>
                    <p><a href="/settings">Перейти до налаштувань</a></p>
                    <script>
                        setTimeout(function() {{
                            window.location.href = '/settings';
                        }}, 3000);
                    </script>
                </body>
            </html>
            """
        )
        
    except httpx.HTTPStatusError as e:
        error_detail = f"HTTP {e.response.status_code}: {e.response.text}"
        logger.error(f"Facebook OAuth token exchange error: {error_detail}")
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Facebook OAuth Error</title></head>
                <body>
                    <h1>Помилка обміну токену</h1>
                    <p>{error_detail}</p>
                    <p><a href="/settings">Повернутися до налаштувань</a></p>
                </body>
            </html>
            """,
            status_code=500
        )
    except Exception as e:
        logger.error(f"Facebook OAuth error: {e}", exc_info=True)
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Facebook OAuth Error</title></head>
                <body>
                    <h1>Помилка авторизації Facebook</h1>
                    <p>{str(e)}</p>
                    <p><a href="/settings">Повернутися до налаштувань</a></p>
                </body>
            </html>
            """,
            status_code=500
        )


# ============================================================================
# Endpoint for exchanging authorization code to access token (from frontend)
# ============================================================================

@router.post("/facebook/exchange-code")
async def facebook_exchange_code(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Обмін authorization code на access token.
    Використовується коли фронтенд викликає FB.login() і отримує code.
    """
    import httpx
    import json
    
    # Отримуємо code з body
    try:
        body = await request.json()
        code = body.get("code")
    except:
        raise HTTPException(status_code=400, detail="Code не отримано в body")
    
    if not code:
        raise HTTPException(status_code=400, detail="Code не вказано")
    
    # Отримуємо налаштування
    settings = crud.get_facebook_settings(db)
    app_id = settings.get("facebook_app_id")
    app_secret = settings.get("facebook_app_secret")
    
    # Якщо немає facebook налаштувань, спробуємо Instagram
    if not app_id or not app_secret:
        instagram_settings = crud.get_instagram_settings(db)
        app_id = app_id or instagram_settings.get("instagram_app_id")
        app_secret = app_secret or instagram_settings.get("instagram_app_secret")
    
    if not app_id or not app_secret:
        raise HTTPException(
            status_code=400,
            detail="Facebook App ID або App Secret не налаштовано"
        )
    
    try:
        # Обмінюємо code на access_token (використовуємо v22.0)
        token_url = "https://graph.facebook.com/v22.0/oauth/access_token"
        token_params = {
            "client_id": app_id,
            "client_secret": app_secret,
            "grant_type": "authorization_code",
            "code": code,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(token_url, params=token_params)
            response.raise_for_status()
            token_data = response.json()
        
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Access token не отримано від Meta")
        
        # Отримуємо інформацію про сторінки та WhatsApp Business акаунти
        pages_url = "https://graph.facebook.com/v22.0/me/accounts"
        pages_params = {"access_token": access_token}
        
        async with httpx.AsyncClient() as client:
            pages_response = await client.get(pages_url, params=pages_params)
            pages_response.raise_for_status()
            pages_data = pages_response.json()
        
        # Зберігаємо access_token в налаштуваннях
        crud.set_setting(db, "facebook_access_token", access_token)
        
        # Збираємо інформацію про сторінки та WhatsApp Business акаунти
        result = {
            "access_token": access_token,
            "pages": [],
            "whatsapp_accounts": [],
        }
        
        for page in pages_data.get("data", []):
            page_info = {
                "page_id": page.get("id"),
                "page_name": page.get("name"),
                "page_access_token": page.get("access_token"),
            }
            result["pages"].append(page_info)
            
            # Перевіряємо чи є WhatsApp Business акаунт
            if "whatsapp_business_account" in page:
                whatsapp_info = page["whatsapp_business_account"]
                result["whatsapp_accounts"].append({
                    "waba_id": whatsapp_info.get("id"),
                    "page_id": page.get("id"),
                    "page_name": page.get("name"),
                })
        
        # Якщо знайдено тільки одну сторінку - зберігаємо автоматично
        if len(result["pages"]) == 1:
            page = result["pages"][0]
            if page["page_id"]:
                crud.set_setting(db, "facebook_page_id", page["page_id"])
        
        logger.info(f"Facebook code exchange successful. Access token saved.")
        return result
        
    except httpx.HTTPStatusError as e:
        error_detail = f"HTTP {e.response.status_code}"
        try:
            error_data = e.response.json()
            error_detail = error_data.get("error", {}).get("message", error_detail)
        except:
            pass
        logger.error(f"Facebook code exchange error: {error_detail}")
        raise HTTPException(status_code=400, detail=f"Помилка обміну коду: {error_detail}")
    except Exception as e:
        logger.error(f"Facebook code exchange error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Помилка обміну коду: {str(e)}")


# ============================================================================
# Instagram OAuth endpoints (status and disconnect)
# ============================================================================

@router.get("/webhooks/instagram/status")
async def instagram_status(
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """Перевірка статусу підключення Instagram."""
    settings = crud.get_instagram_settings(db)
    access_token = settings.get("instagram_access_token")
    
    return {
        "connected": bool(access_token),
        "has_page_id": bool(settings.get("instagram_page_id")),
        "has_business_id": bool(settings.get("instagram_business_id")),
    }


@router.post("/webhooks/instagram/disconnect")
async def instagram_disconnect(
    db: Session = Depends(get_db),
    user_payload = Depends(get_current_user_db),
):
    """Відключення Instagram - видаляє токени з бази даних."""
    # Видаляємо токени та налаштування
    crud.set_setting(db, "instagram_access_token", "")
    crud.set_setting(db, "instagram_page_id", "")
    crud.set_setting(db, "instagram_page_name", "")
    crud.set_setting(db, "instagram_business_id", "")
    crud.set_setting(db, "instagram_page_access_token", "")
    
    logger.info("Instagram disconnected")
    
    return {"status": "removed"}


# ============================================================================
# Meta App Review endpoints for Facebook (Deauthorization & Data Deletion)
# ============================================================================

@router.post("/facebook/deauthorize")
async def facebook_deauthorize(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint для деавторизації Facebook.
    Викликається Meta коли користувач видаляє додаток або відкликає дозволи.
    
    Meta надсилає POST запит з signed_request в body.
    """
    import json
    import base64
    import hmac
    import hashlib
    
    try:
        body = await request.body()
        data = await request.form()
        
        # Meta надсилає signed_request як form data
        signed_request = data.get("signed_request", "")
        
        if not signed_request:
            # Спробуємо отримати з JSON body
            try:
                json_body = await request.json()
                signed_request = json_body.get("signed_request", "")
            except:
                pass
        
        if not signed_request:
            logger.warning("Facebook deauthorize: signed_request not found")
            return {"status": "ok"}  # Повертаємо 200 OK навіть якщо дані невалідні
        
        # Розпаковуємо signed_request
        # Формат: <signature>.<payload>
        parts = signed_request.split('.')
        if len(parts) != 2:
            logger.warning("Facebook deauthorize: invalid signed_request format")
            return {"status": "ok"}
        
        signature, payload = parts
        
        # Декодуємо payload (base64url)
        # Додаємо padding якщо потрібно
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        
        try:
            decoded_payload = base64.urlsafe_b64decode(payload)
            payload_data = json.loads(decoded_payload)
        except Exception as e:
            logger.error(f"Facebook deauthorize: error decoding payload: {e}")
            return {"status": "ok"}
        
        # Отримуємо user_id з payload
        user_id = payload_data.get("user_id")
        
        if user_id:
            # Очищаємо access_token для цього користувача
            # Для Facebook ми зберігаємо access_token в налаштуваннях, тому просто очищаємо його
            crud.set_setting(db, "facebook_access_token", "")
            crud.set_setting(db, "facebook_page_id", "")
            
            logger.info(f"Facebook deauthorize: cleared access token for user {user_id}")
        
        return {"status": "ok"}
        
    except Exception as e:
        logger.error(f"Facebook deauthorize error: {e}", exc_info=True)
        # Все одно повертаємо 200 OK, щоб Meta не повторював запити
        return {"status": "ok"}


@router.post("/facebook/data-deletion")
async def facebook_data_deletion(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint для запиту на видалення даних Facebook.
    Викликається Meta коли користувач запитує видалення своїх даних.
    
    Meta надсилає POST запит з user_id та signed_request.
    """
    import json
    import base64
    import uuid
    
    try:
        data = await request.form()
        
        # Отримуємо user_id та signed_request
        user_id = data.get("user_id", "")
        signed_request = data.get("signed_request", "")
        
        if not user_id:
            # Спробуємо отримати з JSON body
            try:
                json_body = await request.json()
                user_id = json_body.get("user_id", "")
                signed_request = json_body.get("signed_request", "")
            except:
                pass
        
        if not user_id:
            logger.warning("Facebook data deletion: user_id not found")
            # Генеруємо confirmation_code навіть якщо user_id відсутній
            confirmation_code = str(uuid.uuid4())
            return {
                "url": f"https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status?confirmation_code={confirmation_code}",
                "confirmation_code": confirmation_code
            }
        
        # Генеруємо confirmation_code
        confirmation_code = str(uuid.uuid4())
        
        # Видаляємо дані користувача
        # Шукаємо розмови Facebook для цього користувача
        from modules.communications.models import Conversation, Message, PlatformEnum
        
        conversations = db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.FACEBOOK,
            Conversation.external_id == str(user_id)
        ).all()
        
        deleted_messages = 0
        deleted_conversations = 0
        
        for conversation in conversations:
            # Видаляємо повідомлення
            messages = db.query(Message).filter(
                Message.conversation_id == conversation.id
            ).all()
            
            for message in messages:
                db.delete(message)
                deleted_messages += 1
            
            # Видаляємо розмову
            db.delete(conversation)
            deleted_conversations += 1
        
        db.commit()
        
        logger.info(f"Facebook data deletion: deleted {deleted_messages} messages and {deleted_conversations} conversations for user {user_id}")
        
        return {
            "url": f"https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status?confirmation_code={confirmation_code}",
            "confirmation_code": confirmation_code
        }
        
    except Exception as e:
        logger.error(f"Facebook data deletion error: {e}", exc_info=True)
        # Генеруємо confirmation_code навіть при помилці
        confirmation_code = str(uuid.uuid4())
        return {
            "url": f"https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status?confirmation_code={confirmation_code}",
            "confirmation_code": confirmation_code
        }


@router.get("/facebook/data-deletion-status")
async def facebook_data_deletion_status(
    confirmation_code: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Endpoint для перевірки статусу видалення даних Facebook.
    Meta використовує цей URL для перевірки статусу видалення.
    """
    # Для простоти повертаємо статус "completed"
    # В реальному застосунку можна зберігати статус в БД та перевіряти confirmation_code
    return {
        "status": "completed",
        "confirmation_code": confirmation_code,
        "message": "Data deletion request has been processed"
    }


# ============================================================================
# OAuth endpoints for Instagram authorization
# ============================================================================

@router.get("/instagram/auth")
async def instagram_oauth_start(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Початок OAuth flow для Instagram.
    Перенаправляє користувача на Meta OAuth сторінку.
    """
    import urllib.parse
    from fastapi.responses import RedirectResponse
    
    # Отримуємо налаштування Instagram
    settings = crud.get_instagram_settings(db)
    app_id = settings.get("instagram_app_id")
    
    if not app_id:
        raise HTTPException(
            status_code=400,
            detail="Instagram App ID не налаштовано. Будь ласка, введіть App ID в Settings → Instagram."
        )
    
    # Формуємо redirect_uri (повний URL) - завжди використовуємо HTTPS
    base_url = str(request.base_url).rstrip('/')
    # Замінюємо HTTP на HTTPS (для production завжди використовуємо HTTPS)
    base_url = base_url.replace("http://", "https://", 1)
    redirect_uri = f"{base_url}/api/v1/communications/instagram/callback"
    
    # OAuth параметри для Meta
    # Instagram використовує Facebook Login OAuth
    oauth_params = {
        "client_id": app_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "instagram_basic,instagram_manage_messages,pages_show_list,pages_read_engagement",  # Instagram permissions
        "state": str(uuid_module.uuid4()),  # CSRF protection
    }
    
    # Meta OAuth URL
    oauth_url = "https://www.facebook.com/v18.0/dialog/oauth?" + urllib.parse.urlencode(oauth_params)
    
    logger.info(f"Instagram OAuth redirect: {oauth_url}")
    return RedirectResponse(url=oauth_url)


@router.get("/instagram/callback")
async def instagram_oauth_callback(
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None),
    error_reason: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    OAuth callback endpoint для Instagram.
    Обробляє redirect від Meta після авторизації.
    """
    import httpx
    import urllib.parse
    from fastapi.responses import HTMLResponse
    
    # Перевірка на помилки
    if error:
        error_msg = f"OAuth помилка: {error}"
        if error_description:
            error_msg += f" - {error_description}"
        logger.error(f"Instagram OAuth error: {error_msg}")
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Instagram OAuth Error</title></head>
                <body>
                    <h1>Помилка авторизації Instagram</h1>
                    <p>{error_msg}</p>
                    <p><a href="/settings">Повернутися до налаштувань</a></p>
                </body>
            </html>
            """,
            status_code=400
        )
    
    if not code:
        raise HTTPException(status_code=400, detail="OAuth code не отримано")
    
    # Отримуємо налаштування
    settings = crud.get_instagram_settings(db)
    app_id = settings.get("instagram_app_id")
    app_secret = settings.get("instagram_app_secret")
    
    if not app_id or not app_secret:
        raise HTTPException(
            status_code=400,
            detail="Instagram App ID або App Secret не налаштовано"
        )
    
    try:
        # Обмінюємо code на access_token (використовуємо v22.0)
        token_url = "https://graph.facebook.com/v22.0/oauth/access_token"
        token_params = {
            "client_id": app_id,
            "client_secret": app_secret,
            "grant_type": "authorization_code",
            "code": code,
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.get(token_url, params=token_params)
            response.raise_for_status()
            token_data = response.json()
        
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Access token не отримано від Meta")
        
        # Отримуємо інформацію про сторінку Instagram
        # Спочатку отримуємо список сторінок користувача (використовуємо v22.0)
        pages_url = "https://graph.facebook.com/v22.0/me/accounts"
        pages_params = {"access_token": access_token}
        
        async with httpx.AsyncClient() as client:
            pages_response = await client.get(pages_url, params=pages_params)
            pages_response.raise_for_status()
            pages_data = pages_response.json()
        
        # Збираємо всі сторінки з Instagram Business акаунтами
        instagram_pages = []
        for page in pages_data.get("data", []):
            if "instagram_business_account" in page:
                instagram_pages.append({
                    "page_id": page["id"],
                    "page_name": page.get("name", ""),
                    "business_id": page["instagram_business_account"]["id"],
                    "page_access_token": page.get("access_token", ""),
                })
        
        # Зберігаємо access_token в налаштуваннях
        crud.set_setting(db, "instagram_access_token", access_token)
        
        # Якщо знайдено тільки одну сторінку - зберігаємо автоматично
        if len(instagram_pages) == 1:
            page = instagram_pages[0]
            crud.set_setting(db, "instagram_page_id", page["page_id"])
            if page["page_name"]:
                crud.set_setting(db, "instagram_page_name", page["page_name"])
            if page["business_id"]:
                crud.set_setting(db, "instagram_business_id", page["business_id"])
            if page["page_access_token"]:
                crud.set_setting(db, "instagram_page_access_token", page["page_access_token"])
            
            logger.info(f"Instagram OAuth successful. Access token saved. Page ID: {page['page_id']}")
            
            return HTMLResponse(
                content=f"""
                <html>
                    <head>
                        <title>Instagram OAuth Success</title>
                        <meta http-equiv="refresh" content="3;url=/settings">
                    </head>
                    <body>
                        <h1>✅ Instagram успішно підключено!</h1>
                        <p>Сторінка "{page['page_name']}" підключена. Перенаправлення до налаштувань...</p>
                        <p><a href="/settings">Перейти до налаштувань</a></p>
                        <script>
                            setTimeout(function() {{
                                window.location.href = '/settings';
                            }}, 3000);
                        </script>
                    </body>
                </html>
                """
            )
        
        # Якщо знайдено кілька сторінок - показуємо вибір
        elif len(instagram_pages) > 1:
            import json
            import base64
            # Кодуємо дані про сторінки в base64 для передачі через URL
            pages_json = json.dumps(instagram_pages)
            pages_encoded = base64.b64encode(pages_json.encode()).decode()
            
            # Формуємо HTML з вибором сторінок
            pages_options = ""
            for idx, page in enumerate(instagram_pages):
                pages_options += f"""
                    <div style="margin: 10px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px;">
                        <input type="radio" name="page" value="{idx}" id="page_{idx}" style="margin-right: 10px;">
                        <label for="page_{idx}" style="cursor: pointer;">
                            <strong>{page['page_name'] or 'Без назви'}</strong><br>
                            <small style="color: #666;">Page ID: {page['page_id']}</small>
                        </label>
                    </div>
                """
            
            return HTMLResponse(
                content=f"""
                <html>
                    <head>
                        <title>Вибір Instagram сторінки</title>
                        <style>
                            body {{ font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }}
                            h1 {{ color: #333; }}
                            button {{ background: #FF5A00; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }}
                            button:hover {{ background: #FF5A00/90; }}
                            button:disabled {{ background: #ccc; cursor: not-allowed; }}
                        </style>
                    </head>
                    <body>
                        <h1>Оберіть Instagram сторінку</h1>
                        <p>Знайдено {len(instagram_pages)} сторінок з Instagram Business акаунтами. Оберіть одну для підключення:</p>
                        <form id="pageForm" onsubmit="return false;">
                            {pages_options}
                            <input type="hidden" id="pagesData" value="{pages_encoded}">
                            <button type="button" onclick="selectPage()" id="selectBtn" disabled style="margin-top: 20px;">
                                Підключити вибрану сторінку
                            </button>
                        </form>
                        <script>
                            // Вмикаємо кнопку коли вибрано сторінку
                            document.querySelectorAll('input[name="page"]').forEach(radio => {{
                                radio.addEventListener('change', function() {{
                                    document.getElementById('selectBtn').disabled = false;
                                }});
                            }});
                            
                            function selectPage() {{
                                const selected = document.querySelector('input[name="page"]:checked');
                                if (!selected) {{
                                    alert('Будь ласка, оберіть сторінку');
                                    return;
                                }}
                                
                                const pagesData = document.getElementById('pagesData').value;
                                const pageIndex = parseInt(selected.value);
                                
                                // Відправляємо запит на збереження
                                fetch('/api/v1/communications/instagram/select-page', {{
                                    method: 'POST',
                                    headers: {{
                                        'Content-Type': 'application/json',
                                    }},
                                    body: JSON.stringify({{
                                        pages_data: pagesData,
                                        page_index: pageIndex
                                    }})
                                }})
                                .then(response => response.json())
                                .then(data => {{
                                    if (data.status === 'success') {{
                                        window.location.href = '/settings';
                                    }} else {{
                                        alert('Помилка: ' + (data.detail || 'Невідома помилка'));
                                    }}
                                }})
                                .catch(error => {{
                                    console.error('Error:', error);
                                    alert('Помилка при збереженні сторінки');
                                }});
                            }}
                        </script>
                    </body>
                </html>
                """
            )
        
        # Якщо сторінок не знайдено
        else:
            logger.warning("Instagram OAuth: не знайдено сторінок з Instagram Business акаунтами")
            return HTMLResponse(
                content=f"""
                <html>
                    <head><title>Instagram OAuth Error</title></head>
                    <body>
                        <h1>⚠️ Сторінки не знайдено</h1>
                        <p>Не знайдено жодної сторінки Facebook з підключеним Instagram Business акаунтом.</p>
                        <p>Переконайтеся, що:</p>
                        <ul>
                            <li>У вас є Facebook сторінка</li>
                            <li>Сторінка підключена до Instagram Business акаунту</li>
                            <li>Ви надали необхідні дозволи при авторизації</li>
                        </ul>
                        <p><a href="/settings">Повернутися до налаштувань</a></p>
                    </body>
                </html>
                """,
                status_code=400
            )
        
    except httpx.HTTPStatusError as e:
        error_detail = f"HTTP {e.response.status_code}: {e.response.text}"
        logger.error(f"Instagram OAuth token exchange error: {error_detail}")
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Instagram OAuth Error</title></head>
                <body>
                    <h1>Помилка обміну токену</h1>
                    <p>{error_detail}</p>
                    <p><a href="/settings">Повернутися до налаштувань</a></p>
                </body>
            </html>
            """,
            status_code=500
        )
    except Exception as e:
        logger.error(f"Instagram OAuth error: {e}", exc_info=True)
        return HTMLResponse(
            content=f"""
            <html>
                <head><title>Instagram OAuth Error</title></head>
                <body>
                    <h1>Помилка авторизації Instagram</h1>
                    <p>{str(e)}</p>
                    <p><a href="/settings">Повернутися до налаштувань</a></p>
                </body>
            </html>
            """,
            status_code=500
        )


@router.post("/instagram/select-page")
async def instagram_select_page(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Endpoint для збереження вибраної Instagram сторінки після OAuth.
    """
    import json
    import base64
    from fastapi.responses import JSONResponse
    
    try:
        data = await request.json()
        pages_data_encoded = data.get("pages_data")
        page_index = data.get("page_index")
        
        if not pages_data_encoded or page_index is None:
            raise HTTPException(status_code=400, detail="Необхідні дані не надано")
        
        # Декодуємо дані про сторінки
        pages_json = base64.b64decode(pages_data_encoded.encode()).decode()
        instagram_pages = json.loads(pages_json)
        
        if page_index < 0 or page_index >= len(instagram_pages):
            raise HTTPException(status_code=400, detail="Невірний індекс сторінки")
        
        # Отримуємо вибрану сторінку
        selected_page = instagram_pages[page_index]
        
        # Зберігаємо дані сторінки
        crud.set_setting(db, "instagram_page_id", selected_page["page_id"])
        if selected_page["page_name"]:
            crud.set_setting(db, "instagram_page_name", selected_page["page_name"])
        if selected_page["business_id"]:
            crud.set_setting(db, "instagram_business_id", selected_page["business_id"])
        if selected_page["page_access_token"]:
            crud.set_setting(db, "instagram_page_access_token", selected_page["page_access_token"])
        
        logger.info(f"Instagram page selected: {selected_page['page_name']} (ID: {selected_page['page_id']})")
        
        return JSONResponse(content={"status": "success"})
        
    except Exception as e:
        logger.error(f"Error selecting Instagram page: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Помилка при збереженні сторінки: {str(e)}")


# ============================================================================
# Danger Zone - Delete ALL conversations
# ============================================================================

class DeleteAllConversationsRequest(BaseModel):
    confirm: bool = False

@router.delete("/conversations/all")
async def delete_all_conversations(
    body: DeleteAllConversationsRequest = Body(...),
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """
    Видалити ВСІ переписки (email, telegram, whatsapp, instagram, facebook).
    Потрібне підтвердження confirm=true.
    Тільки для авторизованих користувачів.
    """
    if not body.confirm:
        raise HTTPException(status_code=400, detail="Потрібне підтвердження: confirm=true")
    
    try:
        from modules.communications.models import Attachment
        
        # 1. Видалити всі attachments (файли)
        attachments = db.query(Attachment).all()
        attachment_count = len(attachments)
        for att in attachments:
            # Видалити фізичний файл
            try:
                file_path = Path("/app/media") / att.file_path
                if file_path.exists():
                    file_path.unlink()
            except Exception as e:
                logger.warning(f"Failed to delete file {att.file_path}: {e}")
            db.delete(att)
        
        # 2. Видалити всі повідомлення
        message_count = db.query(Message).count()
        db.query(Message).delete()
        
        # 3. Видалити всі conversations
        conversation_count = db.query(Conversation).count()
        db.query(Conversation).delete()
        
        db.commit()
        
        logger.info(
            f"🗑️ ALL conversations deleted by user {user.id}: "
            f"{conversation_count} conversations, {message_count} messages, {attachment_count} attachments"
        )
        
        return {
            "status": "success",
            "deleted": {
                "conversations": conversation_count,
                "messages": message_count,
                "attachments": attachment_count,
            }
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete all conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Помилка при видаленні: {str(e)}")
