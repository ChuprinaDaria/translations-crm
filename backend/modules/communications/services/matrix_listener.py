"""
Matrix listener service — receives WhatsApp messages via mautrix-whatsapp bridge.

Runs as an asyncio background task inside the FastAPI process.
Connects to Matrix homeserver as @crm_bot, listens via /sync long-polling,
saves incoming WhatsApp messages to CRM Conversation/Message models.
"""
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# Configuration from environment
MATRIX_HOMESERVER = os.getenv("MATRIX_HOMESERVER", "https://matrix.adme-ai.com")
MATRIX_BOT_USER = os.getenv("MATRIX_BOT_USER", "@crm_bot:matrix.adme-ai.com")
MATRIX_BOT_PASSWORD = os.getenv("MATRIX_BOT_PASSWORD", "")
WHATSAPP_BOT_USER = os.getenv("MATRIX_WHATSAPP_BOT", "@whatsappbot:matrix.adme-ai.com")

# matrix-nio is an optional dependency
try:
    from nio import (
        AsyncClient,
        LoginResponse,
        RoomCreateResponse,
        RoomMessageText,
        RoomMessageMedia,
        RoomMessageImage,
        RoomSendResponse,
    )
    NIO_AVAILABLE = True
except ImportError:
    NIO_AVAILABLE = False


class MatrixListener:
    """
    Async background listener for Matrix/WhatsApp bridge messages.

    - Logs in with password (no pre-existing access token needed)
    - Polls /sync for new events in rooms where @whatsappbot is present
    - Extracts phone number from sender (@whatsapp_PHONE:server)
    - Saves to communications_conversations / communications_messages
    - Broadcasts via WebSocket to connected CRM users
    """

    def __init__(self):
        self.client: Optional[AsyncClient] = None
        self.running = False
        self.my_user_id: Optional[str] = None
        self._task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self):
        """Launch the listener as a background asyncio task."""
        if not NIO_AVAILABLE:
            logger.warning("matrix-nio not installed — Matrix listener disabled")
            return
        if not MATRIX_BOT_PASSWORD:
            logger.warning("MATRIX_BOT_PASSWORD not set — Matrix listener disabled")
            return

        self._task = asyncio.create_task(self._run())
        logger.info("Matrix listener background task started")

    async def stop(self):
        """Gracefully stop the listener."""
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self.client:
            await self.client.close()
            self.client = None
        logger.info("Matrix listener stopped")

    # ------------------------------------------------------------------
    # Main loop with auto-reconnect
    # ------------------------------------------------------------------

    async def _run(self):
        self.running = True
        while self.running:
            try:
                await self._connect()
                await self._sync_loop()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Matrix listener error: {e}", exc_info=True)
                if self.client:
                    await self.client.close()
                    self.client = None
                # Exponential-ish backoff
                await asyncio.sleep(10)

    async def _connect(self):
        """Login to Matrix homeserver with password."""
        self.client = AsyncClient(
            homeserver=MATRIX_HOMESERVER,
            user=MATRIX_BOT_USER,
        )

        resp = await self.client.login(MATRIX_BOT_PASSWORD)
        if isinstance(resp, LoginResponse):
            self.my_user_id = resp.user_id
            logger.info(f"Matrix: logged in as {resp.user_id}")
        else:
            raise ConnectionError(f"Matrix login failed: {resp}")

        # Initial sync — skip old messages so we only process NEW ones
        await self.client.sync(timeout=10000)
        logger.info("Matrix: initial sync done, listening for new messages…")

    async def _sync_loop(self):
        """Continuous /sync long-polling loop."""
        while self.running:
            try:
                resp = await self.client.sync(timeout=30000)

                for room_id, room_data in resp.rooms.join.items():
                    for event in room_data.timeline.events:
                        try:
                            await self._process_event(room_id, event)
                        except Exception as e:
                            logger.error(f"Event processing error: {e}", exc_info=True)

            except asyncio.CancelledError:
                raise
            except Exception as e:
                logger.error(f"Sync error: {e}")
                await asyncio.sleep(5)
                raise  # bubble up so _run() reconnects

    # ------------------------------------------------------------------
    # Event processing
    # ------------------------------------------------------------------

    async def _process_event(self, room_id: str, event):
        sender = getattr(event, "sender", "")

        # Skip own messages
        if sender == self.my_user_id:
            return
        # Skip bridge bot service messages
        if sender == WHATSAPP_BOT_USER:
            return
        # Only m.room.message events
        if not isinstance(event, (RoomMessageText, RoomMessageMedia, RoomMessageImage)):
            return

        # Only WhatsApp rooms (rooms where @whatsappbot is a member)
        room = self.client.rooms.get(room_id)
        if room and WHATSAPP_BOT_USER not in room.users:
            return

        event_id = event.event_id
        content_dict = event.source.get("content", {}) if hasattr(event, "source") else {}
        text_content, msg_type, attachments = self._parse_content(content_dict)

        if not text_content and not attachments:
            return

        phone = self._extract_phone(sender)
        sender_name = content_dict.get("displayname") or phone

        # Persist to database
        from db import SessionLocal
        db = SessionLocal()
        try:
            # Duplicate check
            dup = db.execute(
                text("SELECT id FROM communications_messages WHERE meta_data->>'matrix_event_id' = :eid LIMIT 1"),
                {"eid": event_id},
            ).fetchone()
            if dup:
                return

            conv_id = self._get_or_create_conversation(db, phone, sender_name)

            msg_id = str(uuid4())
            now = datetime.now(timezone.utc)

            db.execute(text("""
                INSERT INTO communications_messages
                    (id, conversation_id, direction, type, content, status,
                     attachments, meta_data, created_at)
                VALUES
                    (:id, :conv_id, 'inbound', :msg_type, :content, 'sent',
                     CAST(:att AS jsonb), CAST(:meta AS jsonb), :now)
            """), {
                "id": msg_id,
                "conv_id": conv_id,
                "content": text_content or "",
                "msg_type": msg_type,
                "att": json.dumps(attachments) if attachments else None,
                "meta": json.dumps({
                    "matrix_event_id": event_id,
                    "matrix_room_id": room_id,
                    "matrix_sender": sender,
                    "source": "matrix_bridge",
                }),
                "now": now,
            })

            db.execute(text("""
                UPDATE communications_conversations
                SET updated_at = :now, is_archived = false
                WHERE id = :conv_id
            """), {"now": now, "conv_id": conv_id})

            db.commit()
            logger.info(f"WhatsApp msg from {phone}: {(text_content or '')[:60]}")

            await self._broadcast(conv_id, msg_id, text_content, sender_name, phone, msg_type)

        except Exception as e:
            db.rollback()
            logger.error(f"Error saving message: {e}", exc_info=True)
        finally:
            db.close()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_or_create_conversation(self, db, external_id: str, subject: str = None) -> str:
        row = db.execute(
            text("SELECT id FROM communications_conversations WHERE platform = 'whatsapp' AND external_id = :eid"),
            {"eid": external_id},
        ).fetchone()
        if row:
            return str(row[0])

        conv_id = str(uuid4())
        now = datetime.now(timezone.utc)
        try:
            db.execute(text("""
                INSERT INTO communications_conversations
                    (id, platform, external_id, subject, created_at, updated_at)
                VALUES (:id, 'whatsapp', :eid, :subject, :now, :now)
            """), {"id": conv_id, "eid": external_id, "subject": subject, "now": now})
            db.commit()
        except IntegrityError:
            db.rollback()
            row = db.execute(
                text("SELECT id FROM communications_conversations WHERE platform = 'whatsapp' AND external_id = :eid"),
                {"eid": external_id},
            ).fetchone()
            if row:
                return str(row[0])
            raise
        return conv_id

    @staticmethod
    def _extract_phone(sender: str) -> str:
        """@whatsapp_380501234567:matrix.adme-ai.com → +380501234567"""
        if ":" not in sender:
            return sender
        user_part = sender.split(":")[0].lstrip("@")
        if user_part.startswith("whatsapp_"):
            phone = user_part.replace("whatsapp_", "", 1)
            if phone.isdigit():
                return f"+{phone}"
            return phone
        if user_part.startswith("+"):
            return user_part
        return sender

    @staticmethod
    def _parse_content(content: dict) -> tuple:
        """Parse Matrix event content → (text, type_str, attachments_or_None)."""
        msgtype = content.get("msgtype", "")

        if msgtype == "m.text":
            return content.get("body", ""), "text", None

        type_map = {
            "m.image": "image",
            "m.video": "video",
            "m.audio": "audio",
            "m.file": "file",
        }
        if msgtype in type_map:
            body = content.get("body", msgtype.split(".")[-1].title())
            url = content.get("url", "")
            info = content.get("info", {})
            return body, type_map[msgtype], [{
                "type": type_map[msgtype],
                "url": url,
                "filename": body,
                "mime_type": info.get("mimetype", "application/octet-stream"),
                "size": info.get("size"),
            }]

        return content.get("body", ""), "text", None

    async def _broadcast(self, conv_id, msg_id, content, sender_name, phone, msg_type):
        """Send WebSocket notification to all connected CRM users."""
        try:
            from modules.communications.router import messages_manager

            await messages_manager.broadcast({
                "type": "new_message",
                "conversation_id": conv_id,
                "platform": "whatsapp",
                "message": {
                    "id": msg_id,
                    "conversation_id": conv_id,
                    "direction": "inbound",
                    "type": msg_type,
                    "content": content or "",
                    "status": "sent",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                },
                "conversation": {
                    "id": conv_id,
                    "platform": "whatsapp",
                    "external_id": phone,
                    "client_name": sender_name or phone,
                },
            })
        except Exception as e:
            logger.warning(f"WebSocket broadcast failed: {e}")

    # ------------------------------------------------------------------
    # QR Login / Status  (used by router endpoints)
    # ------------------------------------------------------------------

    async def send_login_command(self) -> dict:
        """
        Send "login" to @whatsappbot and wait for QR code response.
        Uses a *separate* temporary Matrix client so it doesn't interfere
        with the background sync loop.
        """
        if not NIO_AVAILABLE:
            return {"status": "error", "detail": "matrix-nio not installed"}
        if not MATRIX_BOT_PASSWORD:
            return {"status": "error", "detail": "MATRIX_BOT_PASSWORD not configured"}

        client = AsyncClient(homeserver=MATRIX_HOMESERVER, user=MATRIX_BOT_USER)
        try:
            resp = await client.login(MATRIX_BOT_PASSWORD)
            if not isinstance(resp, LoginResponse):
                return {"status": "error", "detail": f"Login failed: {resp}"}

            # Sync to get room list
            await client.sync(timeout=10000)

            # Find DM with bridge bot
            room_id = self._find_bot_dm(client)
            if not room_id:
                room_id = await self._create_bot_dm(client)
            if not room_id:
                return {"status": "error", "detail": "Cannot reach WhatsApp bridge bot"}

            # Send "login" command
            send_resp = await client.room_send(
                room_id=room_id,
                message_type="m.room.message",
                content={"msgtype": "m.text", "body": "login"},
            )
            if not isinstance(send_resp, RoomSendResponse):
                return {"status": "error", "detail": f"Send failed: {send_resp}"}

            # Wait for QR code response (up to 30s)
            qr_b64 = await self._wait_for_qr(client, room_id, timeout=30)
            if qr_b64:
                return {
                    "status": "qr_ready",
                    "qr_code_data": qr_b64,
                    "qr_code_type": "base64",
                }

            return {"status": "error", "detail": "Timeout waiting for QR code from bridge"}
        finally:
            await client.close()

    async def get_bridge_status(self) -> dict:
        """Check WhatsApp bridge connection status by sending "status" to @whatsappbot."""
        if not NIO_AVAILABLE or not MATRIX_BOT_PASSWORD:
            return {"connected": False, "detail": "Matrix not configured"}

        client = AsyncClient(homeserver=MATRIX_HOMESERVER, user=MATRIX_BOT_USER)
        try:
            resp = await client.login(MATRIX_BOT_PASSWORD)
            if not isinstance(resp, LoginResponse):
                return {"connected": False, "detail": "Login failed"}

            await client.sync(timeout=10000)

            room_id = self._find_bot_dm(client)
            if not room_id:
                return {"connected": False, "detail": "No DM with bridge bot"}

            await client.room_send(
                room_id=room_id,
                message_type="m.room.message",
                content={"msgtype": "m.text", "body": "status"},
            )

            status_text = await self._wait_for_text(client, room_id, timeout=10)
            if status_text:
                connected = any(w in status_text.lower() for w in ("connected", "logged in"))
                return {"connected": connected, "status_text": status_text}

            return {"connected": False, "detail": "No response from bridge bot"}
        except Exception as e:
            return {"connected": False, "detail": str(e)}
        finally:
            await client.close()

    # ------------------------------------------------------------------
    # QR/Status helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _find_bot_dm(client) -> Optional[str]:
        """Find existing DM room with the bridge bot."""
        for room_id, room in client.rooms.items():
            if WHATSAPP_BOT_USER in room.users and len(room.users) <= 3:
                return room_id
        return None

    @staticmethod
    async def _create_bot_dm(client) -> Optional[str]:
        try:
            resp = await client.room_create(
                invite=[WHATSAPP_BOT_USER],
                is_direct=True,
            )
            if isinstance(resp, RoomCreateResponse):
                await asyncio.sleep(2)  # give bot time to join
                return resp.room_id
        except Exception as e:
            logger.error(f"Failed to create DM with bridge bot: {e}")
        return None

    @staticmethod
    async def _wait_for_qr(client, room_id: str, timeout: int = 30) -> Optional[str]:
        """Poll /sync waiting for a QR image from the bridge bot."""
        import base64
        import httpx

        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            try:
                sync_resp = await client.sync(timeout=5000)
                room_data = sync_resp.rooms.join.get(room_id)
                if not room_data:
                    continue

                for ev in room_data.timeline.events:
                    if ev.sender != WHATSAPP_BOT_USER:
                        continue
                    c = ev.source.get("content", {}) if hasattr(ev, "source") else {}

                    # Bridge sends QR as m.image
                    if c.get("msgtype") == "m.image":
                        mxc = c.get("url", "")
                        if mxc.startswith("mxc://"):
                            parts = mxc.replace("mxc://", "").split("/", 1)
                            if len(parts) == 2:
                                dl_url = f"{MATRIX_HOMESERVER}/_matrix/media/v3/download/{parts[0]}/{parts[1]}"
                                async with httpx.AsyncClient() as http:
                                    r = await http.get(
                                        dl_url,
                                        headers={"Authorization": f"Bearer {client.access_token}"},
                                        timeout=10,
                                    )
                                    if r.status_code == 200:
                                        return base64.b64encode(r.content).decode()
            except Exception as e:
                logger.warning(f"Error polling for QR: {e}")
                await asyncio.sleep(1)
        return None

    @staticmethod
    async def _wait_for_text(client, room_id: str, timeout: int = 10) -> Optional[str]:
        """Poll /sync waiting for a text response from the bridge bot."""
        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            try:
                sync_resp = await client.sync(timeout=3000)
                room_data = sync_resp.rooms.join.get(room_id)
                if not room_data:
                    continue
                for ev in room_data.timeline.events:
                    if ev.sender != WHATSAPP_BOT_USER:
                        continue
                    c = ev.source.get("content", {}) if hasattr(ev, "source") else {}
                    if c.get("msgtype") == "m.text":
                        return c.get("body", "")
            except Exception as e:
                logger.warning(f"Error polling for text: {e}")
                await asyncio.sleep(1)
        return None


# Singleton — imported by router and main.py
matrix_listener = MatrixListener()
