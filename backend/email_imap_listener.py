#!/usr/bin/env python3
"""
Email IMAP Listener - перевіряє email з менеджерських SMTP акаунтів і імпортує їх в inbox.
Запускати окремо: python email_imap_listener.py
"""
import asyncio
import imaplib
import email
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import httpx

# Configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://translator:traslatorini2025@localhost:5434/crm_db")
WEBSOCKET_NOTIFY_URL = os.getenv("WEBSOCKET_NOTIFY_URL", "http://localhost:8000/api/v1/communications/test-notification")
CHECK_INTERVAL = int(os.getenv("EMAIL_CHECK_INTERVAL", "60"))  # Перевіряти кожні 60 секунд

# Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)


def get_manager_smtp_accounts():
    """Get all active manager SMTP accounts from database."""
    db = Session()
    try:
        result = db.execute(text("""
            SELECT id, name, email, smtp_host, smtp_port, smtp_user, smtp_password, imap_host, imap_port
            FROM manager_smtp_accounts
            WHERE is_active = true
        """))
        accounts = []
        for row in result:
            accounts.append({
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "smtp_host": row[3],
                "smtp_port": row[4],
                "smtp_user": row[5],
                "smtp_password": row[6],
                "imap_host": row[7] or row[3],  # Якщо IMAP host не вказано, використовуємо SMTP host
                "imap_port": row[8] or 993,
            })
        return accounts
    finally:
        db.close()


def get_or_create_conversation(db, external_id: str, subject: str = None, manager_smtp_account_id: int = None):
    """Get or create conversation for email."""
    # Check if conversation exists
    result = db.execute(text("""
        SELECT id FROM communications_conversations
        WHERE platform = 'email' AND external_id = :external_id
        AND (:subject IS NULL OR subject = :subject)
    """), {"external_id": external_id, "subject": subject})
    row = result.fetchone()
    
    if row:
        conv_id = str(row[0])
        # Оновити manager_smtp_account_id якщо він не встановлений
        if manager_smtp_account_id:
            db.execute(text("""
                UPDATE communications_conversations
                SET manager_smtp_account_id = :manager_smtp_account_id
                WHERE id = :id AND manager_smtp_account_id IS NULL
            """), {"id": conv_id, "manager_smtp_account_id": manager_smtp_account_id})
            db.commit()
        return conv_id
    
    # Create new conversation
    from uuid import uuid4
    conv_id = str(uuid4())
    now = datetime.now(timezone.utc)
    db.execute(text("""
        INSERT INTO communications_conversations 
        (id, platform, external_id, subject, manager_smtp_account_id, created_at, updated_at)
        VALUES (:id, 'email', :external_id, :subject, :manager_smtp_account_id, :now, :now)
    """), {
        "id": conv_id,
        "external_id": external_id,
        "subject": subject or None,
        "manager_smtp_account_id": manager_smtp_account_id,
        "now": now
    })
    db.commit()
    
    logger.info(f"Created new conversation: {conv_id} for {external_id} (subject: {subject})")
    return conv_id


def save_message(db, conv_id: str, content: str, sender_email: str, sender_name: str, subject: str):
    """Save incoming email message to database."""
    from uuid import uuid4
    msg_id = str(uuid4())
    now = datetime.now(timezone.utc)
    
    db.execute(text("""
        INSERT INTO communications_messages 
        (id, conversation_id, direction, type, content, status, created_at)
        VALUES (:id, :conversation_id, 'inbound', 'html', :content, 'sent', :now)
    """), {
        "id": msg_id,
        "conversation_id": conv_id,
        "content": content,
        "now": now
    })
    db.commit()
    
    logger.info(f"Saved message {msg_id} in conversation {conv_id}")
    return msg_id


async def notify_websocket(conv_id: str, msg_id: str, content: str, sender_name: str, external_id: str):
    """Notify WebSocket about new message."""
    try:
        async with httpx.AsyncClient() as client:
            await client.post(WEBSOCKET_NOTIFY_URL, json={
                "type": "new_message",
                "conversation_id": conv_id,
                "message": {
                    "id": msg_id,
                    "conversation_id": conv_id,
                    "direction": "inbound",
                    "type": "html",
                    "content": content,
                    "status": "sent",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "conversation": {
                    "id": conv_id,
                    "platform": "email",
                    "external_id": external_id,
                }
            }, timeout=5.0)
    except Exception as e:
        logger.warning(f"Failed to send WebSocket notification: {e}")


def fetch_emails_for_account(account: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Fetch new emails from IMAP server for a manager account."""
    messages = []
    
    try:
        # Підключитися до IMAP
        imap_host = account["imap_host"]
        imap_port = account["imap_port"]
        smtp_user = account["smtp_user"]
        smtp_password = account["smtp_password"]
        
        logger.info(f"Connecting to IMAP {imap_host}:{imap_port} for {account['email']}")
        
        mail = imaplib.IMAP4_SSL(imap_host, imap_port)
        mail.login(smtp_user, smtp_password)
        mail.select('inbox')
        
        # Пошук непрочитаних листів
        status, messages_data = mail.search(None, 'UNSEEN')
        
        if status == 'OK':
            email_ids = messages_data[0].split()
            logger.info(f"Found {len(email_ids)} unread emails for {account['email']}")
            
            for email_id in email_ids:
                try:
                    status, msg_data = mail.fetch(email_id, '(RFC822)')
                    
                    if status == 'OK':
                        email_body = msg_data[0][1]
                        email_message = email.message_from_bytes(email_body)
                        
                        # Парсити email
                        sender = email_message['From']
                        subject = email_message['Subject'] or "No Subject"
                        to = email_message['To']
                        
                        # Витягнути email адреси
                        sender_email = sender
                        if '<' in sender:
                            sender_email = sender.split('<')[1].split('>')[0].strip()
                            sender_name = sender.split('<')[0].strip()
                        else:
                            sender_name = sender
                        
                        # Отримати текст
                        content = ""
                        if email_message.is_multipart():
                            for part in email_message.walk():
                                if part.get_content_type() == "text/html":
                                    content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                    break
                                elif part.get_content_type() == "text/plain" and not content:
                                    content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        else:
                            content = email_message.get_payload(decode=True).decode('utf-8', errors='ignore')
                        
                        if not content:
                            content = "(No content)"
                        
                        messages.append({
                            "sender_email": sender_email,
                            "sender_name": sender_name,
                            "subject": subject,
                            "to": to,
                            "content": content,
                            "account_id": account["id"],
                            "account_email": account["email"],
                        })
                        
                        # Позначити як прочитане
                        mail.store(email_id, '+FLAGS', '\\Seen')
                        
                except Exception as e:
                    logger.error(f"Error processing email {email_id}: {e}")
                    continue
            
            mail.close()
            mail.logout()
            
    except Exception as e:
        logger.error(f"Error fetching emails for {account['email']}: {e}")
    
    return messages


async def process_account(account: Dict[str, Any]):
    """Process emails for a single manager account."""
    db = Session()
    try:
        # Отримати нові email
        emails = fetch_emails_for_account(account)
        
        for email_data in emails:
            try:
                # Отримати або створити розмову
                conv_id = get_or_create_conversation(
                    db,
                    external_id=email_data["sender_email"],
                    subject=email_data["subject"],
                    manager_smtp_account_id=account["id"],
                )
                
                # Зберегти повідомлення
                msg_id = save_message(
                    db,
                    conv_id=conv_id,
                    content=email_data["content"],
                    sender_email=email_data["sender_email"],
                    sender_name=email_data["sender_name"],
                    subject=email_data["subject"],
                )
                
                # Сповістити через WebSocket
                await notify_websocket(
                    conv_id=conv_id,
                    msg_id=msg_id,
                    content=email_data["content"][:100] + "..." if len(email_data["content"]) > 100 else email_data["content"],
                    sender_name=email_data["sender_name"],
                    external_id=email_data["sender_email"],
                )
                
                logger.info(f"Processed email from {email_data['sender_email']} to {account['email']}")
                
            except Exception as e:
                logger.error(f"Error processing email from {email_data.get('sender_email', 'unknown')}: {e}")
                db.rollback()
                continue
                
    finally:
        db.close()


async def main_loop():
    """Main loop to check emails periodically."""
    logger.info("Starting Email IMAP Listener...")
    
    while True:
        try:
            # Отримати всі активні менеджерські SMTP акаунти
            accounts = get_manager_smtp_accounts()
            logger.info(f"Checking {len(accounts)} manager SMTP accounts...")
            
            # Обробити кожен акаунт
            for account in accounts:
                await process_account(account)
            
            # Зачекати перед наступною перевіркою
            logger.info(f"Waiting {CHECK_INTERVAL} seconds before next check...")
            await asyncio.sleep(CHECK_INTERVAL)
            
        except KeyboardInterrupt:
            logger.info("Stopping Email IMAP Listener...")
            break
        except Exception as e:
            logger.error(f"Error in main loop: {e}")
            await asyncio.sleep(CHECK_INTERVAL)


if __name__ == "__main__":
    asyncio.run(main_loop())

