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
            # Примусово очищаємо пробіли з host та port
            smtp_host = (row[3] or "").strip() if row[3] else ""
            smtp_port = (str(row[4]) or "").strip() if row[4] else ""
            imap_host_raw = row[7] or row[3]  # Якщо IMAP host не вказано, використовуємо SMTP host
            imap_host = (imap_host_raw or "").strip() if imap_host_raw else ""
            imap_port_raw = row[8] or 993
            imap_port = int((str(imap_port_raw) or "993").strip()) if imap_port_raw else 993
            
            accounts.append({
                "id": row[0],
                "name": row[1],
                "email": row[2],
                "smtp_host": smtp_host,
                "smtp_port": smtp_port,
                "smtp_user": row[5],
                "smtp_password": row[6],
                "imap_host": imap_host,
                "imap_port": imap_port,
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


def save_message(db, conv_id: str, content: str, sender_email: str, sender_name: str, subject: str, html_content: str = None, attachments: list = None):
    """Save incoming email message to database."""
    from uuid import uuid4
    import json
    msg_id = str(uuid4())
    now = datetime.now(timezone.utc)
    
    # Визначити тип повідомлення
    message_type = 'html' if html_content else 'text'
    
    # Зберегти HTML в meta_data якщо є
    meta_data = {}
    if html_content:
        meta_data['html_content'] = html_content
    if attachments:
        # Зберігаємо інформацію про attachments в meta_data
        # Самі файли потрібно буде зберегти окремо в файлову систему
        meta_data['attachments'] = [
            {
                "filename": att.get("filename"),
                "content_type": att.get("content_type"),
                "size": len(att.get("data", b""))
            }
            for att in attachments
        ]
    
    db.execute(text("""
        INSERT INTO communications_messages 
        (id, conversation_id, direction, type, content, status, created_at, meta_data, attachments)
        VALUES (:id, :conversation_id, 'inbound', :type, :content, 'sent', :now, :meta_data, :attachments)
    """), {
        "id": msg_id,
        "conversation_id": conv_id,
        "type": message_type,
        "content": content,
        "meta_data": json.dumps(meta_data) if meta_data else None,
        "attachments": json.dumps(attachments) if attachments else None,
        "now": now
    })
    db.commit()
    
    logger.info(f"Saved message {msg_id} in conversation {conv_id} (type: {message_type}, has_html: {bool(html_content)}, has_attachments: {bool(attachments)})")
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
    import socket
    
    messages = []
    
    try:
        # Підключитися до IMAP
        # Примусово очищаємо пробіли (захист від помилок у БД)
        imap_host = (account["imap_host"] or "").strip()
        imap_port = account["imap_port"]
        smtp_user = account["smtp_user"]
        smtp_password = account["smtp_password"]
        
        # Валідація host та port
        if not imap_host:
            logger.error(f"Invalid IMAP host for account {account['email']}: host is empty")
            return messages
        
        if not isinstance(imap_port, int) or imap_port <= 0:
            logger.error(f"Invalid IMAP port for account {account['email']}: {imap_port}")
            return messages
        
        logger.info(f"Connecting to IMAP {imap_host}:{imap_port} for {account['email']}")
        
        # Обробка DNS помилок
        try:
            mail = imaplib.IMAP4_SSL(imap_host, imap_port)
        except socket.gaierror as e:
            logger.error(f"DNS/Host error for {account['email']} (host: {imap_host}): Invalid host format - {e}")
            return messages
        except OSError as e:
            logger.error(f"Connection error for {account['email']} (host: {imap_host}:{imap_port}): {e}")
            return messages
        logger.info(f"IMAP SSL connection established for {account['email']}")
        mail.login(smtp_user, smtp_password)
        logger.info(f"IMAP login successful for {account['email']}")
        mail.select('inbox')
        logger.info(f"IMAP inbox selected for {account['email']}")
        
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
                        
                        # Парсити email з MIME декодуванням
                        from email.header import decode_header
                        
                        # Декодувати From
                        sender_raw = email_message['From'] or ""
                        sender_decoded_parts = decode_header(sender_raw)
                        sender_decoded = "".join([
                            part[0].decode(part[1] or 'utf-8', errors='ignore') if isinstance(part[0], bytes) else part[0]
                            for part in sender_decoded_parts
                        ])
                        
                        # Декодувати Subject
                        subject_raw = email_message['Subject'] or "No Subject"
                        subject_decoded_parts = decode_header(subject_raw)
                        subject = "".join([
                            part[0].decode(part[1] or 'utf-8', errors='ignore') if isinstance(part[0], bytes) else part[0]
                            for part in subject_decoded_parts
                        ])
                        
                        to = email_message['To'] or ""
                        
                        # Витягнути email адреси з декодованого From
                        sender_email = sender_decoded
                        sender_name = ""
                        if '<' in sender_decoded:
                            sender_email = sender_decoded.split('<')[1].split('>')[0].strip()
                            sender_name = sender_decoded.split('<')[0].strip().strip('"\'')
                        else:
                            sender_name = sender_decoded
                        
                        # Отримати текст та HTML
                        content = ""
                        html_content = ""
                        if email_message.is_multipart():
                            for part in email_message.walk():
                                content_type = part.get_content_type()
                                if content_type == "text/html":
                                    html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                    if not content:  # Якщо немає plain text, конвертувати HTML в текст
                                        # Простий парсер HTML для витягування тексту
                                        import re
                                        import html
                                        # Видалити скрипти та стилі
                                        html_clean = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
                                        html_clean = re.sub(r'<style[^>]*>.*?</style>', '', html_clean, flags=re.DOTALL | re.IGNORECASE)
                                        # Замінити <br>, <p>, <div> на нові рядки
                                        html_clean = re.sub(r'<br\s*/?>', '\n', html_clean, flags=re.IGNORECASE)
                                        html_clean = re.sub(r'</(p|div|tr|li)>', '\n', html_clean, flags=re.IGNORECASE)
                                        # Видалити всі HTML теги
                                        html_clean = re.sub(r'<[^>]+>', '', html_clean)
                                        # Декодувати HTML entities
                                        content = html.unescape(html_clean).strip()
                                elif content_type == "text/plain" and not content:
                                    content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                        else:
                            payload = email_message.get_payload(decode=True)
                            if payload:
                                content = payload.decode('utf-8', errors='ignore')
                                if email_message.get_content_type() == "text/html":
                                    html_content = content
                                    # Конвертувати HTML в текст
                                    import re
                                    import html
                                    html_clean = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
                                    html_clean = re.sub(r'<style[^>]*>.*?</style>', '', html_clean, flags=re.DOTALL | re.IGNORECASE)
                                    html_clean = re.sub(r'<br\s*/?>', '\n', html_clean, flags=re.IGNORECASE)
                                    html_clean = re.sub(r'</(p|div|tr|li)>', '\n', html_clean, flags=re.IGNORECASE)
                                    html_clean = re.sub(r'<[^>]+>', '', html_clean)
                                    content = html.unescape(html_clean).strip()
                        
                        if not content:
                            content = "(No content)"
                        
                        messages.append({
                            "sender_email": sender_email,
                            "sender_name": sender_name,
                            "subject": subject,
                            "to": to,
                            "content": content,
                            "html_content": html_content if html_content else None,
                            "attachments": attachments if attachments else [],
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
            logger.info(f"IMAP connection closed for {account['email']}")
            
    except Exception as e:
        logger.error(f"Error fetching emails for {account['email']}: {e}", exc_info=True)
    
    return messages


async def process_account(account: Dict[str, Any]):
    """Process emails for a single manager account."""
    db = Session()
    try:
        logger.info(f"Processing account: {account.get('email', 'unknown')} (ID: {account.get('id')})")
        # Отримати нові email
        emails = fetch_emails_for_account(account)
        logger.info(f"Found {len(emails)} new emails for account {account.get('email')}")
        
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
                    html_content=email_data.get("html_content"),
                    attachments=email_data.get("attachments", []),
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

