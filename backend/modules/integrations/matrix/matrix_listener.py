#!/usr/bin/env python3
"""
Matrix event listener for WhatsApp bridge messages.
Polls Synapse via matrix-nio /sync for new events from mautrix-whatsapp rooms.
Runs as a separate Docker service (crm_matrix_listener).

Pattern: same as telegram_listener.py and email_imap_listener.py --
uses raw SQL + httpx for WebSocket broadcast, no FastAPI dependency.
"""
import asyncio
import logging
import os
import sys
import json
from datetime import datetime, timezone
from uuid import uuid4
from pathlib import Path

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
import httpx

# Import models so SQLAlchemy knows about them for relationships
from modules.auth.models import User  # noqa: F401
from modules.crm.models import Client, Office, Order  # noqa: F401
from modules.communications.models import Conversation, Message  # noqa: F401
from modules.notifications.models import Notification, NotificationSettings  # noqa: F401
from modules.autobot.models import AutobotSettings, AutobotHoliday, AutobotLog  # noqa: F401
from modules.finance.models import Transaction, Shipment  # noqa: F401
from modules.payment.models import PaymentTransaction  # noqa: F401
from modules.postal_services.models import InPostShipment  # noqa: F401

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://translator:traslatorini2025@localhost:5434/crm_db")
WEBSOCKET_NOTIFY_URL = os.getenv("WEBSOCKET_NOTIFY_URL", "http://localhost:8000/api/v1/communications/test-notification")
MATRIX_HOMESERVER = os.getenv("MATRIX_HOMESERVER", "http://synapse:8008")
MATRIX_ACCESS_TOKEN = os.getenv("MATRIX_ACCESS_TOKEN", "")
MATRIX_USER_ID = os.getenv("MATRIX_USER_ID", "")
MATRIX_DEVICE_ID = os.getenv("MATRIX_DEVICE_ID", "")
POLL_INTERVAL = int(os.getenv("MATRIX_POLL_INTERVAL", "5"))

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def load_matrix_config_from_db():
    """Load Matrix config from database settings if env vars are not set."""
    global MATRIX_HOMESERVER, MATRIX_ACCESS_TOKEN, MATRIX_USER_ID, MATRIX_DEVICE_ID

    if MATRIX_ACCESS_TOKEN:
        return  # Already configured via env

    db = Session()
    try:
        result = db.execute(text("""
            SELECT key, value FROM settings
            WHERE key IN (
                'matrix_homeserver', 'matrix_access_token',
                'matrix_user_id', 'matrix_device_id'
            )
        """))
        settings = {row[0]: row[1] for row in result}

        if settings.get("matrix_homeserver"):
            MATRIX_HOMESERVER = settings["matrix_homeserver"]
        if settings.get("matrix_access_token"):
            MATRIX_ACCESS_TOKEN = settings["matrix_access_token"]
        if settings.get("matrix_user_id"):
            MATRIX_USER_ID = settings.get("matrix_user_id", "")
        if settings.get("matrix_device_id"):
            MATRIX_DEVICE_ID = settings.get("matrix_device_id", "")
    except Exception as e:
        logger.warning(f"Could not load Matrix config from DB: {e}")
    finally:
        db.close()


def get_or_create_conversation(db, external_id: str, subject: str = None):
    """Get or create WhatsApp conversation with race-condition protection."""
    result = db.execute(text("""
        SELECT id FROM communications_conversations
        WHERE platform = 'whatsapp' AND external_id = :external_id
    """), {"external_id": external_id})
    row = result.fetchone()

    if row:
        return str(row[0])

    conv_id = str(uuid4())
    now = datetime.now(timezone.utc)
    try:
        db.execute(text("""
            INSERT INTO communications_conversations (id, platform, external_id, subject, created_at, updated_at)
            VALUES (:id, 'whatsapp', :external_id, :subject, :now, :now)
        """), {"id": conv_id, "external_id": external_id, "subject": subject, "now": now})
        db.commit()
    except IntegrityError:
        db.rollback()
        result = db.execute(text("""
            SELECT id FROM communications_conversations
            WHERE platform = 'whatsapp' AND external_id = :external_id
        """), {"external_id": external_id})
        row = result.fetchone()
        if row:
            return str(row[0])
        raise

    logger.info(f"Created new WhatsApp conversation: {conv_id} for {external_id}")
    return conv_id


def save_message(db, conv_id: str, content: str, msg_type: str = "text",
                 attachments: list = None, meta_data: dict = None, msg_id: str = None):
    """Save incoming message to database."""
    if msg_id is None:
        msg_id = str(uuid4())
    now = datetime.now(timezone.utc)

    attachments_json = json.dumps(attachments) if attachments else None
    meta_data_json = json.dumps(meta_data) if meta_data else None

    db.execute(text("""
        INSERT INTO communications_messages
            (id, conversation_id, direction, type, content, status, attachments, meta_data, created_at)
        VALUES
            (:id, :conv_id, 'inbound', :msg_type, :content, 'sent',
             CAST(:attachments AS jsonb), CAST(:meta_data AS jsonb), :now)
    """), {
        "id": msg_id,
        "conv_id": conv_id,
        "content": content,
        "msg_type": msg_type,
        "attachments": attachments_json,
        "meta_data": meta_data_json,
        "now": now
    })

    # Update conversation last activity
    db.execute(text("""
        UPDATE communications_conversations SET updated_at = :now WHERE id = :conv_id
    """), {"now": now, "conv_id": conv_id})

    db.commit()
    logger.info(f"Saved Matrix message: {msg_id} in conversation {conv_id}")
    return msg_id


async def notify_websocket(conv_id: str, msg_id: str, content: str,
                           sender_name: str, external_id: str, msg_type: str = "text"):
    """Notify WebSocket clients about new message via HTTP broadcast."""
    try:
        broadcast_url = WEBSOCKET_NOTIFY_URL
        if "test-notification" in broadcast_url:
            broadcast_url = broadcast_url.replace("test-notification", "broadcast-message")

        async with httpx.AsyncClient() as client:
            notification = {
                "type": "new_message",
                "conversation_id": conv_id,
                "platform": "whatsapp",
                "platform_icon": "\U0001f4ac",
                "platform_name": "WhatsApp",
                "message": {
                    "id": msg_id,
                    "conversation_id": conv_id,
                    "direction": "inbound",
                    "type": msg_type,
                    "content": content,
                    "status": "sent",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "conversation": {
                    "id": conv_id,
                    "platform": "whatsapp",
                    "external_id": external_id,
                    "client_name": sender_name or external_id,
                }
            }
            response = await client.post(broadcast_url, json=notification, timeout=5.0)
            logger.info(f"WebSocket notification sent: {response.status_code} to {broadcast_url}")
    except Exception as e:
        logger.warning(f"Failed to send WebSocket notification: {e}")


def extract_phone_from_sender(sender: str) -> str:
    """
    Extract phone number from mautrix-whatsapp Matrix user ID.

    mautrix-whatsapp creates users like @whatsapp_48123456789:crm.local
    """
    if not sender or ":" not in sender:
        return sender

    user_part = sender.split(":")[0].lstrip("@")

    # mautrix-whatsapp pattern: whatsapp_PHONE
    if user_part.startswith("whatsapp_"):
        phone = user_part.replace("whatsapp_", "")
        if phone.isdigit():
            return f"+{phone}"
        return phone

    # Maybe the user ID itself starts with +
    if user_part.startswith("+"):
        return user_part

    return sender


def parse_event_content(content: dict) -> tuple:
    """
    Parse Matrix event content into (text, msg_type, attachments).

    Returns:
        (content_text, message_type, attachments_list_or_None)
    """
    msgtype = content.get("msgtype", "")

    if msgtype == "m.text":
        body = content.get("body", "")
        return body, "text", None

    elif msgtype == "m.image":
        body = content.get("body", "Image")
        url = content.get("url", "")
        info = content.get("info", {})
        attachments = [{
            "type": "image",
            "url": url,
            "filename": body,
            "mime_type": info.get("mimetype", "image/jpeg"),
            "size": info.get("size"),
        }]
        return body, "image", attachments

    elif msgtype == "m.video":
        body = content.get("body", "Video")
        url = content.get("url", "")
        info = content.get("info", {})
        attachments = [{
            "type": "video",
            "url": url,
            "filename": body,
            "mime_type": info.get("mimetype", "video/mp4"),
            "size": info.get("size"),
        }]
        return body, "video", attachments

    elif msgtype in ("m.audio", "m.voice"):
        body = content.get("body", "Audio")
        url = content.get("url", "")
        info = content.get("info", {})
        attachments = [{
            "type": "audio",
            "url": url,
            "filename": body,
            "mime_type": info.get("mimetype", "audio/ogg"),
            "size": info.get("size"),
        }]
        return body, "audio", attachments

    elif msgtype == "m.file":
        body = content.get("body", "File")
        url = content.get("url", "")
        info = content.get("info", {})
        attachments = [{
            "type": "document",
            "url": url,
            "filename": body,
            "mime_type": info.get("mimetype", "application/octet-stream"),
            "size": info.get("size"),
        }]
        return body, "file", attachments

    else:
        body = content.get("body", str(content))
        return body, "text", None


async def process_event(room_id: str, event, my_user_id: str):
    """Process a single Matrix timeline event."""
    # Only process m.room.message events
    event_type = getattr(event, "type", None) or (
        event.source.get("type") if hasattr(event, "source") else None
    )
    if event_type != "m.room.message":
        return

    sender = getattr(event, "sender", "")
    event_id = getattr(event, "event_id", str(uuid4()))

    # Skip own messages
    if sender == my_user_id:
        return

    # Skip bot messages (mautrix-whatsapp bot)
    if "whatsappbot" in sender.lower():
        return

    # Extract content
    if hasattr(event, "source"):
        content = event.source.get("content", {})
    else:
        content = {}

    text_content, msg_type, attachments = parse_event_content(content)
    if not text_content and not attachments:
        return

    # Extract phone number
    phone = extract_phone_from_sender(sender)
    sender_name = content.get("displayname") or phone

    # Build metadata
    meta_data = {
        "matrix_event_id": event_id,
        "matrix_room_id": room_id,
        "matrix_sender": sender,
        "source": "matrix_bridge",
    }

    # Save to DB
    db = Session()
    try:
        # Check for duplicate by matrix_event_id
        existing = db.execute(text("""
            SELECT id FROM communications_messages
            WHERE meta_data->>'matrix_event_id' = :event_id
            LIMIT 1
        """), {"event_id": event_id})
        if existing.fetchone():
            logger.debug(f"Event {event_id} already processed, skipping")
            return

        conv_id = get_or_create_conversation(db, phone, subject=sender_name)
        msg_id = save_message(
            db, conv_id, text_content,
            msg_type=msg_type,
            attachments=attachments,
            meta_data=meta_data,
        )

        logger.info(f"New WhatsApp message from {phone}: {text_content[:50]}...")

        await notify_websocket(
            conv_id=conv_id,
            msg_id=msg_id,
            content=text_content,
            sender_name=sender_name,
            external_id=phone,
            msg_type=msg_type,
        )
    except Exception as e:
        logger.error(f"Error processing event {event_id}: {e}", exc_info=True)
    finally:
        db.close()


async def connect_with_retry(client, max_retries: int = 5):
    """Connect to Matrix homeserver with exponential backoff."""
    last_error = None
    for attempt in range(max_retries):
        try:
            response = await client.whoami()
            if hasattr(response, "user_id") and response.user_id:
                logger.info(f"Connected to Matrix as {response.user_id}")
                return response.user_id
            else:
                raise ValueError("Failed to authenticate with Matrix")
        except Exception as e:
            last_error = e
            wait_time = 2 ** attempt
            logger.warning(f"Matrix connect attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait_time}s...")
            await asyncio.sleep(wait_time)

    logger.error(f"Failed to connect to Matrix after {max_retries} attempts: {last_error}")
    raise last_error


async def listen():
    """Main Matrix event listener loop using matrix-nio."""
    try:
        from nio import AsyncClient, RoomMessageText, RoomMessageMedia
    except ImportError:
        logger.error("matrix-nio is required. Install with: pip install matrix-nio")
        sys.exit(1)

    # Load config from DB if env vars not set
    load_matrix_config_from_db()

    if not MATRIX_ACCESS_TOKEN:
        logger.error("MATRIX_ACCESS_TOKEN not configured (neither in env nor in DB). Exiting.")
        sys.exit(1)

    logger.info(f"Connecting to Matrix homeserver: {MATRIX_HOMESERVER}")

    client = AsyncClient(
        homeserver=MATRIX_HOMESERVER,
        user=MATRIX_USER_ID or "",
        access_token=MATRIX_ACCESS_TOKEN,
        device_id=MATRIX_DEVICE_ID or None,
    )

    try:
        my_user_id = await connect_with_retry(client, max_retries=5)
        logger.info(f"Matrix listener connected as {my_user_id}. Starting sync loop...")

        since_token = None
        while True:
            try:
                sync_response = await client.sync(
                    timeout=30000,
                    since=since_token,
                )

                if hasattr(sync_response, "next_batch"):
                    since_token = sync_response.next_batch

                # Process events from joined rooms
                if hasattr(sync_response, "rooms") and hasattr(sync_response.rooms, "join"):
                    for room_id, room_data in sync_response.rooms.join.items():
                        if hasattr(room_data, "timeline") and hasattr(room_data.timeline, "events"):
                            for event in room_data.timeline.events:
                                try:
                                    await process_event(room_id, event, my_user_id)
                                except Exception as e:
                                    evt_id = getattr(event, "event_id", "unknown")
                                    logger.error(f"Error processing event {evt_id} in {room_id}: {e}", exc_info=True)

            except Exception as e:
                logger.error(f"Matrix sync error: {e}", exc_info=True)
                await asyncio.sleep(POLL_INTERVAL)

                # Try to reconnect
                try:
                    my_user_id = await connect_with_retry(client, max_retries=3)
                    logger.info("Reconnected to Matrix after sync error")
                except Exception as reconnect_error:
                    logger.error(f"Reconnect failed: {reconnect_error}")
                    await asyncio.sleep(POLL_INTERVAL * 2)

    except KeyboardInterrupt:
        logger.info("Matrix listener stopped by user")
    except Exception as e:
        logger.error(f"Fatal error in Matrix listener: {e}", exc_info=True)
    finally:
        await client.close()
        logger.info("Matrix listener shutdown complete")


if __name__ == "__main__":
    logger.info("Starting Matrix WhatsApp Bridge listener...")
    asyncio.run(listen())
