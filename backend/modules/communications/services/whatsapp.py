"""
WhatsAppService - обробка WhatsApp повідомлень через Meta Business API.
"""
import hmac
import hashlib
import httpx
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from modules.communications.models import (
    PlatformEnum,
    MessageDirection,
    MessageType,
    MessageStatus,
    Conversation,
)
from modules.communications.services.base import MessengerService


class WhatsAppService(MessengerService):
    """Сервіс для роботи з WhatsApp через Meta Business API."""
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація WhatsApp сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (access_token, phone_number_id, app_secret, verify_token)
        """
        if config is None:
            config = self._load_config()
        super().__init__(db, config)
        self.base_url = "https://graph.facebook.com/v22.0"  # Оновлено до v22.0
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.WHATSAPP
    
    def _load_config(self) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        import os
        import crud
        from db import SessionLocal
        
        # Спробувати завантажити з бази даних
        db = SessionLocal()
        try:
            settings = crud.get_whatsapp_settings(db)
            if settings.get("whatsapp_access_token"):
                return {
                    "access_token": settings.get("whatsapp_access_token") or "",
                    "phone_number_id": settings.get("whatsapp_phone_number_id") or "",
                    "app_secret": settings.get("whatsapp_app_secret") or "",
                    "verify_token": settings.get("whatsapp_verify_token") or "",
                    "whatsapp_template_name": settings.get("whatsapp_template_name") or "",
                    "whatsapp_template_language": settings.get("whatsapp_template_language") or "en_US",
                }
        finally:
            db.close()
        
        # Fallback до env
        return {
            "access_token": os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
            "phone_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
            "app_secret": os.getenv("WHATSAPP_APP_SECRET", ""),
            "verify_token": os.getenv("WHATSAPP_VERIFY_TOKEN", ""),
            "whatsapp_template_name": os.getenv("WHATSAPP_TEMPLATE_NAME", ""),
            "whatsapp_template_language": os.getenv("WHATSAPP_TEMPLATE_LANGUAGE", "en_US"),
        }
    
    def verify_webhook(self, signature: str, payload: bytes) -> bool:
        """
        Перевірити підпис webhook від Meta.
        
        Args:
            signature: Підпис з заголовка X-Hub-Signature-256
            payload: Тіло запиту
            
        Returns:
            True якщо підпис валідний
        """
        app_secret = self.config.get("app_secret")
        if not app_secret:
            return False
        
        # Meta використовує формат: sha256=<hash>
        expected_signature = hmac.new(
            app_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        # Видаляємо префікс "sha256=" зі вхідного підпису
        received_signature = signature.replace("sha256=", "")
        
        return hmac.compare_digest(expected_signature, received_signature)
    
    def _is_within_24h_window(self, conversation: Conversation) -> bool:
        """
        Перевірити, чи розмова в межах 24-годинного вікна для звичайних повідомлень.
        
        WhatsApp дозволяє відправляти звичайні текстові повідомлення тільки в межах
        24 годин після останнього повідомлення від клієнта. Поза цим вікном потрібно
        використовувати шаблони (templates).
        """
        from datetime import timedelta
        
        # Знайти останнє вхідне повідомлення від клієнта
        from modules.communications.models import Message
        last_inbound = self.db.query(Message).filter(
            Message.conversation_id == conversation.id,
            Message.direction == MessageDirection.INBOUND
        ).order_by(Message.created_at.desc()).first()
        
        if not last_inbound:
            # Якщо немає вхідних повідомлень, це перше повідомлення - потрібен шаблон
            return False
        
        # Перевірити, чи пройшло менше 24 годин
        # Виправлення: використовуємо timezone-aware datetime для обох значень
        now = datetime.now(timezone.utc)
        # Якщо last_inbound.created_at не має timezone, додаємо UTC
        if last_inbound.created_at.tzinfo is None:
            last_message_time = last_inbound.created_at.replace(tzinfo=timezone.utc)
        else:
            last_message_time = last_inbound.created_at
        time_diff = now - last_message_time
        return time_diff < timedelta(hours=24)
    
    def _get_template_config(self) -> Optional[Dict[str, Any]]:
        """Отримати налаштування шаблону з конфігурації."""
        template_name = self.config.get("whatsapp_template_name")
        template_language = self.config.get("whatsapp_template_language", "en_US")
        
        if template_name:
            return {
                "name": template_name,
                "language": {"code": template_language},
                "components": []
            }
        return None
    
    def _clean_phone_number(self, phone: str) -> str:
        """
        Очистити номер телефону від символів +, -, пробілів та інших нецифрових символів.
        
        Meta API вимагає номер у форматі тільки цифр (наприклад: 1234567890).
        
        Args:
            phone: Номер телефону (може містити +, -, пробіли)
            
        Returns:
            Очищений номер телефону (тільки цифри)
        """
        # Видаляємо всі нецифрові символи
        cleaned = ''.join(filter(str.isdigit, phone))
        return cleaned
    
    def _build_message_payload(self, conversation: Conversation, content: str, use_template: bool, is_human_agent: bool = False) -> Dict[str, Any]:
        """
        Побудувати payload для відправки повідомлення.
        
        Args:
            conversation: Розмова
            content: Текст повідомлення
            use_template: Чи використовувати шаблон
            is_human_agent: Чи повідомлення відправляє людина (оператор)
            
        Returns:
            Dict з payload для Meta API
        """
        import logging
        logger = logging.getLogger(__name__)
        
        # Очищаємо номер телефону від +, -, пробілів
        cleaned_phone = self._clean_phone_number(conversation.external_id)
        
        # Базовий payload
        base_payload = {
            "messaging_product": "whatsapp",
            "to": cleaned_phone,
        }
        
        if use_template:
            # Використовуємо шаблон (для повідомлень поза 24-годинним вікном)
            template_config = self._get_template_config()
            
            if not template_config:
                # Якщо шаблон не налаштовано, спробуємо відправити як текст з tag
                logger.warning(f"No WhatsApp template configured, but message is outside 24h window. Attempting to send as text with tag.")
                base_payload.update({
                    "type": "text",
                    "text": {"body": content},
                })
                if is_human_agent:
                    base_payload["messaging_type"] = "MESSAGE_TAG"
                    base_payload["tag"] = "HUMAN_AGENT"
                return base_payload
            else:
                # Використовуємо шаблон
                # Для шаблонів текст повідомлення передається в components
                base_payload.update({
                    "type": "template",
                    "template": {
                        **template_config,
                        "components": [
                            {
                                "type": "body",
                                "parameters": [
                                    {
                                        "type": "text",
                                        "text": content
                                    }
                                ]
                            }
                        ] if content else []
                    }
                })
                # Поза 24h вікном - завжди додаємо tag якщо людина
                if is_human_agent:
                    base_payload["messaging_type"] = "MESSAGE_TAG"
                    base_payload["tag"] = "HUMAN_AGENT"
                return base_payload
        else:
            # Звичайне текстове повідомлення (в межах 24-годинного вікна)
            # Формат відповідає Meta API документації: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages
            base_payload.update({
                "type": "text",
                "text": {"body": content},
            })
            return base_payload
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        force_template: bool = False,
    ) -> "MessageModel":
        """
        Відправити повідомлення в WhatsApp.
        
        Args:
            conversation_id: ID розмови
            content: Текст повідомлення
            attachments: Вкладення (опціонально)
            metadata: Метадані (опціонально)
            force_template: Примусово використати шаблон (опціонально)
        """
        from modules.communications.models import Message as MessageModel
        
        # Отримати розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
        # Позначити, що повідомлення відправлено через CRM API
        if metadata is None:
            metadata = {}
        metadata["sent_from_crm"] = True
        
        # Створити повідомлення в БД
        message = self.create_message_in_db(
            conversation_id=conversation_id,
            direction=MessageDirection.OUTBOUND,
            message_type=MessageType.TEXT,
            content=content,
            status=MessageStatus.QUEUED,
            attachments=attachments,
            metadata=metadata,
        )
        
        try:
            # Відправити через Meta API
            phone_number_id = self.config.get("phone_number_id")
            access_token = self.config.get("access_token")
            
            if not phone_number_id or not access_token:
                raise ValueError("WhatsApp credentials not configured")
            
            # Валідація phone_number_id: має бути тільки цифри
            if not phone_number_id.isdigit():
                import logging
                logging.getLogger(__name__).error(f"Invalid phone_number_id format (not numeric): '{phone_number_id}'. Phone Number ID must contain only digits.")
                raise ValueError(f"Invalid phone_number_id format: must contain only digits, got '{phone_number_id}'")
            
            url = f"{self.base_url}/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",  # Правильний формат для Meta API
                "Content-Type": "application/json",
            }
            
            # Очищаємо номер телефону отримувача від +, -, пробілів
            cleaned_recipient_phone = self._clean_phone_number(conversation.external_id)
            
            # Очищаємо номер телефону отримувача від +, -, пробілів
            cleaned_recipient_phone = self._clean_phone_number(conversation.external_id)
            
            # Перевірити, чи повідомлення відправляє людина (оператор)
            # Якщо assigned_manager_id встановлено, це означає що людина веде діалог
            is_human_agent = conversation.assigned_manager_id is not None
            
            # Обробити вкладення
            if attachments and len(attachments) > 0:
                # WhatsApp підтримує тільки один файл за раз
                att = attachments[0]
                att_id = att.get("id")
                url = att.get("url", "")
                filename = att.get("filename", "file")
                mime_type = att.get("mime_type", "application/octet-stream")
                att_type = att.get("type", "document")
                
                # Завантажити файл
                from pathlib import Path
                from modules.communications.models import Attachment
                from modules.communications.utils.media import get_media_dir
                
                MEDIA_DIR = get_media_dir()
                file_path = None
                file_data = None
                
                # Спробувати знайти файл за ID
                if att_id:
                    try:
                        attachment_obj = self.db.query(Attachment).filter(
                            Attachment.id == UUID(att_id)
                        ).first()
                        if attachment_obj:
                            filename = attachment_obj.original_name
                            mime_type = attachment_obj.mime_type
                            att_type = attachment_obj.file_type
                            # Склеюємо базовий шлях з тим, що зберігається в БД
                            file_path = MEDIA_DIR / attachment_obj.file_path
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Failed to load attachment by ID {att_id}: {e}")
                
                # Якщо не знайдено за ID, спробувати за URL
                if not file_path and url:
                    url_clean = url.split("?")[0]
                    if "/media/" in url_clean:
                        # Використовуємо повний шлях з URL (attachments/filename)
                        file_path_str = url_clean.split("/media/")[-1]
                        file_path = MEDIA_DIR / file_path_str
                    elif "/files/" in url_clean:
                        file_id = url_clean.split("/files/")[-1]
                        try:
                            attachment_obj = self.db.query(Attachment).filter(
                                Attachment.id == UUID(file_id)
                            ).first()
                            if attachment_obj:
                                filename = attachment_obj.original_name
                                mime_type = attachment_obj.mime_type
                                att_type = attachment_obj.file_type
                                file_path = MEDIA_DIR / Path(attachment_obj.file_path).name
                        except:
                            pass
                
                # Завантажити файл
                if file_path and file_path.exists():
                    with open(file_path, "rb") as f:
                        file_data = f.read()
                
                if file_data:
                    # Завантажити файл на Meta сервер через WhatsApp Media API
                    # Meta API вимагає multipart/form-data з правильними полями
                    upload_url = f"{self.base_url}/{phone_number_id}/media"
                    
                    async with httpx.AsyncClient() as client:
                        # Створюємо multipart/form-data запит
                        files = {
                            "file": (filename, file_data, mime_type),
                            "messaging_product": (None, "whatsapp"),
                            "type": (None, att_type),
                        }
                        
                        # Завантажуємо файл
                        upload_response = await client.post(
                            upload_url,
                            headers={"Authorization": f"Bearer {access_token}"},
                            files=files,
                            timeout=60.0
                        )
                        upload_response.raise_for_status()
                        upload_result = upload_response.json()
                        media_id = upload_result.get("id")
                        
                        if media_id:
                            # Відправляємо повідомлення з медіа
                            # Використовуємо очищений номер телефону
                            if att_type == "image":
                                payload = {
                                    "messaging_product": "whatsapp",
                                    "to": cleaned_recipient_phone,
                                    "type": "image",
                                    "image": {
                                        "id": media_id,
                                    },
                                }
                                if content:
                                    payload["image"]["caption"] = content
                            elif att_type == "video":
                                payload = {
                                    "messaging_product": "whatsapp",
                                    "to": cleaned_recipient_phone,
                                    "type": "video",
                                    "video": {
                                        "id": media_id,
                                    },
                                }
                                if content:
                                    payload["video"]["caption"] = content
                            elif att_type == "audio":
                                payload = {
                                    "messaging_product": "whatsapp",
                                    "to": cleaned_recipient_phone,
                                    "type": "audio",
                                    "audio": {
                                        "id": media_id,
                                    },
                                }
                            else:
                                # Document
                                payload = {
                                    "messaging_product": "whatsapp",
                                    "to": cleaned_recipient_phone,
                                    "type": "document",
                                    "document": {
                                        "id": media_id,
                                        "filename": filename,
                                    },
                                }
                                if content:
                                    payload["document"]["caption"] = content
                            
                            # Додати tag якщо поза 24h вікном та людина відправляє
                            if not self._is_within_24h_window(conversation) and is_human_agent:
                                payload["messaging_type"] = "MESSAGE_TAG"
                                payload["tag"] = "HUMAN_AGENT"
                            
                            response = await client.post(url, json=payload, headers=headers)
                            response.raise_for_status()
                            result = response.json()
                        else:
                            raise ValueError("Failed to upload media to WhatsApp")
                else:
                    # Файл не знайдено, відправити тільки текст
                    # Перевірити, чи потрібно використовувати шаблон
                    use_template = force_template or not self._is_within_24h_window(conversation)
                    payload = self._build_message_payload(conversation, content, use_template, is_human_agent)
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.post(url, json=payload, headers=headers)
                        response.raise_for_status()
                        result = response.json()
            else:
                # Немає вкладень, відправити тільки текст
                # Перевірити, чи потрібно використовувати шаблон
                use_template = force_template or not self._is_within_24h_window(conversation)
                payload = self._build_message_payload(conversation, content, use_template, is_human_agent)
                
                import logging
                logger = logging.getLogger(__name__)
                message_type = "template" if use_template else "text"
                logger.info(f"Sending WhatsApp {message_type} message to {conversation.external_id} via phone_number_id {phone_number_id}")
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, json=payload, headers=headers)
                    response.raise_for_status()
                    result = response.json()
                    
                    logger.info(f"WhatsApp message sent successfully. Response: {result}")
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.now(timezone.utc)
            if metadata is None:
                metadata = {}
            metadata["whatsapp_message_id"] = result.get("messages", [{}])[0].get("id")
            message.meta_data = metadata
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
    ) -> "MessageModel":
        """Обробити вхідне повідомлення з WhatsApp."""
        from modules.communications.models import Message as MessageModel
        
        # Отримати або створити розмову
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,
        )
        
        # Створити повідомлення
        message = self.create_message_in_db(
            conversation_id=conversation.id,
            direction=MessageDirection.INBOUND,
            message_type=MessageType.TEXT,
            content=content,
            status=MessageStatus.SENT,
            attachments=attachments,
            metadata=metadata,
        )
        
        # Notify via WebSocket
        try:
            from modules.communications.router import notify_new_message
            await notify_new_message(message, conversation)
        except Exception as e:
            # Don't fail if WebSocket notification fails
            import logging
            logging.getLogger(__name__).warning(f"Failed to send WebSocket notification: {e}")
        
        return message
    
    async def get_or_create_conversation(self, external_id: str, client_id=None, subject=None):
        """Get or create conversation with race-condition protection."""
        from sqlalchemy.exc import IntegrityError

        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.WHATSAPP,
            Conversation.external_id == external_id,
        ).first()

        if conversation:
            return conversation

        try:
            conversation = Conversation(
                platform=PlatformEnum.WHATSAPP,
                external_id=external_id,
                client_id=client_id,
                subject=subject,
            )
            self.db.add(conversation)
            self.db.flush()
            self.db.commit()
            return conversation
        except IntegrityError:
            self.db.rollback()
            conversation = self.db.query(Conversation).filter(
                Conversation.platform == PlatformEnum.WHATSAPP,
                Conversation.external_id == external_id,
            ).first()
            return conversation

