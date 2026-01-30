"""
InstagramService - обробка Instagram Direct Messages через Meta Instagram Graph API.
"""
import hmac
import hashlib
import httpx
import json
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


class InstagramService(MessengerService):
    """Сервіс для роботи з Instagram Direct Messages через Meta Instagram Graph API."""
    
    def __init__(self, db: Session, config: Optional[Dict[str, Any]] = None):
        """
        Ініціалізація Instagram сервісу.
        
        Args:
            db: Database session
            config: Конфігурація (access_token, app_secret, verify_token, page_id)
        """
        if config is None:
            config = self._load_config(db)
        super().__init__(db, config)
        self.base_url = "https://graph.facebook.com/v18.0"
    
    def get_platform(self) -> PlatformEnum:
        return PlatformEnum.INSTAGRAM
    
    def _load_config(self, db: Session) -> Dict[str, Any]:
        """Завантажити конфігурацію з бази даних або env."""
        import os
        import crud
        import logging
        logger = logging.getLogger(__name__)
        
        # Використовуємо передану сесію БД замість створення нової
        # Це дозволяє уникнути проблем з кешуванням та забезпечує актуальні дані
        try:
            settings = crud.get_instagram_settings(db)
            page_id = settings.get("instagram_page_id") or ""
            logger.info(f"[Instagram Config] Loaded from DB: app_id={bool(settings.get('instagram_app_id'))}, access_token={bool(settings.get('instagram_access_token'))}, app_secret={bool(settings.get('instagram_app_secret'))}, verify_token={bool(settings.get('instagram_verify_token'))}, page_id={bool(page_id)}")
            
            # Перевіряємо чи є хоча б один ключ (не обов'язково app_secret)
            if any(settings.values()):
                config = {
                    "access_token": settings.get("instagram_access_token") or "",
                    "app_secret": settings.get("instagram_app_secret") or "",
                    "verify_token": settings.get("instagram_verify_token") or "",
                    "app_id": settings.get("instagram_app_id") or "",
                    "page_id": page_id,
                }
                logger.info(f"[Instagram Config] Using DB config, verify_token length: {len(config.get('verify_token', ''))}, page_id: {bool(config.get('page_id'))}")
                return config
        except Exception as e:
            logger.warning(f"[Instagram Config] Error loading from DB: {e}")
        
        # Fallback до env
        logger.info("[Instagram Config] Using env fallback")
        return {
            "access_token": os.getenv("INSTAGRAM_ACCESS_TOKEN", ""),
            "app_secret": os.getenv("INSTAGRAM_APP_SECRET", ""),
            "verify_token": os.getenv("INSTAGRAM_VERIFY_TOKEN", ""),
            "app_id": os.getenv("INSTAGRAM_APP_ID", ""),
            "page_id": os.getenv("INSTAGRAM_PAGE_ID", ""),
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
    
    async def get_user_profile(self, igsid: str, rate_limit_delay: float = 0.0) -> Optional[Dict[str, Any]]:
        """
        Отримати профіль Instagram користувача за його IGSID через Graph API.
        
        Args:
            igsid: Instagram Scoped ID користувача
            rate_limit_delay: Затримка перед запитом (для rate limiting)
            
        Returns:
            Словник з полями: username, name, profile_pic
        """
        import logging
        import asyncio
        logger = logging.getLogger(__name__)
        
        # Rate limiting: затримка перед запитом
        if rate_limit_delay > 0:
            await asyncio.sleep(rate_limit_delay)
        
        access_token = self.config.get("access_token")
        if not access_token:
            logger.warning(f"[Instagram Profile] No access token configured")
            return None
        
        try:
            # Для Instagram потрібно використовувати Instagram Graph API endpoint, а не Facebook
            # Використовуємо graph.instagram.com замість graph.facebook.com
            url = f"https://graph.instagram.com/v18.0/{igsid}"
            params = {
                "fields": "username,name,profile_pic",
                "access_token": access_token,
            }
            
            logger.info(f"[Instagram Profile] Fetching profile for IGSID: {igsid[:20]}...")
            
            async with httpx.AsyncClient() as client:
                response = await client.get(url, params=params, timeout=10.0)
                
                # Логуємо повну відповідь при помилці
                if response.status_code != 200:
                    error_text = response.text
                    logger.error(f"[Instagram Profile] Failed to fetch profile for {igsid}: HTTP {response.status_code}")
                    logger.error(f"[Instagram Profile] Error response: {error_text}")
                    print(f"[Instagram Profile] Error: {error_text}", flush=True)
                    return None
                
                result = response.json()
                logger.info(f"[Instagram Profile] Successfully fetched profile: username={result.get('username')}, name={result.get('name')}")
                return result
        except httpx.HTTPStatusError as e:
            error_text = e.response.text if e.response else str(e)
            logger.error(f"[Instagram Profile] HTTP error for {igsid}: {e}")
            logger.error(f"[Instagram Profile] Error response: {error_text}")
            print(f"[Instagram Profile] HTTP Error: {error_text}", flush=True)
            return None
        except Exception as e:
            logger.warning(f"[Instagram Profile] Failed to fetch Instagram profile for {igsid}: {e}")
            print(f"[Instagram Profile] Exception: {e}", flush=True)
            return None
    
    async def send_message(
        self,
        conversation_id: UUID,
        content: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> "MessageModel":
        """Відправити повідомлення в Instagram Direct Messages."""
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
            is_from_me=True,  # Відправлені повідомлення завжди від нас
        )
        
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            # Динамічно завантажити конфігурацію з БД (налаштування можуть змінитися)
            current_config = self._load_config(self.db)
            
            # Відправити через Meta Instagram Graph API
            page_id = current_config.get("page_id")
            access_token = current_config.get("access_token")
            
            if not access_token:
                error_msg = "Instagram access token is missing in settings"
                logger.error(f"[Instagram Send] {error_msg}")
                print(f"[Instagram Send] ERROR: {error_msg}", flush=True)
                raise ValueError(error_msg)
            
            if not page_id:
                error_msg = "Instagram Business ID (page_id) is missing in settings. Please configure it in Settings -> Instagram"
                logger.error(f"[Instagram Send] {error_msg}")
                print(f"[Instagram Send] ERROR: {error_msg}", flush=True)
                raise ValueError(error_msg)
            
            # Instagram використовує той самий API що і Facebook Messenger
            url = f"{self.base_url}/{page_id}/messages"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
            }
            
            # Якщо external_id це @username, використовуємо IGSID з metadata першого повідомлення
            recipient_id = conversation.external_id
            if recipient_id.startswith("@"):
                # Шукаємо IGSID в metadata повідомлень
                first_message = self.db.query(Message).filter(
                    Message.conversation_id == conversation_id
                ).order_by(Message.created_at.asc()).first()
                
                if first_message and first_message.meta_data and first_message.meta_data.get("igsid"):
                    recipient_id = first_message.meta_data["igsid"]
                    logger.info(f"[Instagram Send] Using IGSID from metadata: {recipient_id[:20]}...")
                else:
                    # Якщо IGSID не знайдено, спробувати отримати з external_id (видалити @)
                    # Але це не спрацює, тому краще використати оригінальний external_id
                    logger.warning(f"[Instagram Send] IGSID not found in metadata, using external_id as-is")
            
            # Обробити вкладення
            if attachments and len(attachments) > 0:
                # Instagram підтримує тільки один файл за раз
                att = attachments[0]
                att_id = att.get("id")
                url_att = att.get("url", "")
                filename = att.get("filename", "file")
                mime_type = att.get("mime_type", "application/octet-stream")
                att_type = att.get("type", "image")
                
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
                        logger.warning(f"[Instagram Send] Failed to load attachment by ID {att_id}: {e}")
                
                # Якщо не знайдено за ID, спробувати за URL
                if not file_path and url_att:
                    url_clean = url_att.split("?")[0]
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
                    # Завантажити файл на Meta сервер через Instagram Media API
                    upload_url = f"{self.base_url}/{page_id}/message_attachments"
                    
                    async with httpx.AsyncClient() as client:
                        # Створюємо multipart/form-data запит
                        files = {
                            "message": (None, json.dumps({
                                "attachment": {
                                    "type": att_type,
                                    "payload": {}
                                }
                            })),
                            "filedata": (filename, file_data, mime_type),
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
                        attachment_id = upload_result.get("attachment_id")
                        
                        if attachment_id:
                            # Відправляємо повідомлення з медіа
                            if att_type == "image":
                                payload = {
                                    "recipient": {"id": recipient_id},
                                    "message": {
                                        "attachment": {
                                            "type": "image",
                                            "payload": {
                                                "attachment_id": attachment_id
                                            }
                                        }
                                    },
                                }
                                if content:
                                    payload["message"]["text"] = content
                            elif att_type == "video":
                                payload = {
                                    "recipient": {"id": recipient_id},
                                    "message": {
                                        "attachment": {
                                            "type": "video",
                                            "payload": {
                                                "attachment_id": attachment_id
                                            }
                                        }
                                    },
                                }
                                if content:
                                    payload["message"]["text"] = content
                            else:
                                # Document або інші типи
                                payload = {
                                    "recipient": {"id": recipient_id},
                                    "message": {
                                        "attachment": {
                                            "type": "file",
                                            "payload": {
                                                "attachment_id": attachment_id
                                            }
                                        }
                                    },
                                }
                                if content:
                                    payload["message"]["text"] = content
                        else:
                            # Якщо не вдалося завантажити, відправити тільки текст
                            payload = {
                                "recipient": {"id": recipient_id},
                                "message": {"text": content or "File upload failed"},
                            }
                else:
                    # Файл не знайдено, відправити тільки текст
                    payload = {
                        "recipient": {"id": recipient_id},
                        "message": {"text": content or "File not found"},
                    }
            else:
                # Немає вкладень, відправити тільки текст
                payload = {
                    "recipient": {"id": recipient_id},  # Instagram User ID (IGSID)
                    "message": {"text": content},
                }
            
            logger.info(f"[Instagram Send] Sending message to IGSID: {conversation.external_id[:20]}...")
            logger.info(f"[Instagram Send] URL: {url}")
            logger.info(f"[Instagram Send] Payload: {payload}")
            print(f"[Instagram Send] Sending to {conversation.external_id[:20]}...", flush=True)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, headers=headers, timeout=30.0)
                
                # Логуємо повну відповідь від Meta
                response_text = response.text
                logger.info(f"[Instagram Send] Response status: {response.status_code}")
                logger.info(f"[Instagram Send] Full response: {response_text}")
                print(f"[Instagram Send] Response ({response.status_code}): {response_text}", flush=True)
                
                # Обробка помилок з детальним логуванням
                if response.status_code != 200:
                    error_msg = f"Instagram API returned {response.status_code}: {response_text}"
                    logger.error(f"[Instagram Send] {error_msg}")
                    print(f"[Instagram Send] ERROR: {error_msg}", flush=True)
                    response.raise_for_status()
                
                result = response.json()
                logger.info(f"[Instagram Send] Success! Message ID: {result.get('message_id')}")
                print(f"[Instagram Send] Success! Message ID: {result.get('message_id')}", flush=True)
            
            # Оновити статус
            message.status = MessageStatus.SENT
            message.sent_at = datetime.utcnow()
            if metadata is None:
                metadata = {}
            metadata["instagram_message_id"] = result.get("message_id")
            message.meta_data = metadata
            self.db.commit()
            logger.info(f"[Instagram Send] Message saved to DB with status SENT")
            
        except httpx.HTTPStatusError as e:
            error_text = e.response.text if e.response else str(e)
            error_msg = f"HTTP {e.response.status_code if e.response else 'Unknown'}: {error_text}"
            logger.error(f"[Instagram Send] HTTP error: {error_msg}")
            print(f"[Instagram Send] HTTP ERROR: {error_msg}", flush=True)
            message.status = MessageStatus.FAILED
            self.db.commit()
            raise Exception(error_msg) from e
        except Exception as e:
            error_msg = f"Failed to send Instagram message: {e}"
            logger.error(f"[Instagram Send] {error_msg}", exc_info=True)
            print(f"[Instagram Send] EXCEPTION: {error_msg}", flush=True)
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
        """
        Обробити вхідне повідомлення з Instagram Direct Messages.
        
        Args:
            external_id: IGSID клієнта (завжди клієнта, навіть якщо повідомлення від нас)
            content: Текст повідомлення
            sender_info: Інформація про відправника
            attachments: Вкладення
            metadata: Метадані
            is_from_me: Чи повідомлення від нас (True) або від клієнта (False)
        """
        from modules.communications.models import Message as MessageModel
        
        # Визначити direction на основі is_from_me
        # Якщо is_from_me=True, то це OUTBOUND (ми відправили)
        # Якщо is_from_me=False або None, то це INBOUND (клієнт надіслав)
        direction = MessageDirection.OUTBOUND if is_from_me else MessageDirection.INBOUND
        
        # Отримати або створити розмову
        # external_id завжди містить IGSID клієнта
        conversation = await self.get_or_create_conversation(
            external_id=external_id,
            client_id=None,
        )
        
        # Створити повідомлення
        message = self.create_message_in_db(
            conversation_id=conversation.id,
            direction=direction,
            message_type=MessageType.TEXT,
            content=content,
            status=MessageStatus.SENT,
            attachments=attachments,
            metadata=metadata,
            is_from_me=is_from_me,
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
        # Якщо external_id починається з @, шукаємо за ним
        # Якщо це IGSID (число), шукаємо за ним або за @username з metadata
        search_id = external_id
        
        # Шукаємо існуючу розмову за external_id
        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.INSTAGRAM,
            Conversation.external_id == external_id,
        ).first()
        
        # Якщо не знайдено, шукаємо за IGSID або username в metadata
        if not conversation:
            from modules.communications.models import Message
            import logging
            logger = logging.getLogger(__name__)
            
            # Шукаємо всі повідомлення Instagram з metadata
            messages = self.db.query(Message).join(Conversation).filter(
                Conversation.platform == PlatformEnum.INSTAGRAM,
                Message.meta_data.isnot(None)
            ).all()
            
            # Перевіряємо кожне повідомлення
            for msg in messages:
                if msg.meta_data and isinstance(msg.meta_data, dict):
                    # Якщо external_id це @username, шукаємо за username в metadata
                    if external_id.startswith("@"):
                        username = external_id.replace("@", "")
                        if msg.meta_data.get("username") == username:
                            conversation = msg.conversation
                            logger.info(f"[Instagram Conversation] Found by username: {username}")
                            break
                    else:
                        # Якщо external_id це IGSID (числовий), шукаємо за IGSID в metadata
                        igsid = msg.meta_data.get("igsid")
                        if igsid and str(igsid) == str(external_id):
                            conversation = msg.conversation
                            logger.info(f"[Instagram Conversation] Found by IGSID: {external_id}")
                            break
        
        if conversation:
            # Оновити external_id якщо він змінився (з IGSID на @username)
            if external_id.startswith("@") and conversation.external_id != external_id:
                conversation.external_id = external_id
                self.db.commit()
            return conversation
        
        # Створюємо нову розмову
        conversation = Conversation(
            platform=PlatformEnum.INSTAGRAM,
            external_id=external_id,
            client_id=client_id,
            subject=subject,
        )
        self.db.add(conversation)
        self.db.commit()
        self.db.refresh(conversation)
        
        return conversation

