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
from uuid import UUID, uuid4
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
        
        # Позначити, що повідомлення відправлено через CRM API
        if metadata is None:
            metadata = {}
        metadata["sent_from_crm"] = True
        
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
                import logging
                logger = logging.getLogger(__name__)
                from pathlib import Path
                from modules.communications.models import Attachment
                from email import encoders
                from modules.communications.utils.media import get_media_dir
                
                MEDIA_DIR = get_media_dir()
                
                if not MEDIA_DIR or not MEDIA_DIR.exists():
                    logger.error(f"❌ MEDIA_DIR is not configured or doesn't exist: {MEDIA_DIR}")
                    raise ValueError(f"Media directory not configured: {MEDIA_DIR}")
                
                logger.info(f"📎 Processing {len(attachments)} attachment(s) for email. MEDIA_DIR: {MEDIA_DIR}")
                
                for att in attachments:
                    att_id = att.get("id")
                    url = att.get("url", "")
                    filename = att.get("filename", "attachment")
                    mime_type = att.get("mime_type", "application/octet-stream")
                    
                    logger.info(f"📎 Processing attachment: id={att_id}, url={url}, filename={filename}")
                    
                    file_path = None
                    file_data = None
                    attachment_obj = None
                    
                    # Спробувати знайти файл за ID
                    if att_id:
                        try:
                            # Обробити як рядок, так і UUID
                            if isinstance(att_id, str):
                                att_uuid = UUID(att_id)
                            else:
                                att_uuid = att_id
                            
                            attachment_obj = self.db.query(Attachment).filter(
                                Attachment.id == att_uuid
                            ).first()
                            
                            if attachment_obj and attachment_obj.file_path:
                                logger.info(f"✅ Found attachment in DB: {attachment_obj.id}, file_path: {attachment_obj.file_path}")
                                filename = attachment_obj.original_name
                                mime_type = attachment_obj.mime_type
                                
                                # Склеюємо базовий шлях з тим, що зберігається в БД
                                # В БД зберігається як "attachments/filename.pdf"
                                file_path = MEDIA_DIR / attachment_obj.file_path
                                
                                logger.info(f"📁 Constructed file path: {file_path} (from DB path: {attachment_obj.file_path})")
                            else:
                                logger.warning(f"⚠️ Attachment not found in DB or file_path is empty for ID: {att_id}")
                        except Exception as e:
                            logger.warning(f"⚠️ Failed to load attachment by ID {att_id}: {e}", exc_info=True)
                    
                    # Якщо не знайдено за ID, спробувати за URL
                    if not file_path and url:
                        url_clean = url.split("?")[0]
                        logger.info(f"🔍 Trying to find file by URL: {url_clean}")
                        
                        if "/media/" in url_clean:
                            # Використовуємо повний шлях з URL (attachments/filename)
                            file_path_str = url_clean.split("/media/")[-1]
                            file_path = MEDIA_DIR / file_path_str
                            logger.info(f"📁 Constructed file path from /media/ URL: {file_path} (path: {file_path_str})")
                        elif "/files/" in url_clean:
                            # Файл може бути в UPLOADS_DIR (тимчасовий) або в MEDIA_DIR (збережений)
                            filename_from_url = url_clean.split("/files/")[-1]
                            
                            # Видалити розширення файлу, якщо воно є (наприклад, .jpg, .pdf)
                            # Спробувати витягти UUID з filename (може бути з розширенням)
                            file_id_str = filename_from_url
                            if '.' in filename_from_url:
                                # Спробувати знайти UUID перед розширенням
                                parts = filename_from_url.rsplit('.', 1)
                                if len(parts) == 2:
                                    potential_uuid = parts[0]
                                    try:
                                        # Перевірити, чи це валідний UUID
                                        UUID(potential_uuid)
                                        file_id_str = potential_uuid
                                    except (ValueError, AttributeError):
                                        pass  # Не UUID, залишаємо як є
                            
                            # Спочатку спробувати знайти в БД за ID (навіть якщо є розширення)
                            try:
                                file_uuid = UUID(file_id_str)
                                attachment_obj = self.db.query(Attachment).filter(
                                    Attachment.id == file_uuid
                                ).first()
                                if attachment_obj and attachment_obj.file_path:
                                    filename = attachment_obj.original_name
                                    mime_type = attachment_obj.mime_type
                                    # Склеюємо базовий шлях з тим, що зберігається в БД
                                    file_path = MEDIA_DIR / attachment_obj.file_path
                                    logger.info(f"✅ Found attachment via /files/ URL in DB: {file_path} (from DB path: {attachment_obj.file_path})")
                            except (ValueError, AttributeError) as e:
                                logger.warning(f"⚠️ Failed to parse file_id from URL or find in DB: {e}")
                            
                            # Якщо не знайдено в БД, спробувати знайти в файловій системі
                            if not file_path:
                                # Спочатку спробувати знайти в UPLOADS_DIR (тимчасові файли)
                                from core.config import settings
                                uploads_file_path = settings.UPLOADS_DIR / filename_from_url
                                if uploads_file_path.exists():
                                    file_path = uploads_file_path
                                    logger.info(f"📁 Found file in UPLOADS_DIR: {file_path}")
                                else:
                                    # Спробувати знайти в MEDIA_DIR
                                    media_file_path = MEDIA_DIR / filename_from_url
                                    if media_file_path.exists():
                                        file_path = media_file_path
                                        logger.info(f"📁 Found file in MEDIA_DIR: {file_path}")
                    
                    # Завантажити файл
                    if file_path:
                        if file_path.exists():
                            try:
                                file_size = file_path.stat().st_size
                                size_mb = file_size / (1024 * 1024)
                                logger.info(f"✅ File found: {file_path} ({size_mb:.2f} MB)")
                                
                                # Most email servers have a 25-50MB limit
                                if size_mb > 25:
                                    logger.warning(f"⚠️ File is large for email: {size_mb:.2f} MB (max recommended 25 MB)")
                                
                                with open(file_path, "rb") as f:
                                    file_data = f.read()
                                logger.info(f"✅ Loaded file: {file_path} ({len(file_data)} bytes)")
                            except Exception as e:
                                logger.error(f"❌ Failed to read file {file_path}: {e}", exc_info=True)
                        else:
                            logger.error(f"❌ File not found: {file_path}")
                            # Спробувати знайти файл за ім'ям в MEDIA_DIR
                            if attachment_obj:
                                # Спробувати різні варіанти шляху
                                possible_paths = [
                                    MEDIA_DIR / attachment_obj.file_path,  # Правильний шлях: /app/media/attachments/filename
                                    MEDIA_DIR / Path(attachment_obj.file_path).name,  # Fallback: тільки ім'я файлу
                                    Path(attachment_obj.file_path) if Path(attachment_obj.file_path).is_absolute() else None,
                                ]
                                for possible_path in possible_paths:
                                    if possible_path and possible_path.exists():
                                        logger.info(f"✅ Found file at alternative path: {possible_path}")
                                        try:
                                            with open(possible_path, "rb") as f:
                                                file_data = f.read()
                                            file_path = possible_path
                                            break
                                        except Exception as e:
                                            logger.warning(f"⚠️ Failed to read alternative path {possible_path}: {e}")
                    
                    if file_data:
                        # Визначити MIME тип
                        maintype, subtype = mime_type.split('/', 1) if '/' in mime_type else ('application', 'octet-stream')
                        
                        attachment = MIMEBase(maintype, subtype)
                        attachment.set_payload(file_data)
                        encoders.encode_base64(attachment)
                        attachment.add_header(
                            'Content-Disposition',
                            f'attachment; filename="{filename}"'
                        )
                        msg.attach(attachment)
                        
                        logger.info(f"✅ Added email attachment: {filename} ({len(file_data)} bytes, {mime_type})")
                    else:
                        logger.error(f"❌ Could not load attachment data. att={att}, file_path={file_path}, exists={file_path.exists() if file_path else False}")
            
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
        """Отримати або створити розмову.
        
        Групує email conversations за парою sender/recipient (external_id + manager_smtp_account_id),
        а не за subject, щоб весь діалог між менеджером та клієнтом був в одному чаті.
        """
        from datetime import datetime, timezone
        
        # Шукаємо існуючу розмову за external_id та manager_smtp_account_id, БЕЗ subject
        # Це дозволяє тримати весь діалог в одному чаті навіть якщо subject змінюється
        query = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.EMAIL,
            Conversation.external_id == external_id,
        )
        
        if manager_smtp_account_id:
            query = query.filter(Conversation.manager_smtp_account_id == manager_smtp_account_id)
        else:
            query = query.filter(Conversation.manager_smtp_account_id.is_(None))
        
        conversation = query.order_by(Conversation.created_at.asc()).first()
        
        if conversation:
            # Оновити subject якщо він змінився (наприклад, Re: або Fwd:)
            if subject and conversation.subject != subject:
                conversation.subject = subject
                conversation.updated_at = datetime.now(timezone.utc)
            # Оновити manager_smtp_account_id якщо він не встановлений
            if not conversation.manager_smtp_account_id and manager_smtp_account_id:
                conversation.manager_smtp_account_id = manager_smtp_account_id
            # Оновити client_id якщо він не встановлений
            if not conversation.client_id and client_id:
                conversation.client_id = client_id
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
            
            # Перевіряємо листи за останні X хвилин замість UNSEEN
            # (оскільки інші клієнти можуть позначати листи як прочитані)
            from datetime import timedelta, timezone
            import os
            CHECK_MINUTES = int(os.getenv("EMAIL_CHECK_MINUTES", "10"))  # Перевіряти листи за останні 10 хвилин
            
            # Формуємо дату для пошуку (останні X хвилин)
            since_date = (datetime.now(timezone.utc) - timedelta(minutes=CHECK_MINUTES)).strftime("%d-%b-%Y")
            search_criteria = f'(SINCE {since_date})'
            
            status, messages_data = mail.search(None, search_criteria)
            
            if status == 'OK':
                email_ids = messages_data[0].split()
                
                for email_id in email_ids:
                    status, msg_data = mail.fetch(email_id, '(RFC822)')
                    
                    if status == 'OK':
                        email_body = msg_data[0][1]
                        email_message = email.message_from_bytes(email_body)
                        
                        # Парсити email з MIME декодуванням
                        from email.header import decode_header
                        import logging
                        logger = logging.getLogger(__name__)
                        
                        def decode_mime_header(header_value: str) -> str:
                            """Декодувати MIME header з підтримкою base64 та quoted-printable."""
                            if not header_value:
                                return ""
                            
                            # Якщо header вже декодований (немає =?UTF-8?B? або =?UTF-8?Q?)
                            if "=?" not in header_value:
                                return header_value
                            
                            try:
                                decoded_parts = decode_header(header_value)
                                result = ""
                                for part, encoding in decoded_parts:
                                    if isinstance(part, bytes):
                                        # Якщо encoding вказано, використовуємо його
                                        if encoding:
                                            result += part.decode(encoding, errors='ignore')
                                        else:
                                            # Спробуємо декодувати як UTF-8
                                            result += part.decode('utf-8', errors='ignore')
                                    else:
                                        result += str(part)
                                return result
                            except Exception as e:
                                logger.warning(f"Failed to decode MIME header '{header_value[:50]}...': {e}")
                                return header_value
                        
                        # Декодувати From
                        sender_raw = email_message['From'] or ""
                        sender_decoded = decode_mime_header(sender_raw)
                        
                        # Декодувати Subject
                        subject_raw = email_message['Subject'] or ""
                        subject = decode_mime_header(subject_raw)
                        
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

