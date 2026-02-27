"""
Matrix listener service — receives WhatsApp messages via mautrix-whatsapp bridge.

Runs as an asyncio background task inside the FastAPI process.
Connects to Matrix homeserver as @crm_bot via REST API (httpx),
listens via /sync long-polling, saves incoming WhatsApp messages
to CRM Conversation/Message models.

No matrix-nio dependency — uses Matrix Client-Server REST API directly.
Persists access_token to avoid rate-limited login on every reconnect.
"""
import asyncio
import base64
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

import httpx
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

logger = logging.getLogger(__name__)

# Configuration from environment
MATRIX_HOMESERVER = os.getenv("MATRIX_HOMESERVER", "https://matrix.adme-ai.com")
MATRIX_BOT_USER = os.getenv("MATRIX_BOT_USER", "@crm_bot:matrix.adme-ai.com")
MATRIX_BOT_PASSWORD = os.getenv("MATRIX_BOT_PASSWORD", "")
WHATSAPP_BOT_USER = os.getenv("MATRIX_WHATSAPP_BOT", "@whatsappbot:matrix.adme-ai.com")

# Sync timeout for long-polling (ms)
SYNC_TIMEOUT = 30000
# Minimum delay between reconnect attempts (seconds)
RECONNECT_DELAY = 30
# Token file — persisted via Docker volume (./backend/uploads:/app/uploads)
TOKEN_FILE = Path(os.getenv("MEDIA_ROOT", "/app/media")) / ".matrix_token.json"


class MatrixListener:
    """
    Async background listener for Matrix/WhatsApp bridge messages.

    - Persists access_token to file to avoid login on every reconnect
    - Polls /sync for new events in rooms where @whatsappbot is present
    - Extracts phone number from sender (@whatsapp_PHONE:server)
    - Saves to communications_conversations / communications_messages
    - Broadcasts via WebSocket to connected CRM users
    """

    def __init__(self):
        self._http: Optional[httpx.AsyncClient] = None
        self._access_token: Optional[str] = None
        self._my_user_id: Optional[str] = None
        self._next_batch: Optional[str] = None
        self._joined_rooms: dict = {}  # room_id -> {members: set()}
        self.running = False
        self._task: Optional[asyncio.Task] = None

    # ------------------------------------------------------------------
    # Token persistence
    # ------------------------------------------------------------------

    def _save_token(self):
        """Save access_token + user_id + next_batch to file."""
        if not self._access_token:
            return
        try:
            TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            TOKEN_FILE.write_text(json.dumps({
                "access_token": self._access_token,
                "user_id": self._my_user_id,
                "next_batch": self._next_batch,
                "homeserver": MATRIX_HOMESERVER,
            }))
        except Exception as e:
            logger.warning(f"Failed to save Matrix token: {e}")

    def _load_token(self) -> bool:
        """Load saved token. Returns True if token was loaded."""
        try:
            if not TOKEN_FILE.exists():
                return False
            data = json.loads(TOKEN_FILE.read_text())
            # Only use token if homeserver matches
            if data.get("homeserver") != MATRIX_HOMESERVER:
                self._delete_token()
                return False
            self._access_token = data["access_token"]
            self._my_user_id = data.get("user_id")
            self._next_batch = data.get("next_batch")
            return True
        except Exception as e:
            logger.warning(f"Failed to load Matrix token: {e}")
            return False

    def _delete_token(self):
        """Delete saved token file."""
        try:
            TOKEN_FILE.unlink(missing_ok=True)
        except Exception:
            pass
        self._access_token = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self):
        """Launch the listener as a background asyncio task."""
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
        # Save state before shutdown
        self._save_token()
        if self._http:
            await self._http.aclose()
            self._http = None
        logger.info("Matrix listener stopped")

    # ------------------------------------------------------------------
    # REST API helpers
    # ------------------------------------------------------------------

    def _api_url(self, path: str) -> str:
        return f"{MATRIX_HOMESERVER}{path}"

    def _auth_headers(self, token: Optional[str] = None) -> dict:
        t = token or self._access_token
        return {"Authorization": f"Bearer {t}"} if t else {}

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
                if self._http:
                    await self._http.aclose()
                    self._http = None
                # Don't clear token on network errors — only on 401
                logger.info(f"Reconnecting in {RECONNECT_DELAY}s…")
                await asyncio.sleep(RECONNECT_DELAY)

    async def _connect(self):
        """Connect to Matrix homeserver — reuse saved token or login with password."""
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))

        # Try saved token first
        if self._load_token():
            logger.info(f"Matrix: trying saved token for {self._my_user_id}")
            # Verify token with a lightweight whoami call
            resp = await self._http.get(
                self._api_url("/_matrix/client/v3/account/whoami"),
                headers=self._auth_headers(),
            )
            if resp.status_code == 200:
                self._my_user_id = resp.json().get("user_id", self._my_user_id)
                logger.info(f"Matrix: reusing saved token for {self._my_user_id}")
                # Do initial sync only if we don't have a next_batch
                if not self._next_batch:
                    await self._initial_sync()
                return
            # Token invalid (401) or other error — fall through to login
            logger.info(f"Matrix: saved token invalid ({resp.status_code}), doing fresh login")
            self._delete_token()

        # Fresh login with password
        resp = await self._http.post(
            self._api_url("/_matrix/client/v3/login"),
            json={
                "type": "m.login.password",
                "user": MATRIX_BOT_USER,
                "password": MATRIX_BOT_PASSWORD,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        self._access_token = data["access_token"]
        self._my_user_id = data["user_id"]
        logger.info(f"Matrix: logged in as {self._my_user_id}")

        await self._initial_sync()
        self._save_token()

    async def _initial_sync(self):
        """Initial sync — skip old messages so we only process new ones."""
        sync_resp = await self._http.get(
            self._api_url("/_matrix/client/v3/sync"),
            params={"timeout": "10000"},
            headers=self._auth_headers(),
        )
        sync_resp.raise_for_status()
        sync_data = sync_resp.json()
        self._next_batch = sync_data.get("next_batch")
        self._update_room_members(sync_data)
        self._save_token()
        logger.info("Matrix: initial sync done, listening for new messages…")

    async def _sync_loop(self):
        """Continuous /sync long-polling loop."""
        while self.running:
            try:
                params = {"timeout": str(SYNC_TIMEOUT)}
                if self._next_batch:
                    params["since"] = self._next_batch

                resp = await self._http.get(
                    self._api_url("/_matrix/client/v3/sync"),
                    params=params,
                    headers=self._auth_headers(),
                    timeout=httpx.Timeout(SYNC_TIMEOUT / 1000 + 30, connect=10.0),
                )

                # Token expired mid-session
                if resp.status_code == 401:
                    logger.warning("Matrix: token expired during sync, will re-login")
                    self._delete_token()
                    raise ConnectionError("Token expired")

                resp.raise_for_status()
                data = resp.json()
                self._next_batch = data.get("next_batch", self._next_batch)
                self._update_room_members(data)

                # Save next_batch periodically so we don't reprocess on restart
                self._save_token()

                # Process joined room events
                join = data.get("rooms", {}).get("join", {})
                for room_id, room_data in join.items():
                    events = room_data.get("timeline", {}).get("events", [])
                    for event in events:
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

    def _update_room_members(self, sync_data: dict):
        """Track room membership from sync responses."""
        join = sync_data.get("rooms", {}).get("join", {})
        for room_id, room_data in join.items():
            if room_id not in self._joined_rooms:
                self._joined_rooms[room_id] = {"members": set()}

            # Check state events for membership
            for event_list_key in ("state", "timeline"):
                events_container = room_data.get(event_list_key, {})
                events = events_container.get("events", [])
                for ev in events:
                    if ev.get("type") == "m.room.member":
                        user_id = ev.get("state_key", "")
                        membership = ev.get("content", {}).get("membership", "")
                        if membership in ("join", "invite"):
                            self._joined_rooms[room_id]["members"].add(user_id)
                        elif membership in ("leave", "ban"):
                            self._joined_rooms[room_id]["members"].discard(user_id)

    def _is_whatsapp_room(self, room_id: str) -> bool:
        """Check if room has the WhatsApp bridge bot as member."""
        room = self._joined_rooms.get(room_id, {})
        return WHATSAPP_BOT_USER in room.get("members", set())

    # ------------------------------------------------------------------
    # Event processing
    # ------------------------------------------------------------------

    async def _process_event(self, room_id: str, event: dict):
        sender = event.get("sender", "")

        # Skip own messages
        if sender == self._my_user_id:
            return
        # Skip bridge bot service messages
        if sender == WHATSAPP_BOT_USER:
            return
        # Only m.room.message events
        if event.get("type") != "m.room.message":
            return
        # Only WhatsApp rooms
        if not self._is_whatsapp_room(room_id):
            return

        event_id = event.get("event_id", "")
        content = event.get("content", {})
        text_content, msg_type, attachments = self._parse_content(content)

        if not text_content and not attachments:
            return

        phone = self._extract_phone(sender)
        sender_name = content.get("displayname") or phone

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

    # Shared state for async QR login polling
    _login_state: dict = {}  # {status, qr_code_data, detail, started_at}

    async def _get_or_login_token(self, http: httpx.AsyncClient) -> Optional[str]:
        """Get a valid token for endpoint calls — reuse listener's token or login fresh."""
        if self._access_token:
            logger.info("Verifying existing token via /account/whoami...")
            resp = await http.get(
                self._api_url("/_matrix/client/v3/account/whoami"),
                headers=self._auth_headers(),
            )
            if resp.status_code == 200:
                logger.info(f"Token valid, user: {resp.json().get('user_id')}")
                return self._access_token
            logger.warning(f"Token invalid ({resp.status_code}), will re-login")

        logger.info(f"Logging in as {MATRIX_BOT_USER} to {MATRIX_HOMESERVER}...")
        resp = await http.post(
            self._api_url("/_matrix/client/v3/login"),
            json={
                "type": "m.login.password",
                "user": MATRIX_BOT_USER,
                "password": MATRIX_BOT_PASSWORD,
            },
        )
        if resp.status_code != 200:
            logger.error(f"Login failed: {resp.status_code} {resp.text}")
            return None
        data = resp.json()
        token = data["access_token"]
        self._access_token = token
        self._my_user_id = data.get("user_id")
        self._save_token()
        logger.info(f"Login successful, user_id={self._my_user_id}")
        return token

    def start_login(self) -> dict:
        """Start login process in background, return immediately."""
        if not MATRIX_BOT_PASSWORD:
            logger.error("start_login: MATRIX_BOT_PASSWORD not configured")
            return {"status": "error", "detail": "MATRIX_BOT_PASSWORD not configured"}

        # Already running?
        if self._login_state.get("status") == "pending":
            logger.info("start_login: already pending, skipping duplicate")
            return {"status": "started"}

        logger.info("start_login: launching background login task")
        self._login_state = {"status": "pending", "qr_code_data": None, "detail": None}
        asyncio.ensure_future(self._login_background())
        return {"status": "started"}

    def get_login_qr(self) -> dict:
        """Return current login state (polled by frontend)."""
        state = self._login_state
        if not state:
            return {"status": "idle"}
        if state.get("status") == "pending":
            return {"status": "pending"}
        if state.get("status") == "qr_ready":
            return {
                "status": "qr_ready",
                "qr_code_data": state["qr_code_data"],
                "qr_code_type": "base64",
            }
        if state.get("status") == "error":
            return {"status": "error", "detail": state.get("detail", "Unknown error")}
        return {"status": "idle"}

    async def _login_background(self):
        """Background task: create DM if needed, send 'login', wait for QR."""
        logger.info("=== _login_background STARTED ===")
        http = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
        try:
            logger.info("Step 1: Getting/verifying token...")
            token = await self._get_or_login_token(http)
            if not token:
                logger.error("Step 1 FAILED: could not get token")
                self._login_state = {"status": "error", "detail": "Login to Matrix failed"}
                return

            # Initial sync to get room list
            logger.info("Step 2: Initial sync to get room list...")
            sync_resp = await http.get(
                self._api_url("/_matrix/client/v3/sync"),
                params={"timeout": "10000"},
                headers=self._auth_headers(token),
            )
            if sync_resp.status_code != 200:
                logger.error(f"Step 2 FAILED: sync returned {sync_resp.status_code}: {sync_resp.text[:500]}")
                self._login_state = {"status": "error", "detail": "Sync failed"}
                return
            sync_data = sync_resp.json()
            next_batch = sync_data.get("next_batch")
            joined_rooms = list(sync_data.get("rooms", {}).get("join", {}).keys())
            logger.info(f"Step 2 OK: next_batch={next_batch}, joined_rooms={joined_rooms}")

            # Find or create DM with bridge bot
            logger.info(f"Step 3: Looking for DM with {WHATSAPP_BOT_USER}...")
            room_id = self._find_bot_dm(sync_data)
            if room_id:
                logger.info(f"Step 3 OK: Found existing DM room: {room_id}")
            else:
                logger.info(f"Step 3: No DM found, creating new room with {WHATSAPP_BOT_USER}...")
                room_id = await self._create_bot_dm(http, token)
            if not room_id:
                logger.error("Step 3 FAILED: could not find or create DM room")
                self._login_state = {"status": "error", "detail": "Cannot reach WhatsApp bridge bot"}
                return

            # Send "login" command
            logger.info(f"Step 4: Sending 'login' command to room {room_id}...")
            txn_id = str(uuid4())
            send_resp = await http.put(
                self._api_url(f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn_id}"),
                json={"msgtype": "m.text", "body": "!wa login qr"},
                headers=self._auth_headers(token),
            )
            if send_resp.status_code != 200:
                logger.error(f"Step 4 FAILED: send returned {send_resp.status_code}: {send_resp.text[:500]}")
                self._login_state = {"status": "error", "detail": f"Send failed: {send_resp.text}"}
                return
            logger.info(f"Step 4 OK: message sent, event_id={send_resp.json().get('event_id')}")

            # Wait for QR code response (up to 30s)
            logger.info("Step 5: Waiting for QR code response (30s timeout)...")
            qr_b64 = await self._wait_for_qr(http, token, room_id, next_batch, timeout=30)
            if qr_b64:
                logger.info(f"Step 5 OK: Got QR code ({len(qr_b64)} chars base64)")
                self._login_state = {"status": "qr_ready", "qr_code_data": qr_b64}
            else:
                logger.error("Step 5 FAILED: timeout waiting for QR code")
                self._login_state = {"status": "error", "detail": "Timeout waiting for QR code from bridge"}
        except Exception as e:
            logger.exception(f"_login_background EXCEPTION: {e}")
            self._login_state = {"status": "error", "detail": str(e)}
        finally:
            await http.aclose()
            logger.info(f"=== _login_background FINISHED, state={self._login_state.get('status')} ===")

    async def get_bridge_status(self) -> dict:
        """Check WhatsApp bridge connection status by sending "status" to @whatsappbot."""
        if not MATRIX_BOT_PASSWORD:
            return {"connected": False, "detail": "Matrix not configured"}

        http = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=10.0))
        try:
            token = await self._get_or_login_token(http)
            if not token:
                return {"connected": False, "detail": "Login failed"}

            sync_resp = await http.get(
                self._api_url("/_matrix/client/v3/sync"),
                params={"timeout": "10000"},
                headers=self._auth_headers(token),
            )
            if sync_resp.status_code != 200:
                return {"connected": False, "detail": "Sync failed"}
            sync_data = sync_resp.json()
            next_batch = sync_data.get("next_batch")

            room_id = self._find_bot_dm(sync_data)
            if not room_id:
                return {"connected": False, "detail": "No DM with bridge bot"}

            txn_id = str(uuid4())
            await http.put(
                self._api_url(f"/_matrix/client/v3/rooms/{room_id}/send/m.room.message/{txn_id}"),
                json={"msgtype": "m.text", "body": "!wa status"},
                headers=self._auth_headers(token),
            )

            status_text = await self._wait_for_text(http, token, room_id, next_batch, timeout=10)
            if status_text:
                connected = any(w in status_text.lower() for w in ("connected", "logged in"))
                return {"connected": connected, "status_text": status_text}

            return {"connected": False, "detail": "No response from bridge bot"}
        except Exception as e:
            return {"connected": False, "detail": str(e)}
        finally:
            await http.aclose()

    # ------------------------------------------------------------------
    # QR/Status helpers
    # ------------------------------------------------------------------

    def _find_bot_dm(self, sync_data: dict) -> Optional[str]:
        """Find existing DM room with the bridge bot from sync data."""
        join = sync_data.get("rooms", {}).get("join", {})
        logger.info(f"_find_bot_dm: scanning {len(join)} joined rooms for {WHATSAPP_BOT_USER}")
        for room_id, room_data in join.items():
            members = set()
            for ev in room_data.get("state", {}).get("events", []):
                if ev.get("type") == "m.room.member":
                    if ev.get("content", {}).get("membership") in ("join", "invite"):
                        members.add(ev.get("state_key", ""))
            logger.debug(f"  Room {room_id}: members={members}")
            if WHATSAPP_BOT_USER in members and len(members) <= 3:
                logger.info(f"_find_bot_dm: FOUND DM room {room_id} with members {members}")
                return room_id
        logger.info(f"_find_bot_dm: no DM room found with {WHATSAPP_BOT_USER}")
        return None

    async def _create_bot_dm(self, http: httpx.AsyncClient, token: str) -> Optional[str]:
        try:
            create_body = {
                "invite": [WHATSAPP_BOT_USER],
                "is_direct": True,
                "preset": "trusted_private_chat",
            }
            logger.info(f"Creating DM room: POST /createRoom with {create_body}")
            resp = await http.post(
                self._api_url("/_matrix/client/v3/createRoom"),
                json=create_body,
                headers=self._auth_headers(token),
            )
            logger.info(f"createRoom response: {resp.status_code} {resp.text[:500]}")
            if resp.status_code == 200:
                room_id = resp.json().get("room_id")
                logger.info(f"DM room created: {room_id}, waiting 3s for bot to join...")
                await asyncio.sleep(3)
                return room_id
            else:
                logger.error(f"createRoom failed: {resp.status_code} {resp.text[:500]}")
        except Exception as e:
            logger.exception(f"Failed to create DM with bridge bot: {e}")
        return None

    async def _wait_for_qr(self, http: httpx.AsyncClient, token: str,
                            room_id: str, since: str, timeout: int = 30) -> Optional[str]:
        """Poll /sync waiting for a QR image from the bridge bot."""
        deadline = asyncio.get_event_loop().time() + timeout
        batch = since
        poll_count = 0
        while asyncio.get_event_loop().time() < deadline:
            poll_count += 1
            remaining = int(deadline - asyncio.get_event_loop().time())
            try:
                params = {"timeout": "5000"}
                if batch:
                    params["since"] = batch

                logger.info(f"_wait_for_qr: poll #{poll_count}, {remaining}s remaining, since={batch[:20] if batch else 'None'}...")
                resp = await http.get(
                    self._api_url("/_matrix/client/v3/sync"),
                    params=params,
                    headers=self._auth_headers(token),
                    timeout=httpx.Timeout(15.0, connect=10.0),
                )
                if resp.status_code != 200:
                    logger.warning(f"_wait_for_qr: sync returned {resp.status_code}")
                    continue
                data = resp.json()
                batch = data.get("next_batch", batch)

                room_data = data.get("rooms", {}).get("join", {}).get(room_id, {})
                events = room_data.get("timeline", {}).get("events", [])
                if events:
                    logger.info(f"_wait_for_qr: got {len(events)} events in room {room_id}")
                for ev in events:
                    sender = ev.get("sender")
                    c = ev.get("content", {})
                    msgtype = c.get("msgtype", "")
                    body = c.get("body", "")[:200]
                    logger.info(f"_wait_for_qr: event from={sender} type={ev.get('type')} msgtype={msgtype} body={body}")

                    if sender != WHATSAPP_BOT_USER:
                        continue
                    # Bridge sends QR as m.image
                    if msgtype == "m.image":
                        mxc = c.get("url", "")
                        logger.info(f"_wait_for_qr: GOT IMAGE from bridge bot, mxc={mxc}")
                        if mxc.startswith("mxc://"):
                            parts = mxc.replace("mxc://", "").split("/", 1)
                            if len(parts) == 2:
                                dl_url = self._api_url(
                                    f"/_matrix/media/v3/download/{parts[0]}/{parts[1]}"
                                )
                                logger.info(f"_wait_for_qr: downloading image from {dl_url}")
                                dl_resp = await http.get(
                                    dl_url,
                                    headers=self._auth_headers(token),
                                    timeout=10,
                                )
                                logger.info(f"_wait_for_qr: download status={dl_resp.status_code}, size={len(dl_resp.content)} bytes")
                                if dl_resp.status_code == 200:
                                    return base64.b64encode(dl_resp.content).decode()
                    elif msgtype == "m.text":
                        logger.info(f"_wait_for_qr: bridge bot text response: {body}")
                    elif msgtype == "m.notice":
                        logger.info(f"_wait_for_qr: bridge bot notice: {body}")
            except Exception as e:
                logger.exception(f"_wait_for_qr: error during poll #{poll_count}")
                await asyncio.sleep(1)
        logger.warning(f"_wait_for_qr: TIMEOUT after {poll_count} polls")
        return None

    async def _wait_for_text(self, http: httpx.AsyncClient, token: str,
                              room_id: str, since: str, timeout: int = 10) -> Optional[str]:
        """Poll /sync waiting for a text response from the bridge bot."""
        deadline = asyncio.get_event_loop().time() + timeout
        batch = since
        while asyncio.get_event_loop().time() < deadline:
            try:
                params = {"timeout": "3000"}
                if batch:
                    params["since"] = batch

                resp = await http.get(
                    self._api_url("/_matrix/client/v3/sync"),
                    params=params,
                    headers=self._auth_headers(token),
                    timeout=httpx.Timeout(10.0, connect=10.0),
                )
                if resp.status_code != 200:
                    continue
                data = resp.json()
                batch = data.get("next_batch", batch)

                room_data = data.get("rooms", {}).get("join", {}).get(room_id, {})
                events = room_data.get("timeline", {}).get("events", [])
                for ev in events:
                    if ev.get("sender") != WHATSAPP_BOT_USER:
                        continue
                    c = ev.get("content", {})
                    if c.get("msgtype") == "m.text":
                        return c.get("body", "")
            except Exception as e:
                logger.warning(f"Error polling for text: {e}")
                await asyncio.sleep(1)
        return None


# Singleton — imported by router and main.py
matrix_listener = MatrixListener()
