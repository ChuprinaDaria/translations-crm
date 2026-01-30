"""
WhatsAppService - обробка WhatsApp повідомлень через Meta Business API.
"""
import hmac
import hashlib
import httpx
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
        self.base_url = "https://graph.facebook.com/v18.0"
    
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
                }
        finally:
            db.close()
        
        # Fallback до env
        return {
            "access_token": os.getenv("WHATSAPP_ACCESS_TOKEN", ""),
            "phone_number_id": os.getenv("WHATSAPP_PHONE_NUMBER_ID", ""),
            "app_secret": os.getenv("WHATSAPP_APP_SECRET", ""),
            "verify_token": os.getenv("WHATSAPP_VERIFY_TOKEN", ""),
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
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "MessageModel":
        """Відправити повідомлення в WhatsApp."""
        from modules.communications.models import Message as MessageModel
        
        # Отримати розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            raise ValueError(f"Conversation {conversation_id} not found")
        
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
            
            url = f"{self.base_url}/{phone_number_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            
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
                
                MEDIA_DIR = Path("/app/media")
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
                            file_path = MEDIA_DIR / Path(attachment_obj.file_path).name
                    except Exception as e:
                        import logging
                        logging.getLogger(__name__).warning(f"Failed to load attachment by ID {att_id}: {e}")
                
                # Якщо не знайдено за ID, спробувати за URL
                if not file_path and url:
                    url_clean = url.split("?")[0]
                    if "/media/" in url_clean:
                        file_path = MEDIA_DIR / url_clean.split("/media/")[-1]
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
                            if att_type == "image":
                                payload = {
                                    "messaging_product": "whatsapp",
                                    "to": conversation.external_id,
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
                                    "to": conversation.external_id,
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
                                    "to": conversation.external_id,
                                    "type": "audio",
                                    "audio": {
                                        "id": media_id,
                                    },
                                }
                            else:
                                # Document
                                payload = {
                                    "messaging_product": "whatsapp",
                                    "to": conversation.external_id,
                                    "type": "document",
                                    "document": {
                                        "id": media_id,
                                        "filename": filename,
                                    },
                                }
                                if content:
                                    payload["document"]["caption"] = content
                            
                            response = await client.post(url, json=payload, headers=headers)
                            response.raise_for_status()
                            result = response.json()
                        else:
                            raise ValueError("Failed to upload media to WhatsApp")
                else:
                    # Файл не знайдено, відправити тільки текст
                    payload = {
                        "messaging_product": "whatsapp",
                        "to": conversation.external_id,
                        "type": "text",
                        "text": {"body": content},
                    }
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.post(url, json=payload, headers=headers)
                        response.raise_for_status()
                        result = response.json()
            else:
                # Немає вкладень, відправити тільки текст
                payload = {
                    "messaging_product": "whatsapp",
                    "to": conversation.external_id,  # Номер телефону
                    "type": "text",
                    "text": {"body": content},
                }
                
                async with httpx.AsyncClient() as client:
                    response = await client.post(url, json=payload, headers=headers)
                    response.raise_for_status()
                    result = response.json()
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.utcnow()
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
    
    async def get_or_create_conversation(
        self,
        external_id: str,
        client_id: Optional[UUID] = None,
        subject: Optional[str] = None,
    ) -> Conversation:
        """Отримати або створити розмову."""
        # Шукаємо існуючу розмову
        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.WHATSAPP,
            Conversation.external_id == external_id,
        ).first()
        
        if conversation:
            return conversation
        
        # Створюємо нову розмову
        conversation = Conversation(
            platform=PlatformEnum.WHATSAPP,
            external_id=external_id,
            client_id=client_id,
            subject=subject,
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation

