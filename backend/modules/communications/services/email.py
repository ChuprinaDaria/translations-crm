"""
EmailService - обробка Email повідомлень через IMAP/SMTP.
"""
import imaplib
import smtplib
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session

from modules.communications.models import (
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus,
    Conversation,
)
from modules.communications.services.base import MessengerService
from modules.communications.models import Conversation
from core.database import SessionLocal
import sys
import os
# Add parent directory to path for crud and models import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))
import crud
import models


class EmailService(MessengerService):
    """Сервіс для роботи з Email через IMAP/SMTP."""
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація Email сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (smtp_host, smtp_port, smtp_user, smtp_password, imap_host, imap_port)
        """
        if config is None:
            config = self._load_config()
        super().__init__(db, config)
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.EMAIL
    
    def _load_config(self) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        db = SessionLocal()
        try:
            settings = crud.get_smtp_settings(db)
        finally:
            db.close()
        
        import os
        return {
            "smtp_host": settings.get("smtp_host") or os.getenv("SMTP_HOST", "smtp.gmail.com"),
            "smtp_port": int(settings.get("smtp_port") or os.getenv("SMTP_PORT", "587")),
            "smtp_user": settings.get("smtp_user") or os.getenv("SMTP_USER", ""),
            "smtp_password": settings.get("smtp_password") or os.getenv("SMTP_PASSWORD", ""),
            "smtp_from_email": settings.get("smtp_from_email") or os.getenv("SMTP_FROM_EMAIL", ""),
            "smtp_from_name": settings.get("smtp_from_name") or os.getenv("SMTP_FROM_NAME", "CRM System"),
            "imap_host": os.getenv("IMAP_HOST", "imap.gmail.com"),
            "imap_port": int(os.getenv("IMAP_PORT", "993")),
        }
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "MessageModel":
        """Відправити email."""
        from modules.communications.models import Message as MessageModel
        
        # Отримати розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Перевірити, чи є менеджерський SMTP акаунт для цієї розмови
        manager_smtp_account = None
        if conversation.manager_smtp_account_id:
            manager_smtp_account = self.db.query(models.ManagerSmtpAccount).filter(
                models.ManagerSmtpAccount.id == conversation.manager_smtp_account_id,
                models.ManagerSmtpAccount.is_active == True
            ).first()
        
        # Визначити SMTP налаштування
        if manager_smtp_account:
            # Використовуємо менеджерський SMTP
            smtp_host = manager_smtp_account.smtp_host
            smtp_port = manager_smtp_account.smtp_port
            smtp_user = manager_smtp_account.smtp_user
            smtp_password = manager_smtp_account.smtp_password
            from_email = manager_smtp_account.email
            from_name = manager_smtp_account.name
        else:
            # Використовуємо стандартні KP SMTP налаштування
            smtp_host = self.config["smtp_host"]
            smtp_port = self.config["smtp_port"]
            smtp_user = self.config["smtp_user"]
            smtp_password = self.config["smtp_password"]
            from_email = self.config["smtp_from_email"]
            from_name = self.config["smtp_from_name"]
        
        # Створити повідомлення в БД
        subject = conversation.subject or "No Subject"
        message = self.create_message_in_db(
            conversation_id=conversation_id,
            direction=MessageDirection.OUTBOUND,
            message_type=MessageType.HTML,
            content=content,
            status=MessageStatus.QUEUED,
            attachments=attachments,
            metadata=metadata,
        )
        
        try:
            # Створити email повідомлення
            msg = MIMEMultipart()
            msg['From'] = f"{from_name} <{from_email}>"
            msg['To'] = conversation.external_id  # Email адреса
            msg['Subject'] = subject
            
            msg.attach(MIMEText(content, 'html', 'utf-8'))
            
            # Додати вкладення
            if attachments:
                for att in attachments:
                    attachment = MIMEBase('application', 'octet-stream')
                    # Тут потрібно завантажити файл
                    # attachment.set_payload(att["content"])
                    # encoders.encode_base64(attachment)
                    # attachment.add_header('Content-Disposition', f'attachment; filename= "{att["filename"]}"')
                    # msg.attach(attachment)
                    pass
            
            # Відправити через SMTP
            if smtp_port == 465:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            else:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.starttls()
            
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
            server.quit()
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.utcnow()
            self.db.commit()
            
        except Exception as e:
            message.status = MessageStatus.FAILED
            self.db.commit()
            raise
        
        return message
    
    async def receive_message(
        self,
        external_id: str,
        content: str,
        sender_info: Dict[str, Any],
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        is_from_me: Optional[bool] = None,
        to_email: Optional[str] = None,
        html_content: Optional[str] = None,
    ) -> "MessageModel":
        """Обробити вхідне email повідомлення."""
        from modules.communications.models import Message as MessageModel
        
        # Перевірити, чи email надійшов на менеджерський SMTP акаунт
        manager_smtp_account_id = None
        if to_email:
            # Знайти менеджерський SMTP акаунт за email адресою
            manager_account = self.db.query(models.ManagerSmtpAccount).filter(
                models.ManagerSmtpAccount.email == to_email,
                models.ManagerSmtpAccount.is_active == True
            ).first()
            if manager_account:
                manager_smtp_account_id = manager_account.id
        
        # Отримати або створити розмову
        subject = sender_info.get("subject", "No Subject")
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,
            subject=subject,
            manager_smtp_account_id=manager_smtp_account_id,
        )
        
        # Додати HTML в meta_data якщо є
        if metadata is None:
            metadata = {}
        if html_content:
            metadata['html_content'] = html_content
        
        # Створити повідомлення
        message = self.create_message_in_db(
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            message_type=MessageType.HTML if html_content else MessageType.TEXT,
            content=content,
            status=MessageStatus.SENT,
            attachments=attachments,
            metadata=metadata,
        )
        
        return message
    
    async def get_or_create_conversation(
        self,
        external_id: str,
        client_id: Optional[UUID] = None,
        subject: Optional[str] = None,
        manager_smtp_account_id: Optional[int] = None,
    ) -> Conversation:
        """Отримати або створити розмову."""
        
        # Шукаємо існуючу розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.EMAIL,
            Conversation.external_id == external_id,
            Conversation.subject == subject,
        ).first()
        
        if conversation:
            # Оновити manager_smtp_account_id якщо він не встановлений
            if not conversation.manager_smtp_account_id and manager_smtp_account_id:
                conversation.manager_smtp_account_id = manager_smtp_account_id
                self.db.commit()
                self.db.refresh(conversation)
            return conversation
        
        # Створюємо нову розмову
        conversation = Conversation(
            platform=PlatformEnum.EMAIL,
            external_id=external_id,
            client_id=client_id,
            subject=subject,
            manager_smtp_account_id=manager_smtp_account_id,
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation
    
    async def fetch_new_emails(self) -> List["MessageModel"]:
        """
        Завантажити нові email з IMAP сервера.
        
        Returns:
            Список нових повідомлень
        """
        from modules.communications.models import Message as MessageModel
        
        messages = []
        
        try:
            # Підключитися до IMAP
            imap_host = self.config["imap_host"]
            imap_port = self.config["imap_port"]
            smtp_user = self.config["smtp_user"]
            smtp_password = self.config["smtp_password"]
            
            mail = imaplib.IMAP4_SSL(imap_host, imap_port)
            mail.login(smtp_user, smtp_password)
            mail.select('inbox')
            
            # Пошук непрочитаних листів
            status, messages_data = mail.search(None, 'UNSEEN')
            
            if status == 'OK':
                email_ids = messages_data[0].split()
                
                for email_id in email_ids:
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
                        subject_raw = email_message['Subject'] or ""
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
                        attachments = []
                        if email_message.is_multipart():
                            for part in email_message.walk():
                                content_type = part.get_content_type()
                                if content_type == "text/html":
                                    html_content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                    if not content:  # Якщо немає plain text, конвертувати HTML в текст
                                        # Простий парсер HTML для витягування тексту
                                        import re
                                        # Видалити скрипти та стилі
                                        html_clean = re.sub(r'<script[^>]*>.*?</script>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
                                        html_clean = re.sub(r'<style[^>]*>.*?</style>', '', html_clean, flags=re.DOTALL | re.IGNORECASE)
                                        # Замінити <br>, <p>, <div> на нові рядки
                                        html_clean = re.sub(r'<br\s*/?>', '\n', html_clean, flags=re.IGNORECASE)
                                        html_clean = re.sub(r'</(p|div|tr|li)>', '\n', html_clean, flags=re.IGNORECASE)
                                        # Видалити всі HTML теги
                                        html_clean = re.sub(r'<[^>]+>', '', html_clean)
                                        # Декодувати HTML entities
                                        import html
                                        content = html.unescape(html_clean).strip()
                                elif content_type == "text/plain" and not content:
                                    content = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                                elif part.get_content_disposition() == 'attachment':
                                    # Обробити вкладення
                                    filename = part.get_filename()
                                    if filename:
                                        # Декодувати ім'я файлу
                                        filename_parts = decode_header(filename)
                                        decoded_filename = "".join([
                                            part[0].decode(part[1] or 'utf-8', errors='ignore') if isinstance(part[0], bytes) else part[0]
                                            for part in filename_parts
                                        ])
                                        file_data = part.get_payload(decode=True)
                                        attachments.append({
                                            "filename": decoded_filename,
                                            "content_type": content_type,
                                            "data": file_data,
                                        })
                        else:
                            payload = email_message.get_payload(decode=True)
                            if payload:
                                content = payload.decode('utf-8', errors='ignore')
                                if email_message.get_content_type() == "text/html":
                                    html_content = content
                        
                        if not content:
                            content = "(No content)"
                        
                        # Обробити повідомлення
                        sender_info = {
                            "email": sender_email,
                            "name": sender_name,
                            "subject": subject,
                        }
                        
                        # Витягнути email адресу з поля "To"
                        to_email = to
                        if '<' in to:
                            to_email = to.split('<')[1].split('>')[0].strip()
                        else:
                            to_email = to.strip()
                        
                        message = await self.receive_message(
                            external_id=sender_email,
                            content=content,
                            sender_info=sender_info,
                            to_email=to_email,
                            html_content=html_content if html_content else None,
                            attachments=attachments if attachments else None,
                        )
                        messages.append(message)
            
            mail.close()
            mail.logout()
            
        except Exception as e:
            print(f"Error fetching emails: {e}")
        
        return messages

