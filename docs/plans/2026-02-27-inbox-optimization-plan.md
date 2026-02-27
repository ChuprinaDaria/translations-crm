# Inbox Optimization & Matrix Bridge — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical performance bottlenecks in CRM inbox, repair media rendering, replace WhatsApp WABA with Matrix bridge, and improve stability.

**Architecture:** FastAPI backend with SQLAlchemy ORM, React 18 frontend with TanStack Query, WebSocket real-time updates, Celery+Redis task queue, PostgreSQL 15, Docker Compose deployment.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy 2.0, Celery 5.3, React 18, TypeScript, TanStack Query 5, mautrix-whatsapp, Matrix Synapse

---

## Phase 1: Backend Performance (Critical)

### Task 1: Add Database Indexes

**Files:**
- Create: `backend/alembic/` (init later, Task 16)
- Modify: `backend/modules/communications/models.py`
- Modify: `backend/core/database.py`

**Step 1: Add composite indexes to Conversation model**

In `backend/modules/communications/models.py`, add `Index` import and `__table_args__`:

```python
# Line 5 — add Index to imports:
from sqlalchemy import String, Text, ForeignKey, DateTime, Integer, Boolean, Index

# After line 67 (end of Conversation class relationships), add:
    __table_args__ = (
        Index('idx_conv_platform_archived', 'platform', 'is_archived'),
        Index('idx_conv_last_message_at', 'last_message_at'),
    )
```

Note: `last_message_at` already has `index=True` on line 61, but the composite index on `(platform, is_archived)` is new. Verify that the single-column index on `last_message_at` is being created — if yes, skip the standalone index and only add the composite one.

**Step 2: Add composite indexes to Message model**

```python
# After line 94 (end of Message class relationships), add:
    __table_args__ = (
        Index('idx_msg_conv_created', 'conversation_id', 'created_at'),
        Index('idx_msg_conv_dir_status', 'conversation_id', 'direction', 'status'),
    )
```

**Step 3: Apply indexes via raw SQL (since no Alembic yet)**

Create a one-time migration script:

```python
# backend/scripts/add_indexes.py
"""One-time script to add missing indexes. Run: python scripts/add_indexes.py"""
import sys
sys.path.insert(0, '/app')
from core.database import engine
from sqlalchemy import text

indexes = [
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_platform_archived ON communications_conversations(platform, is_archived);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_last_message_at ON communications_conversations(last_message_at DESC);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_conv_created ON communications_messages(conversation_id, created_at DESC);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_conv_dir_status ON communications_messages(conversation_id, direction, status);",
]

with engine.connect() as conn:
    for idx_sql in indexes:
        print(f"Executing: {idx_sql}")
        # CONCURRENTLY requires autocommit
        conn.execution_options(isolation_level="AUTOCOMMIT")
        conn.execute(text(idx_sql))
    print("All indexes created.")
```

**Step 4: Run the script**

```bash
cd /home/dchuprina/crm\ translation/translations-crm
docker compose exec backend python scripts/add_indexes.py
```

Expected: "All indexes created." without errors.

**Step 5: Verify indexes exist**

```bash
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\di *idx_conv*; \di *idx_msg*;"
```

Expected: 4 new indexes listed.

---

### Task 2: Fix Database Pool Configuration

**Files:**
- Modify: `backend/core/database.py:12-16`

**Step 1: Update engine configuration**

Replace lines 12-16 in `backend/core/database.py`:

```python
# OLD (lines 12-16):
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    echo=settings.DEBUG
)

# NEW:
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    pool_recycle=3600,
    echo=False,  # Never echo SQL in production — use logging instead
)
```

**Step 2: Verify backend starts correctly**

```bash
docker compose restart backend
docker compose logs backend --tail=20
```

Expected: No SQLAlchemy echo output, clean startup.

---

### Task 3: Fix Lazy Loading Explosion on Conversation.messages

**Files:**
- Modify: `backend/modules/communications/models.py:65-67`
- Modify: `backend/modules/communications/models.py:93-94`

This is the **#1 performance killer**. When any query touches Conversation, it auto-loads ALL messages via `selectin`.

**Step 1: Change Conversation.messages to lazy="noload"**

In `backend/modules/communications/models.py`, line 67:

```python
# OLD (line 67):
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation", lazy="selectin", cascade="all, delete-orphan")

# NEW:
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="conversation", lazy="noload", cascade="all, delete-orphan")
```

**Step 2: Change Message.conversation to lazy="select" (from "joined")**

In `backend/modules/communications/models.py`, line 93:

```python
# OLD (line 93):
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages", lazy="joined")

# NEW:
    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages", lazy="select")
```

**Step 3: Change Message.attachment_objects to lazy="select" (from "selectin")**

In `backend/modules/communications/models.py`, line 94:

```python
# OLD (line 94):
    attachment_objects: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="message", lazy="selectin", cascade="all, delete-orphan")

# NEW:
    attachment_objects: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="message", lazy="select", cascade="all, delete-orphan")
```

**Step 4: Change Attachment.message to lazy="select" (from "joined")**

In `backend/modules/communications/models.py`, line 110:

```python
# OLD (line 110):
    message: Mapped["Message"] = relationship("Message", back_populates="attachment_objects", lazy="joined")

# NEW:
    message: Mapped["Message"] = relationship("Message", back_populates="attachment_objects", lazy="select")
```

**Step 5: Update /conversations/{id} endpoint to explicitly load messages with attachments**

In `backend/modules/communications/router.py`, find the `get_conversation` endpoint (line ~383). Locate where messages are queried and ensure explicit eager loading:

```python
from sqlalchemy.orm import selectinload

# In the get_conversation endpoint, when querying messages:
messages = db.query(Message).filter(
    Message.conversation_id == conversation.id
).options(
    selectinload(Message.attachment_objects)
).order_by(Message.created_at.asc()).offset(offset).limit(limit).all()
```

**Step 6: Verify /inbox endpoint still works**

The /inbox endpoint (line ~184) already does batch loading for last messages, so it should work fine with `lazy="noload"`. But verify:

```bash
docker compose restart backend
# Test inbox endpoint:
curl -s http://localhost:8002/api/v1/communications/inbox -H "Authorization: Bearer $TOKEN" | python -m json.tool | head -20
```

Expected: Conversations load without messages embedded (only last_message from batch query).

**Step 7: Search entire backend for places that access `conversation.messages` directly**

```bash
grep -rn "\.messages" backend/modules/communications/ --include="*.py" | grep -v "__pycache__" | grep -v "test_"
```

Fix any code that relies on auto-loaded `conversation.messages` by adding explicit queries.

---

### Task 4: Fix Race Condition in get_or_create_conversation

**Files:**
- Modify: `backend/modules/communications/services/whatsapp.py:536-563`
- Modify: `backend/modules/communications/services/email.py` (find equivalent function)
- Modify: Any other service with get_or_create_conversation pattern

**Step 1: Fix WhatsApp get_or_create_conversation**

In `backend/modules/communications/services/whatsapp.py`, replace lines 536-563:

```python
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
        self.db.flush()  # Flush instead of commit to check constraint
        self.db.commit()
        return conversation
    except IntegrityError:
        self.db.rollback()
        # Another worker created it first — just fetch it
        conversation = self.db.query(Conversation).filter(
            Conversation.platform == PlatformEnum.WHATSAPP,
            Conversation.external_id == external_id,
        ).first()
        return conversation
```

**Step 2: Add unique constraint for (platform, external_id)**

Add to `Conversation.__table_args__` (from Task 1):

```python
    __table_args__ = (
        Index('idx_conv_platform_archived', 'platform', 'is_archived'),
        Index('idx_conv_last_message_at', 'last_message_at'),
        Index('uq_conv_platform_external', 'platform', 'external_id', unique=True),
    )
```

And add to `scripts/add_indexes.py`:

```python
"CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_conv_platform_external ON communications_conversations(platform, external_id);",
```

**Step 3: Apply same pattern to email and other services**

Search for all `get_or_create_conversation` and apply the same IntegrityError handling:

```bash
grep -rn "get_or_create_conversation" backend/ --include="*.py" | grep -v "__pycache__"
```

---

### Task 5: Cache WhatsApp Mode

**Files:**
- Modify: `backend/modules/communications/router.py:572-590`

**Step 1: Replace DB query with env var**

In `backend/modules/communications/router.py`, at line ~574:

```python
# OLD (line 574):
whatsapp_mode = crud.get_whatsapp_mode(db)

# NEW:
import os
whatsapp_mode = os.getenv("WHATSAPP_MODE", "matrix")  # Default to matrix per design decision
```

**Step 2: Add WHATSAPP_MODE to docker-compose.yml**

In both `docker-compose.yml` and `docker-compose.production.yml`, add to backend service environment:

```yaml
- WHATSAPP_MODE=matrix
```

**Step 3: Also check if whatsapp_mode is read anywhere else**

```bash
grep -rn "whatsapp_mode\|get_whatsapp_mode" backend/ --include="*.py" | grep -v "__pycache__"
```

Fix all occurrences to use env var.

---

## Phase 2: Frontend Performance (Critical)

### Task 6: Fix Waterfall API Calls in handleOpenChat

**Files:**
- Modify: `frontend/src/modules/communications/pages/InboxPageEnhanced.tsx:272-393`

**Step 1: Find the sequential loading pattern**

In `InboxPageEnhanced.tsx`, within `handleOpenChat` (lines 272-393), locate where client and orders are loaded sequentially after messages.

**Step 2: Wrap parallel-capable calls in Promise.all**

Find the section that loads context (client + orders) — approximately lines 328-376. Change sequential `await` to parallel:

```typescript
// OLD pattern (sequential):
const clientData = await clientsApi.getClient(conversation.client_id);
setClient(clientData);
const clientOrders = await ordersApi.getOrders({ client_id: conversation.client_id });
setOrders(clientOrders);

// NEW pattern (parallel):
const [clientData, clientOrders] = await Promise.all([
  conversation.client_id ? clientsApi.getClient(conversation.client_id) : Promise.resolve(null),
  conversation.client_id ? ordersApi.getOrders({ client_id: conversation.client_id }) : Promise.resolve([]),
]);
setClient(clientData);
setOrders(clientOrders);
```

**Step 3: Verify the chat opens faster**

Test by opening a conversation in the UI. Expected: ~700ms instead of ~1500ms.

---

### Task 7: Remove refreshConversations Flood

**Files:**
- Modify: `frontend/src/modules/communications/pages/InboxPageEnhanced.tsx`

**Step 1: Find all calls to refreshConversations**

Search in InboxPageEnhanced.tsx for `refreshConversations()` calls. They should be at approximately lines 729, 791, 829 (after send message, after actions, etc.)

**Step 2: Replace with targeted cache updates**

Instead of `refreshConversations()` (which invalidates ALL conversation queries), update only the specific conversation:

```typescript
// OLD:
refreshConversations();

// NEW — update just the specific conversation in cache:
queryClient.setQueriesData(
  { queryKey: getConversationQueryKey(conversationId) },
  (old: any) => {
    if (!old) return old;
    return {
      ...old,
      conversation: {
        ...old.conversation,
        last_message_at: new Date().toISOString(),
      },
    };
  }
);
```

**Step 3: Keep refreshConversations only for hard-refresh scenarios**

Keep the function but only call it on manual refresh button click or after archiving/unarchiving.

---

### Task 8: Clean useCallback Dependencies

**Files:**
- Modify: `frontend/src/modules/communications/pages/InboxPageEnhanced.tsx:394-408, 489-498`

**Step 1: Fix handleOpenChat dependencies (lines 394-408)**

Remove unnecessary deps that cause re-creation:

```typescript
// OLD (lines 394-408) — 13 deps:
}, [openChats, openChat, switchToChat, addTab, updateChatMessages,
    markChatAsRead, conversations, client, setClient, setOrders,
    queryClient, filters, getConversationQueryKey]);

// NEW — only truly needed deps:
}, [openChats, openChat, switchToChat, addTab, updateChatMessages,
    markChatAsRead, queryClient, getConversationQueryKey]);
```

For values like `conversations`, `client`, `filters` that are read but shouldn't trigger re-creation, use refs:

```typescript
// Add near the top of the component:
const conversationsRef = useRef(conversations);
conversationsRef.current = conversations;

const filtersRef = useRef(filters);
filtersRef.current = filters;
```

Then use `conversationsRef.current` and `filtersRef.current` inside the callback.

**Step 2: Fix handleWebSocketNewMessage dependencies (lines 489-498)**

```typescript
// OLD — 7 deps:
}, [openChats, updateChatMessages, conversations, addNotification,
    handleOpenChat, queryClient, filters, getConversationQueryKey]);

// NEW:
}, [openChats, updateChatMessages, addNotification,
    queryClient, getConversationQueryKey]);
```

Use `conversationsRef.current` and `filtersRef.current` inside.

**Step 3: Verify no broken functionality**

Test: open chat, switch tabs, receive WebSocket message, send message — all should still work.

---

## Phase 3: Media Fix

### Task 9: Fix Video/Photo Rendering

**Files:**
- Modify: `frontend/src/modules/communications/components/AttachmentPreview.tsx:39-48, 212-243`

**Step 1: Improve normalizeUrl function (lines 39-48)**

```typescript
// OLD (lines 39-48):
const normalizeUrl = (url?: string) => {
  if (!url) return url;
  if (url.startsWith('/api/')) return url;
  if (url.startsWith('/media/') || url.startsWith('/files/')) {
    return `/api/v1/communications${url}`;
  }
  return url;
};

// NEW:
const normalizeUrl = (url?: string): string | undefined => {
  if (!url) return url;
  // Already a full URL (external or absolute API path)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/')) return url;
  // Legacy backend paths
  if (url.startsWith('/media/') || url.startsWith('/files/')) {
    return `/api/v1/communications${url}`;
  }
  // Bare filename — assume media directory
  if (!url.startsWith('/')) {
    return `/api/v1/communications/media/${url}`;
  }
  return url;
};
```

**Step 2: Add error handling to video element (lines 212-243)**

```typescript
// Find the <video> element and add onError + fallback:
const [videoError, setVideoError] = useState(false);

// In the render:
{isVideo && attachment?.url && !videoError ? (
  <div className={cn(
    'relative rounded-lg overflow-hidden border border-gray-200 shadow-sm',
    isPreview ? 'w-[140px]' : 'max-w-[250px]'
  )}>
    <video
      src={normalizeUrl(attachment.url)}
      className="w-full h-auto max-h-[200px] rounded-lg"
      controls
      preload="metadata"
      crossOrigin="anonymous"
      onError={() => setVideoError(true)}
    />
  </div>
) : isVideo && attachment?.url && videoError ? (
  <a
    href={normalizeUrl(attachment.url)}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm"
  >
    <span>Video nie może być odtworzone — pobierz</span>
  </a>
) : null}
```

**Step 3: Add error handling to image elements**

Find `<img>` tags in AttachmentPreview.tsx and add:

```typescript
onError={(e) => {
  (e.target as HTMLImageElement).src = '/placeholder-image.svg'; // or hide
}}
crossOrigin="anonymous"
```

---

### Task 10: Fix CORS Headers for Media in Nginx

**Files:**
- Modify: `nginx.conf` (dev)
- Modify: `nginx-production.conf` (prod)

**Step 1: Add CORS headers to /media/ location in nginx.conf**

Find the `/media/` location block and add:

```nginx
location /media/ {
    alias /app/media/;
    expires 7d;
    add_header Cache-Control "public, immutable";
    # CORS for media files (video/image)
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    add_header Access-Control-Allow-Headers "Range";
    # Enable range requests for video streaming
    add_header Accept-Ranges bytes;
}
```

**Step 2: Same for nginx-production.conf**

Apply identical CORS headers to the production nginx config.

**Step 3: Reload nginx**

```bash
docker compose exec nginx nginx -s reload
```

---

## Phase 4: Matrix Bridge Integration

### Task 11: Add Synapse + mautrix-whatsapp to Docker Compose

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.production.yml`
- Create: `matrix/synapse/homeserver.yaml` (config template)
- Create: `matrix/mautrix-whatsapp/config.yaml` (config template)

**Step 1: Add Matrix services to docker-compose.yml**

Add after the `celery_beat` service:

```yaml
  synapse:
    image: matrixdotorg/synapse:latest
    container_name: crm_synapse
    volumes:
      - synapse_data:/data
      - ./matrix/synapse:/config:ro
    environment:
      - SYNAPSE_CONFIG_DIR=/config
      - SYNAPSE_DATA_DIR=/data
    healthcheck:
      test: ["CMD", "curl", "-fSs", "http://localhost:8008/health"]
      interval: 15s
      timeout: 5s
      retries: 3
    networks:
      - default

  mautrix-whatsapp:
    image: dock.mau.dev/mautrix/whatsapp:latest
    container_name: crm_mautrix_whatsapp
    depends_on:
      synapse:
        condition: service_healthy
      postgres:
        condition: service_healthy
    volumes:
      - ./matrix/mautrix-whatsapp:/data
    networks:
      - default
```

Add to volumes:

```yaml
volumes:
  synapse_data:
```

**Step 2: Create Synapse config template**

```bash
mkdir -p matrix/synapse matrix/mautrix-whatsapp
```

Create `matrix/synapse/homeserver.yaml`:

```yaml
server_name: "crm.local"
pid_file: /data/homeserver.pid

listeners:
  - port: 8008
    tls: false
    type: http
    x_forwarded: true
    resources:
      - names: [client, federation]
        compress: false

database:
  name: psycopg2
  args:
    user: ${POSTGRES_USER}
    password: ${POSTGRES_PASSWORD}
    database: synapse
    host: postgres
    port: 5432
    cp_min: 5
    cp_max: 10

registration_shared_secret: "${MATRIX_REGISTRATION_SECRET}"
enable_registration: false
app_service_config_files:
  - /data/whatsapp-registration.yaml
```

**Step 3: Create mautrix-whatsapp config template**

Create `matrix/mautrix-whatsapp/config.yaml` with essential settings:

```yaml
homeserver:
  address: http://synapse:8008
  domain: crm.local

appservice:
  address: http://mautrix-whatsapp:29318
  hostname: 0.0.0.0
  port: 29318
  database:
    type: postgres
    uri: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/mautrix_whatsapp?sslmode=disable

bridge:
  username_template: "whatsapp_{{.}}"
  displayname_template: "{{.Name}} (WA)"
  personal_filtering_spaces: true
  delivery_receipts: true
  message_status_events: true
  history_sync:
    create_portals: true
  permissions:
    "*": relay
    "@admin:crm.local": admin
```

**Step 4: Add env vars to .env**

```
MATRIX_HOMESERVER=http://synapse:8008
MATRIX_ACCESS_TOKEN=<generated after setup>
MATRIX_REGISTRATION_SECRET=<generate random>
```

**Step 5: Generate Synapse and register bot**

```bash
docker compose up -d synapse
docker compose exec synapse register_new_matrix_user -c /config/homeserver.yaml -u crmbot -p <password> -a
# Save the access token
docker compose up -d mautrix-whatsapp
```

---

### Task 12: Wire MatrixWhatsAppService as Default Provider

**Files:**
- Modify: `backend/modules/communications/router.py:572-590`
- Modify: `backend/modules/integrations/matrix/service.py:96-106`
- Modify: `backend/tasks/messaging_tasks.py:95-112`

**Step 1: Router already handled by Task 5 (WHATSAPP_MODE=matrix)**

Verify that with `WHATSAPP_MODE=matrix`, the router at line 576 routes to MatrixWhatsAppService.

**Step 2: Add retry logic to MatrixWhatsAppService.ensure_connected (lines 96-106)**

```python
# OLD (lines 96-106 in matrix/service.py):
async def ensure_connected(self) -> None:
    if not self.matrix_provider:
        self._initialize_provider()
    if self.matrix_provider:
        try:
            await self.matrix_provider.connect()
        except Exception as e:
            logger.error(f"Failed to connect to Matrix: {e}")
            raise

# NEW:
async def ensure_connected(self, max_retries: int = 3) -> None:
    if not self.matrix_provider:
        self._initialize_provider()
    if not self.matrix_provider:
        raise RuntimeError("Matrix provider not initialized — check config")

    last_error = None
    for attempt in range(max_retries):
        try:
            await self.matrix_provider.connect()
            return
        except Exception as e:
            last_error = e
            wait_time = 2 ** attempt  # 1s, 2s, 4s
            logger.warning(f"Matrix connect attempt {attempt + 1}/{max_retries} failed: {e}. Retrying in {wait_time}s...")
            import asyncio
            await asyncio.sleep(wait_time)

    logger.error(f"Failed to connect to Matrix after {max_retries} attempts: {last_error}")
    raise last_error
```

**Step 3: Fix Celery task for Matrix (messaging_tasks.py:95-112)**

In `backend/tasks/messaging_tasks.py`, update the WhatsApp section to use Matrix:

```python
# Replace lines 95-112:
elif platform_enum == PlatformEnum.WHATSAPP:
    whatsapp_mode = os.getenv("WHATSAPP_MODE", "matrix")

    if whatsapp_mode == "matrix":
        from modules.integrations.matrix.service import MatrixWhatsAppService
        service = MatrixWhatsAppService(db)
    else:
        from modules.communications.services.whatsapp import WhatsAppService
        service = WhatsAppService(db)

    import asyncio
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    message = loop.run_until_complete(
        service.send_message(
            conversation_id=str(conversation_id),
            content=content,
            attachments=attachments_data,
            metadata=metadata,
        )
    )
```

---

### Task 13: Handle Inbound Matrix Events → CRM Messages

**Files:**
- Modify: `backend/modules/integrations/matrix/service.py:264-304`
- Modify: `backend/modules/integrations/matrix/router.py`
- Modify: `backend/main.py` (add webhook endpoint for Matrix)

**Step 1: Add Matrix event polling or appservice endpoint**

mautrix-whatsapp sends events to Synapse, which we can receive via Matrix client sync or appservice transactions. The simplest approach for our volume (<500 conversations):

Add a background listener similar to `telegram_listener.py`:

Create `backend/modules/integrations/matrix/matrix_listener.py`:

```python
"""
Matrix event listener — polls Synapse for new WhatsApp bridge messages.
Runs as a separate Docker service (like telegram_listener).
"""
import asyncio
import logging
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from core.database import SessionLocal
from modules.integrations.matrix.service import MatrixWhatsAppService

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

POLL_INTERVAL = int(os.getenv("MATRIX_POLL_INTERVAL", "5"))


async def listen():
    """Main listener loop."""
    db = SessionLocal()
    try:
        service = MatrixWhatsAppService(db)
        await service.ensure_connected()
        logger.info("Matrix listener connected. Starting sync loop...")

        since_token = None
        while True:
            try:
                sync_response = await service.matrix_provider.client.sync(
                    timeout=30000,
                    since=since_token,
                )
                since_token = sync_response.next_batch

                # Process room events
                for room_id, room_data in sync_response.rooms.join.items():
                    for event in room_data.timeline.events:
                        if event.sender != service.matrix_provider.user_id:
                            await service.process_matrix_event(room_id, event)

            except Exception as e:
                logger.error(f"Sync error: {e}", exc_info=True)
                await asyncio.sleep(POLL_INTERVAL)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(listen())
```

**Step 2: Add Docker service for matrix_listener**

Add to docker-compose.yml:

```yaml
  matrix_listener:
    build: ./backend
    container_name: crm_matrix_listener
    command: python modules/integrations/matrix/matrix_listener.py
    depends_on:
      synapse:
        condition: service_healthy
      postgres:
        condition: service_healthy
    env_file:
      - .env
    volumes:
      - ./media:/app/media
    networks:
      - default
```

**Step 3: Implement process_matrix_event in MatrixWhatsAppService**

In `backend/modules/integrations/matrix/service.py`, update the `process_matrix_event` method (line ~335-371) to:
1. Extract phone number from room
2. Get or create conversation
3. Create Message in DB
4. Broadcast via WebSocket

```python
async def process_matrix_event(self, room_id: str, event) -> None:
    """Process incoming Matrix event from WhatsApp bridge."""
    from modules.integrations.matrix.mapper import (
        event_to_message_content,
        extract_phone_from_room,
        event_to_sender_info,
    )

    phone = extract_phone_from_room(room_id, event.sender)
    if not phone:
        logger.debug(f"Skipping non-WhatsApp event in room {room_id}")
        return

    conversation = await self.get_or_create_conversation(
        external_id=phone,
    )

    content, msg_type, attachments = event_to_message_content(event)

    message = Message(
        conversation_id=conversation.id,
        direction=MessageDirection.INBOUND,
        type=msg_type,
        content=content,
        status=MessageStatus.SENT,
        attachments=attachments,
        external_id=event.event_id,
    )
    self.db.add(message)
    conversation.last_message_at = message.created_at
    self.db.commit()
    self.db.refresh(message)

    # Broadcast via WebSocket
    from modules.communications.router import messages_manager
    await messages_manager.broadcast({
        "type": "new_message",
        "conversation_id": str(conversation.id),
        "message": {
            "id": str(message.id),
            "content": message.content,
            "direction": message.direction,
            "type": message.type,
            "created_at": message.created_at.isoformat(),
            "attachments": message.attachments,
        },
    })
```

---

## Phase 5: Stability

### Task 14: Fix WebSocket Connection Cleanup

**Files:**
- Modify: `backend/modules/communications/router.py:50-99`

**Step 1: The WebSocket manager at line 64-72 already handles errors**

Looking at line 70-72, there IS error cleanup:
```python
except Exception as e:
    logger.error(f"Error sending message to {user_id}: {e}")
    self.disconnect(user_id)
```

And broadcast at line 92-95 also cleans up. This is **already implemented correctly**.

The remaining issue is stale connections from clients that disconnect without sending close frame. Fix by adding periodic cleanup:

**Step 2: Add periodic stale connection cleanup**

Add to the WebSocket endpoint in `main.py` (where the keep-alive ping loop is):

The WebSocket handler in `main.py` already has a 20s ping loop. Add a try/except around the ping to catch stale connections:

```python
# In the WebSocket handler ping loop, ensure stale detection:
try:
    await asyncio.wait_for(
        websocket.receive_text(),
        timeout=30.0
    )
except asyncio.TimeoutError:
    # No response in 30s — connection is stale
    logger.info(f"WebSocket timeout for user {user_id}, disconnecting")
    messages_manager.disconnect(user_id)
    break
```

This should already be the pattern — verify and fix if needed.

---

### Task 15: Fix Duplicate Messages on Frontend

**Files:**
- Modify: `frontend/src/modules/communications/pages/InboxPageEnhanced.tsx:421-435`

**Step 1: Improve deduplication in handleWebSocketNewMessage**

Find the duplicate check (approximately line 423-427):

```typescript
// OLD:
const existingMessage = old.conversation.messages?.find(
  (m: InboxMessage) => m.id === message.id
);
if (existingMessage) return old;

// NEW — also check by content + timestamp proximity:
const isDuplicate = old.conversation.messages?.some(
  (m: InboxMessage) =>
    m.id === message.id ||
    (m.content === message.content &&
     m.direction === message.direction &&
     Math.abs(new Date(m.created_at).getTime() - new Date(message.created_at).getTime()) < 3000)
);
if (isDuplicate) return old;
```

**Step 2: Also deduplicate in updateChatMessages**

Apply same pattern wherever messages are added to local state.

---

### Task 16: Initialize Alembic

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/` directory structure
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/` (initial migration)

**Step 1: Install alembic**

Add to `backend/requirements.txt`:

```
alembic==1.13.1
```

**Step 2: Initialize alembic**

```bash
cd backend
alembic init alembic
```

**Step 3: Configure alembic/env.py**

Edit `alembic/env.py` to use our models and database URL:

```python
from core.database import Base, engine
from core.config import settings

# Import all models so they register with Base.metadata
from modules.communications.models import *
from modules.crm.models import *
from modules.auth.models import *
# ... import all model modules

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
target_metadata = Base.metadata
```

**Step 4: Create initial migration (stamp current state)**

```bash
alembic revision --autogenerate -m "initial schema"
alembic stamp head  # Mark current DB as up-to-date
```

**Step 5: Verify**

```bash
alembic current  # Should show head
alembic history   # Should show initial migration
```

---

### Task 17: Fix Sync SMTP in Email Service

**Files:**
- Modify: `backend/modules/communications/services/email.py:313-322`
- Modify: `backend/requirements.txt`

**Step 1: Add aiosmtplib to requirements**

Add to `backend/requirements.txt`:

```
aiosmtplib==3.0.1
```

**Step 2: Replace smtplib with aiosmtplib**

In `backend/modules/communications/services/email.py`, replace lines 313-322:

```python
# OLD (sync, blocks event loop):
if smtp_port == 465:
    server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
else:
    server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
    server.starttls()
server.login(smtp_user, smtp_password)
server.send_message(msg)
server.quit()

# NEW (async):
import aiosmtplib

await aiosmtplib.send(
    msg,
    hostname=smtp_host,
    port=smtp_port,
    username=smtp_user,
    password=smtp_password,
    use_tls=(smtp_port == 465),
    start_tls=(smtp_port != 465),
    timeout=30,
)
```

Also remove `import smtplib` at the top of the file if no longer needed.

---

## Execution Order Summary

| # | Task | Phase | Priority | Est. Time |
|---|------|-------|----------|-----------|
| 1 | Add DB indexes | 1 | Critical | 15 min |
| 2 | Fix DB pool config | 1 | Critical | 5 min |
| 3 | Fix lazy loading | 1 | Critical | 30 min |
| 4 | Fix race condition | 1 | High | 20 min |
| 5 | Cache WhatsApp mode | 1 | Medium | 10 min |
| 6 | Fix waterfall API | 2 | Critical | 20 min |
| 7 | Remove refresh flood | 2 | Critical | 20 min |
| 8 | Clean useCallback deps | 2 | High | 15 min |
| 9 | Fix video/photo render | 3 | High | 20 min |
| 10 | Fix CORS in nginx | 3 | High | 10 min |
| 11 | Docker Matrix setup | 4 | High | 45 min |
| 12 | Wire Matrix provider | 4 | High | 30 min |
| 13 | Matrix event listener | 4 | High | 40 min |
| 14 | WebSocket cleanup | 5 | Medium | 15 min |
| 15 | Fix duplicate messages | 5 | Medium | 15 min |
| 16 | Init Alembic | 5 | Medium | 20 min |
| 17 | Async SMTP | 5 | Medium | 15 min |

**Total estimated: ~5.5 hours of implementation**

---

## Commit Strategy

Commit after each task:
- Task 1-5: `fix(backend): optimize inbox performance — indexes, pool, lazy loading, race condition`
- Task 6-8: `fix(frontend): optimize inbox rendering — parallel API, cache, useCallback`
- Task 9-10: `fix(media): video/photo rendering with CORS and error handling`
- Task 11-13: `feat(matrix): integrate mautrix-whatsapp bridge as WhatsApp provider`
- Task 14-17: `fix(stability): WebSocket cleanup, deduplication, Alembic, async SMTP`
