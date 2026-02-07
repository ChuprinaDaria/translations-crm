#!/usr/bin/env python3
"""
Telegram Listener - слухає вхідні повідомлення і зберігає їх у БД.
Запускати окремо: python telegram_listener.py
"""
import asyncio
import logging
import os
import sys
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path
import json

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from telethon import TelegramClient, events
from telethon.sessions import StringSession
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import httpx

# Імпортуємо моделі щоб SQLAlchemy знав про них для relationship
from modules.auth.models import User  # noqa: F401
from modules.crm.models import Client, Office, Order  # noqa: F401 - Office потребує AutobotSettings, Order потребує Transaction
from modules.communications.models import Conversation, Message  # noqa: F401
from modules.notifications.models import Notification, NotificationSettings  # noqa: F401
from modules.autobot.models import AutobotSettings, AutobotHoliday, AutobotLog  # noqa: F401 - для Office relationship
from modules.finance.models import Transaction  # noqa: F401 - для Order relationship
from modules.payment.models import PaymentTransaction  # noqa: F401 - для Order.payment_transactions relationship
from modules.postal_services.models import InPostShipment  # noqa: F401 - для Order.inpost_shipments relationship

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://translator:traslatorini2025@localhost:5434/crm_db")
# В Docker використовуємо backend:8000, локально - localhost:8000
WEBSOCKET_NOTIFY_URL = os.getenv("WEBSOCKET_NOTIFY_URL", "http://localhost:8000/api/v1/communications/test-notification")

# Files directory
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads" / "messages"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def get_telegram_accounts():
    """Get all active Telegram accounts from database."""
    db = Session()
    try:
        result = db.execute(text("""
            SELECT id, name, phone, session_string, api_id, api_hash
            FROM telegram_accounts
            WHERE is_active = true AND session_string IS NOT NULL
        """))
        accounts = []
        for row in result:
            accounts.append({
                "id": row[0],
                "name": row[1],
                "phone": row[2],
                "session_string": row[3],
                "api_id": row[4],
                "api_hash": row[5],
            })
        return accounts
    finally:
        db.close()


def get_or_create_conversation(db, external_id: str, sender_name: str = None, subject: str = None, chat_id: int = None):
    """Get or create conversation for external_id."""
    # Check if conversation exists
    result = db.execute(text("""
        SELECT id, meta_data FROM communications_conversations
        WHERE platform = 'telegram' AND external_id = :external_id
    """), {"external_id": external_id})
    row = result.fetchone()
    
    if row:
        conv_id = str(row[0])
        # Update meta_data with chat_id if not already set
        if chat_id:
            existing_meta = row[1] if row[1] else {}
            if isinstance(existing_meta, str):
                existing_meta = json.loads(existing_meta)
            if not existing_meta.get('telegram_chat_id'):
                existing_meta['telegram_chat_id'] = chat_id
                db.execute(text("""
                    UPDATE communications_conversations 
                    SET meta_data = CAST(:meta_data AS jsonb)
                    WHERE id = :conv_id
                """), {"conv_id": conv_id, "meta_data": json.dumps(existing_meta)})
                db.commit()
                logger.info(f"Updated conversation {conv_id} with chat_id: {chat_id}")
        return conv_id
    
    # Create new conversation with chat_id in meta_data
    conv_id = str(uuid4())
    now = datetime.utcnow()
    meta_data = {"telegram_chat_id": chat_id} if chat_id else {}
    db.execute(text("""
        INSERT INTO communications_conversations (id, platform, external_id, subject, meta_data, created_at, updated_at)
        VALUES (:id, 'telegram', :external_id, :subject, CAST(:meta_data AS jsonb), :now, :now)
    """), {"id": conv_id, "external_id": external_id, "subject": subject, "meta_data": json.dumps(meta_data), "now": now})
    db.commit()
    
    logger.info(f"Created new conversation: {conv_id} for {external_id} (subject: {subject}, chat_id: {chat_id})")
    return conv_id


def save_message(db, conv_id: str, content: str, sender_name: str, external_id: str, attachments: list = None, msg_type: str = "text", meta_data: dict = None):
    """Save incoming message to database."""
    msg_id = str(uuid4())
    now = datetime.now(timezone.utc)
    
    attachments_json = json.dumps(attachments) if attachments else None
    meta_data_json = json.dumps(meta_data) if meta_data else None
    
    db.execute(text("""
        INSERT INTO communications_messages (id, conversation_id, direction, type, content, status, attachments, meta_data, created_at)
        VALUES (:id, :conv_id, 'inbound', :msg_type, :content, 'sent', CAST(:attachments AS jsonb), CAST(:meta_data AS jsonb), :now)
    """), {
        "id": msg_id, 
        "conv_id": conv_id, 
        "content": content, 
        "msg_type": msg_type,
        "attachments": attachments_json,
        "meta_data": meta_data_json,
        "now": now
    })
    db.commit()
    
    logger.info(f"Saved message: {msg_id} from {sender_name or external_id}")
    return msg_id


async def download_media(client, message, db, message_id) -> dict:
    """Download media from Telegram message and return attachment info."""
    try:
        if not message.media:
            return None
        
        # Generate unique filename
        file_id = str(uuid4())
        ext = ""
        mime_type = "application/octet-stream"
        file_type = "file"
        original_name = "file"
        
        # Determine file type and extension
        if message.photo:
            ext = ".jpg"
            mime_type = "image/jpeg"
            file_type = "image"
            original_name = "photo.jpg"
        elif message.document:
            attrs = message.document.attributes
            for attr in attrs:
                if hasattr(attr, 'file_name'):
                    original_name = attr.file_name
                    ext = Path(original_name).suffix
                    break
            mime_type = message.document.mime_type or "application/octet-stream"
            
            if mime_type.startswith('image/'):
                file_type = "image"
            elif mime_type.startswith('video/'):
                file_type = "video"
            elif mime_type.startswith('audio/'):
                file_type = "audio"
            elif 'pdf' in mime_type or 'document' in mime_type:
                file_type = "document"
        elif message.video:
            ext = ".mp4"
            mime_type = "video/mp4"
            file_type = "video"
            original_name = "video.mp4"
        elif message.audio:
            ext = ".mp3"
            mime_type = "audio/mpeg"
            file_type = "audio"
            original_name = "audio.mp3"
        elif message.voice:
            ext = ".ogg"
            mime_type = "audio/ogg"
            file_type = "audio"
            original_name = "voice.ogg"
        elif message.video_note:
            ext = ".mp4"
            mime_type = "video/mp4"
            file_type = "video"
            original_name = "video_note.mp4"
        
        if not ext:
            ext = ".bin"
        
        # Download to temporary location first
        temp_path = UPLOADS_DIR / f"temp_{uuid4()}{ext}"
        await client.download_media(message, file=str(temp_path))
        
        # Read file data
        with open(temp_path, "rb") as f:
            file_data = f.read()
        
        # Remove temp file
        temp_path.unlink()
        
        # Save using new media utility
        from modules.communications.utils.media import save_media_file
        from uuid import UUID
        
        attachment = save_media_file(
            db=db,
            message_id=UUID(message_id),
            file_data=file_data,
            mime_type=mime_type,
            original_name=original_name,
            file_type=file_type,
        )
        
        logger.info(f"📎 Downloaded and saved media: {original_name} ({attachment.file_size} bytes)")
        
        return {
            "id": str(attachment.id),
            "type": file_type,
            "filename": original_name,
            "mime_type": mime_type,
            "size": attachment.file_size,
            "url": f"/media/{attachment.file_path}",  # Використовуємо повний шлях з БД: attachments/filename
        }
        
    except Exception as e:
        logger.error(f"Error downloading media: {e}")
        return None


async def process_autobot(client, db, conv_id: str, msg_id: str, external_id: str, sender_name: str, content: str, chat_id: int = None):
    """Process autobot auto-reply for incoming message if outside working hours."""
    try:
        import pytz
        from datetime import time as dt_time
        
        # Find enabled autobot settings
        result = db.execute(text("""
            SELECT s.id, s.office_id, s.enabled, s.auto_reply_message, s.use_ai_reply,
                   s.monday_start, s.monday_end,
                   s.tuesday_start, s.tuesday_end,
                   s.wednesday_start, s.wednesday_end,
                   s.thursday_start, s.thursday_end,
                   s.friday_start, s.friday_end,
                   s.saturday_start, s.saturday_end,
                   s.sunday_start, s.sunday_end
            FROM autobot_settings s
            WHERE s.enabled = true
            LIMIT 1
        """))
        row = result.fetchone()
        
        if not row:
            logger.debug("🤖 No active autobot settings found")
            return
        
        settings_id = row[0]
        office_id = row[1]
        auto_reply_message = row[3]
        use_ai_reply = row[4]
        
        # Day schedule: (start, end) tuples indexed by weekday (0=Mon)
        day_schedules = [
            (row[5], row[6]),    # Monday
            (row[7], row[8]),    # Tuesday
            (row[9], row[10]),   # Wednesday
            (row[11], row[12]),  # Thursday
            (row[13], row[14]),  # Friday
            (row[15], row[16]),  # Saturday
            (row[17], row[18]),  # Sunday
        ]
        
        # Check current time in Warsaw timezone
        now = datetime.now(pytz.timezone('Europe/Warsaw'))
        weekday = now.weekday()  # 0 = Monday
        current_time = now.time()
        current_date = now.date()
        
        # Check if today is a holiday
        holiday_result = db.execute(text("""
            SELECT id FROM autobot_holidays 
            WHERE settings_id = :settings_id AND date = :today
            LIMIT 1
        """), {"settings_id": settings_id, "today": current_date})
        is_holiday = holiday_result.fetchone() is not None
        
        if not is_holiday:
            # Check recurring holidays (same day and month)
            recurring_result = db.execute(text("""
                SELECT id FROM autobot_holidays 
                WHERE settings_id = :settings_id 
                  AND is_recurring = true
                  AND EXTRACT(MONTH FROM date) = :month
                  AND EXTRACT(DAY FROM date) = :day
                LIMIT 1
            """), {"settings_id": settings_id, "month": current_date.month, "day": current_date.day})
            is_holiday = recurring_result.fetchone() is not None
        
        # Determine if currently working hours
        is_working = False
        
        if is_holiday:
            is_working = False
            logger.info(f"🤖 Today is a holiday, autobot active")
        else:
            start_time, end_time = day_schedules[weekday]
            if start_time and end_time:
                if start_time <= current_time <= end_time:
                    is_working = True
            # If no schedule for today → non-working day
        
        if is_working:
            logger.debug(f"🤖 Working hours ({now.strftime('%H:%M')}), autobot skipped")
            return
        
        logger.info(f"🤖 Non-working hours ({now.strftime('%A %H:%M')}), activating autobot for {external_id}")
        
        # Check if we already sent an auto-reply to this conversation recently (within 2 hours)
        recent_reply = db.execute(text("""
            SELECT id FROM autobot_logs
            WHERE settings_id = :settings_id
              AND action_taken = 'auto_reply'
              AND success = true
              AND meta_data->>'conversation_id' = :conv_id
              AND created_at > NOW() - INTERVAL '2 hours'
            LIMIT 1
        """), {"settings_id": settings_id, "conv_id": conv_id})
        
        if recent_reply.fetchone():
            logger.info(f"🤖 Auto-reply already sent to {external_id} recently, skipping")
            return
        
        # Determine reply text
        reply_text = None
        ai_generated = False
        
        if use_ai_reply:
            # Try AI reply via backend HTTP call
            try:
                backend_url = os.getenv("WEBSOCKET_NOTIFY_URL", "http://localhost:8000/api/v1/communications/test-notification")
                # Derive base URL
                base_url = backend_url.split("/api/v1/")[0] if "/api/v1/" in backend_url else "http://backend:8000"
                
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    ai_response = await http_client.post(
                        f"{base_url}/api/v1/ai/generate-reply",
                        json={
                            "message": content,
                            "conversation_id": conv_id,
                            "platform": "telegram",
                            "context": {
                                "sender_name": sender_name,
                                "office_id": office_id,
                                "autobot": True,
                            }
                        },
                        timeout=15.0
                    )
                    if ai_response.status_code == 200:
                        ai_data = ai_response.json()
                        if ai_data.get("reply"):
                            reply_text = ai_data["reply"]
                            ai_generated = True
                            logger.info(f"🤖 AI generated reply for {external_id}")
            except Exception as e:
                logger.warning(f"🤖 AI reply failed, using static message: {e}")
        
        # Fallback to static auto-reply message
        if not reply_text and auto_reply_message:
            reply_text = auto_reply_message
        
        if not reply_text:
            logger.warning(f"🤖 No reply text available for autobot")
            return
        
        # Send the auto-reply using the existing Telegram client
        try:
            entity = None
            
            # Спочатку пробуємо за chat_id (найнадійніший спосіб)
            if chat_id:
                try:
                    entity = await client.get_entity(chat_id)
                    logger.info(f"🤖 Found entity by chat_id: {chat_id}")
                except Exception as e:
                    logger.warning(f"🤖 Failed to get entity by chat_id {chat_id}: {e}")
            
            # Якщо не вдалось за chat_id, пробуємо за external_id
            if not entity:
                if external_id.startswith('@'):
                    entity = await client.get_entity(external_id)
                    logger.info(f"🤖 Found entity by username: {external_id}")
                elif external_id.startswith('+'):
                    # Для номера телефону шукаємо в діалогах
                    phone_digits = external_id.replace('+', '').replace(' ', '').replace('-', '')
                    async for dialog in client.iter_dialogs():
                        if hasattr(dialog.entity, 'phone') and dialog.entity.phone:
                            dialog_phone = dialog.entity.phone.replace(' ', '').replace('-', '')
                            if dialog_phone == phone_digits or dialog_phone.endswith(phone_digits[-9:]):
                                entity = dialog.entity
                                logger.info(f"🤖 Found entity in dialogs by phone: {external_id}")
                                break
                else:
                    try:
                        entity = await client.get_entity(int(external_id))
                        logger.info(f"🤖 Found entity by numeric ID: {external_id}")
                    except (ValueError, TypeError):
                        entity = await client.get_entity(external_id)
            
            if entity:
                await client.send_message(entity, reply_text)
                logger.info(f"🤖 Auto-reply sent to {external_id}")
                
                # Save auto-reply message to DB
                reply_msg_id = str(uuid4())
                now_utc = datetime.now(timezone.utc)
                meta_data = json.dumps({
                    "autobot": True, 
                    "auto_reply": True,
                    "ai_generated": ai_generated,
                    "author_name": "Автобот",
                    "author_display": "Автобот (Автовідповідь)",
                })
                
                db.execute(text("""
                    INSERT INTO communications_messages 
                        (id, conversation_id, direction, type, content, status, meta_data, created_at, sent_at)
                    VALUES 
                        (:id, :conv_id, 'outbound', 'text', :content, 'sent', 
                         CAST(:meta_data AS jsonb), :now, :now)
                """), {
                    "id": reply_msg_id,
                    "conv_id": conv_id,
                    "content": reply_text,
                    "meta_data": meta_data,
                    "now": now_utc,
                })
                db.commit()
                
                # Notify WebSocket about the auto-reply
                await notify_websocket(
                    conv_id, reply_msg_id, reply_text,
                    "Автобот", external_id
                )
                
                # Log the action
                log_meta = json.dumps({
                    "conversation_id": conv_id,
                    "ai_generated": ai_generated,
                    "external_id": external_id,
                })
                db.execute(text("""
                    INSERT INTO autobot_logs 
                        (settings_id, office_id, message_id, action_taken, success, meta_data, created_at)
                    VALUES 
                        (:settings_id, :office_id, :message_id, 'auto_reply', true, 
                         CAST(:meta_data AS jsonb), :now)
                """), {
                    "settings_id": settings_id,
                    "office_id": office_id,
                    "message_id": msg_id,
                    "meta_data": log_meta,
                    "now": now_utc,
                })
                db.commit()
                
                logger.info(f"🤖 Autobot complete for {external_id}")
            else:
                logger.error(f"🤖 Could not resolve entity for {external_id}")
                
        except Exception as e:
            logger.error(f"🤖 Failed to send auto-reply to {external_id}: {e}", exc_info=True)
            # Log failure
            try:
                now_utc = datetime.now(timezone.utc)
                db.execute(text("""
                    INSERT INTO autobot_logs 
                        (settings_id, office_id, message_id, action_taken, success, error_message, created_at)
                    VALUES 
                        (:settings_id, :office_id, :message_id, 'auto_reply', false, :error, :now)
                """), {
                    "settings_id": settings_id,
                    "office_id": office_id,
                    "message_id": msg_id,
                    "error": str(e),
                    "now": now_utc,
                })
                db.commit()
            except:
                pass
                
    except Exception as e:
        logger.error(f"🤖 Autobot error: {e}", exc_info=True)


async def notify_websocket(conv_id: str, msg_id: str, content: str, sender_name: str, external_id: str, attachments: list = None, msg_type: str = "text"):
    """Notify WebSocket clients about new message."""
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
        
        async with httpx.AsyncClient() as client:
            # Send to custom notification endpoint
            notification = {
                "type": "new_message",
                "conversation_id": conv_id,
                "platform": "telegram",  # Додаємо platform
                "platform_icon": platform_icons.get('telegram', '💬'),
                "platform_name": platform_names.get('telegram', 'Telegram'),
                "message": {
                    "id": msg_id,
                    "conversation_id": conv_id,
                    "direction": "inbound",
                    "type": msg_type,
                    "content": content,
                    "status": "sent",
                    "attachments": attachments,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "conversation": {
                    "id": conv_id,
                    "platform": "telegram",
                    "external_id": external_id,
                    "client_name": sender_name or external_id,
                }
            }
            
            # Post to broadcast endpoint (which broadcasts to all WebSocket clients)
            # Використовуємо WEBSOCKET_NOTIFY_URL з env, але fallback на broadcast-message
            broadcast_url = os.getenv("WEBSOCKET_NOTIFY_URL", "http://localhost:8000/api/v1/communications/broadcast-message")
            # Якщо URL вказує на test-notification, замінюємо на broadcast-message
            if "test-notification" in broadcast_url:
                broadcast_url = broadcast_url.replace("test-notification", "broadcast-message")
            
            response = await client.post(
                broadcast_url,
                json=notification,
                timeout=5.0
            )
            logger.info(f"WebSocket notification sent: {response.status_code} to {broadcast_url}")
    except Exception as e:
        logger.warning(f"Failed to send WebSocket notification: {e}", exc_info=True)


async def run_listener_for_account(account: dict):
    """Run Telegram listener for a single account with auto-reconnect."""
    account_name = account["name"]
    session_string = account["session_string"]
    api_id = account["api_id"]
    api_hash = account["api_hash"]
    
    if not api_id or not api_hash:
        logger.error(f"Account {account_name}: missing api_id or api_hash")
        return
    
    # Автоматичний перезапуск при відключенні
    max_retries = 10  # Максимальна кількість спроб перезапуску
    retry_count = 0
    retry_delay = 5  # Початкова затримка в секундах
    
    while retry_count < max_retries:
        try:
            logger.info(f"Starting listener for account: {account_name} (attempt {retry_count + 1})")
            
            client = TelegramClient(
                StringSession(session_string),
                api_id,
                api_hash
            )
            
            @client.on(events.NewMessage(incoming=True))
            async def handler(event):
                """Handle incoming message."""
                try:
                    # Get chat and sender info
                    chat_id = event.chat_id
                    sender = await event.get_sender()
                    sender_name = None
                    user_id = None
                    username = None
                    phone = None
                    
                    # Determine if this is a group/channel (chat_id < 0, typically starts with -100)
                    is_group_or_channel = chat_id < 0
                    
                    if sender:
                        first_name = getattr(sender, 'first_name', '') or ''
                        last_name = getattr(sender, 'last_name', '') or ''
                        sender_name = f"{first_name} {last_name}".strip()
                        user_id = getattr(sender, 'id', None)
                        username = getattr(sender, 'username', None)
                        phone = getattr(sender, 'phone', None)
                    
                    # Determine external_id based on chat type
                    if is_group_or_channel:
                        # For groups/channels: use chat_id as external_id (one conversation per group)
                        external_id = str(chat_id)
                        conversation_subject = None
                        
                        # Try multiple methods to get chat title
                        try:
                            # Method 1: Try to get from event.get_chat()
                            chat = await event.get_chat()
                            if hasattr(chat, 'title') and chat.title:
                                conversation_subject = chat.title
                            elif hasattr(chat, 'first_name') and chat.first_name:
                                conversation_subject = chat.first_name
                        except Exception as e1:
                            logger.debug(f"Failed to get chat via event.get_chat(): {e1}")
                        
                        # Method 2: Try to get from event.message.chat if available
                        if not conversation_subject:
                            try:
                                if hasattr(event.message, 'chat') and event.message.chat:
                                    if hasattr(event.message.chat, 'title') and event.message.chat.title:
                                        conversation_subject = event.message.chat.title
                                    elif hasattr(event.message.chat, 'first_name') and event.message.chat.first_name:
                                        conversation_subject = event.message.chat.first_name
                            except Exception as e2:
                                logger.debug(f"Failed to get chat from event.message.chat: {e2}")
                        
                        # Method 3: Try to get from peer_id if available
                        if not conversation_subject:
                            try:
                                if hasattr(event.message, 'peer_id'):
                                    peer = event.message.peer_id
                                    if hasattr(peer, 'title') and peer.title:
                                        conversation_subject = peer.title
                            except Exception as e3:
                                logger.debug(f"Failed to get chat from peer_id: {e3}")
                        
                        # Fallback: use chat_id if no title found
                        if not conversation_subject:
                            conversation_subject = f"Група {chat_id}"
                            logger.info(f"Could not get chat title for {chat_id}, using fallback")
                        else:
                            logger.info(f"Got chat title: {conversation_subject} for chat_id: {chat_id}")
                    else:
                        # For private chats: use user_id (or phone/username if available)
                        if phone:
                            external_id = f"+{phone}"
                        elif username:
                            external_id = f"@{username}"
                        elif user_id:
                            external_id = str(user_id)
                        else:
                            external_id = str(chat_id)
                        conversation_subject = sender_name or external_id
                    
                    content = event.message.text or ""
                    attachments = []
                    msg_type = "text"
                    
                    # Prepare meta_data for message
                    meta_data = {
                        "telegram_chat_id": chat_id,
                        "is_group_message": is_group_or_channel,
                    }
                    if user_id:
                        meta_data["telegram_user_id"] = user_id
                    if username:
                        meta_data["telegram_username"] = username
                    if phone:
                        meta_data["telegram_phone"] = phone
                    
                    # Save to database first to get message_id
                    db = Session()
                    try:
                        conv_id = get_or_create_conversation(db, external_id, sender_name, conversation_subject, chat_id=chat_id)
                        
                        # Save message first (will update if media found)
                        temp_content = content or "[Медіа повідомлення]"
                        msg_id = save_message(
                            db, conv_id, temp_content, sender_name, external_id, 
                            attachments=None,  # Will be updated after media download
                            msg_type=msg_type,
                            meta_data=meta_data
                        )
                        
                        logger.info(f"📩 New message from {sender_name or external_id}: {temp_content[:50]}...")
                        
                        # 🚀 Notify WebSocket IMMEDIATELY (before media download!)
                        # This ensures the message appears in the CRM instantly
                        await notify_websocket(
                            conv_id, msg_id, temp_content, sender_name, external_id,
                            attachments=None,
                            msg_type=msg_type
                        )
                        
                        # Check for media and download (can take 10-30s)
                        if event.message.media:
                            attachment = await download_media(client, event.message, db, msg_id)
                            if attachment:
                                attachments.append(attachment)
                                msg_type = attachment["type"]
                                if not content:
                                    content = f"[{attachment['type'].capitalize()}: {attachment['filename']}]"
                                
                                # Update message with attachment info
                                import json
                                db.execute(text("""
                                    UPDATE communications_messages 
                                    SET content = :content, type = :msg_type, attachments = CAST(:attachments AS jsonb), meta_data = CAST(:meta_data AS jsonb)
                                    WHERE id = :msg_id
                                """), {
                                    "content": content,
                                    "msg_type": msg_type,
                                    "attachments": json.dumps(attachments),
                                    "meta_data": json.dumps(meta_data),
                                    "msg_id": msg_id
                                })
                                db.commit()
                                
                                # 🚀 Send SECOND notification with attachments
                                await notify_websocket(
                                    conv_id, msg_id, content, sender_name, external_id,
                                    attachments=attachments,
                                    msg_type=msg_type
                                )
                        
                        if not content and not attachments:
                            content = "[Пусте повідомлення]"
                        
                        # Process autobot (auto-reply outside working hours)
                        try:
                            await process_autobot(
                                client, db, conv_id, msg_id, 
                                external_id, sender_name, 
                                content or "",
                                chat_id=chat_id  # Передаємо chat_id для надійної відправки
                            )
                        except Exception as autobot_err:
                            logger.error(f"🤖 Autobot processing error: {autobot_err}", exc_info=True)
                        
                    except Exception as e:
                        logger.error(f"Error handling message: {e}", exc_info=True)
                    finally:
                        db.close()
                except Exception as e:
                    logger.error(f"Error in handler: {e}", exc_info=True)
            
            await client.start()
            logger.info(f"✅ Listener started for account: {account_name}")
            
            # Скинути лічильник спроб при успішному підключенні
            retry_count = 0
            retry_delay = 5
            
            # Keep running
            await client.run_until_disconnected()
            
            logger.warning(f"⚠️ Telegram client disconnected for account: {account_name}")
            
        except Exception as e:
            retry_count += 1
            logger.error(f"❌ Error in Telegram listener for {account_name}: {e}", exc_info=True)
            
            if retry_count < max_retries:
                logger.info(f"🔄 Reconnecting in {retry_delay} seconds... (attempt {retry_count}/{max_retries})")
                await asyncio.sleep(retry_delay)
                # Збільшити затримку для наступної спроби (exponential backoff)
                retry_delay = min(retry_delay * 2, 60)  # Максимум 60 секунд
            else:
                logger.error(f"❌ Max retries reached for account {account_name}. Stopping listener.")
                break
        
        # Закрити клієнт якщо він ще відкритий
        try:
            if 'client' in locals() and client.is_connected():
                await client.disconnect()
        except:
            pass
    
    logger.error(f"❌ Telegram listener stopped for account: {account_name}")


async def main():
    """Main entry point."""
    logger.info("🚀 Starting Telegram Listener...")
    
    accounts = get_telegram_accounts()
    
    if not accounts:
        logger.warning("No active Telegram accounts found!")
        return
    
    logger.info(f"Found {len(accounts)} active account(s)")
    
    # Run listeners for all accounts
    tasks = [run_listener_for_account(acc) for acc in accounts]
    await asyncio.gather(*tasks)


if __name__ == "__main__":
    asyncio.run(main())

