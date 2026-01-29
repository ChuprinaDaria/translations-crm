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


def get_or_create_conversation(db, external_id: str, sender_name: str = None):
    """Get or create conversation for external_id."""
    # Check if conversation exists
    result = db.execute(text("""
        SELECT id FROM communications_conversations
        WHERE platform = 'telegram' AND external_id = :external_id
    """), {"external_id": external_id})
    row = result.fetchone()
    
    if row:
        return str(row[0])
    
    # Create new conversation
    conv_id = str(uuid4())
    now = datetime.utcnow()
    db.execute(text("""
        INSERT INTO communications_conversations (id, platform, external_id, created_at, updated_at)
        VALUES (:id, 'telegram', :external_id, :now, :now)
    """), {"id": conv_id, "external_id": external_id, "now": now})
    db.commit()
    
    logger.info(f"Created new conversation: {conv_id} for {external_id}")
    return conv_id


def save_message(db, conv_id: str, content: str, sender_name: str, external_id: str, attachments: list = None, msg_type: str = "text"):
    """Save incoming message to database."""
    msg_id = str(uuid4())
    now = datetime.now(timezone.utc)
    
    attachments_json = json.dumps(attachments) if attachments else None
    
    db.execute(text("""
        INSERT INTO communications_messages (id, conversation_id, direction, type, content, status, attachments, created_at)
        VALUES (:id, :conv_id, 'inbound', :msg_type, :content, 'sent', CAST(:attachments AS jsonb), :now)
    """), {
        "id": msg_id, 
        "conv_id": conv_id, 
        "content": content, 
        "msg_type": msg_type,
        "attachments": attachments_json,
        "now": now
    })
    db.commit()
    
    logger.info(f"Saved message: {msg_id} from {sender_name or external_id}")
    return msg_id


async def download_media(client, message) -> dict:
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
        
        filename = f"{file_id}{ext}"
        file_path = UPLOADS_DIR / filename
        
        # Download the file
        await client.download_media(message, file=str(file_path))
        
        # Get file size
        file_size = file_path.stat().st_size if file_path.exists() else 0
        
        logger.info(f"📎 Downloaded media: {original_name} ({file_size} bytes)")
        
        return {
            "id": file_id,
            "type": file_type,
            "filename": original_name,
            "mime_type": mime_type,
            "size": file_size,
            "url": f"/api/v1/communications/files/{filename}",
        }
        
    except Exception as e:
        logger.error(f"Error downloading media: {e}")
        return None


async def notify_websocket(conv_id: str, msg_id: str, content: str, sender_name: str, external_id: str, attachments: list = None, msg_type: str = "text"):
    """Notify WebSocket clients about new message."""
    try:
        async with httpx.AsyncClient() as client:
            # Send to custom notification endpoint
            notification = {
                "type": "new_message",
                "conversation_id": conv_id,
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
            response = await client.post(
                "http://localhost:8000/api/v1/communications/broadcast-message",
                json=notification,
                timeout=5.0
            )
            logger.info(f"WebSocket notification sent: {response.status_code}")
    except Exception as e:
        logger.warning(f"Failed to send WebSocket notification: {e}")


async def run_listener_for_account(account: dict):
    """Run Telegram listener for a single account."""
    account_name = account["name"]
    session_string = account["session_string"]
    api_id = account["api_id"]
    api_hash = account["api_hash"]
    
    if not api_id or not api_hash:
        logger.error(f"Account {account_name}: missing api_id or api_hash")
        return
    
    logger.info(f"Starting listener for account: {account_name}")
    
    client = TelegramClient(
        StringSession(session_string),
        api_id,
        api_hash
    )
    
    @client.on(events.NewMessage(incoming=True))
    async def handler(event):
        """Handle incoming message."""
        try:
            # Get sender info
            sender = await event.get_sender()
            sender_name = None
            external_id = str(event.chat_id)
            
            if sender:
                first_name = getattr(sender, 'first_name', '') or ''
                last_name = getattr(sender, 'last_name', '') or ''
                sender_name = f"{first_name} {last_name}".strip()
                
                # Use phone or username as external_id if available
                phone = getattr(sender, 'phone', None)
                username = getattr(sender, 'username', None)
                if phone:
                    external_id = f"+{phone}"
                elif username:
                    external_id = f"@{username}"
            
            content = event.message.text or ""
            attachments = []
            msg_type = "text"
            
            # Check for media
            if event.message.media:
                attachment = await download_media(client, event.message)
                if attachment:
                    attachments.append(attachment)
                    msg_type = attachment["type"]
                    if not content:
                        content = f"[{attachment['type'].capitalize()}: {attachment['filename']}]"
            
            if not content and not attachments:
                content = "[Пусте повідомлення]"
            
            logger.info(f"📩 New message from {sender_name or external_id}: {content[:50]}...")
            
            # Save to database
            db = Session()
            try:
                conv_id = get_or_create_conversation(db, external_id, sender_name)
                msg_id = save_message(
                    db, conv_id, content, sender_name, external_id, 
                    attachments=attachments if attachments else None,
                    msg_type=msg_type
                )
                
                # Notify WebSocket
                await notify_websocket(
                    conv_id, msg_id, content, sender_name, external_id,
                    attachments=attachments if attachments else None,
                    msg_type=msg_type
                )
                
            finally:
                db.close()
                
        except Exception as e:
            logger.error(f"Error handling message: {e}")
    
    await client.start()
    logger.info(f"✅ Listener started for account: {account_name}")
    
    # Keep running
    await client.run_until_disconnected()


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

