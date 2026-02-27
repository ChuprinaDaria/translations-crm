# Inbox Optimization & Matrix Bridge Integration — Design

**Date:** 2026-02-27
**Status:** Approved
**Scope:** Performance optimization, media fixes, Matrix/WhatsApp bridge, stability

## Context

CRM inbox module is extremely slow despite FastAPI backend. <500 active conversations, 3-5 concurrent managers. WhatsApp needs to migrate from Meta Business API (WABA) to mautrix-whatsapp bridge via Matrix.

## Critical Issues Found

### Backend
1. **Eager loading explosion** — `lazy="selectin"` on Conversation.messages loads ALL messages for every conversation query
2. **DB Pool default (5 connections)** — too few, `echo=True` in prod slows everything
3. **Missing indexes** — no index on `last_message_at`, `(conversation_id, created_at)`, `(conversation_id, direction, status)`, `(platform, is_archived)`
4. **Sync SMTP in async context** — `smtplib` blocks event loop 10-30s per email
5. **Race condition** — `get_or_create_conversation` creates duplicate conversations
6. **WebSocket memory leak** — crashed connections never cleaned up
7. **WhatsApp mode queried from DB** on every send_message call
8. **No Alembic** — `create_all()` instead of migrations
9. **Matrix bridge** — no retry logic, messages stuck forever on failure

### Frontend
1. **Waterfall API calls** — client, orders, messages loaded sequentially (+800ms)
2. **refreshConversations() flood** — full inbox refetch after every action (3x extra API calls)
3. **useCallback with 13 deps** — re-renders InboxPage on every filter change
4. **No message list virtualization** — 100+ DOM nodes rendered at once (3s lag)
5. **Race condition** — optimistic ID vs server ID → duplicate messages
6. **Video/photo broken** — no error handler, CORS issues, fragile URL normalization
7. **Nginx WebSocket timeout** — 75s idle timeout kills connections

## Approach: Quick Wins First (Phased)

### Phase 1: Backend Performance (Priority: Critical)
- Add composite DB indexes
- Fix pool config: pool_size=20, max_overflow=40, echo=False
- Change `lazy="selectin"` to `lazy="noload"` for Conversation.messages
- Fix race condition with `INSERT ON CONFLICT` or `with_for_update()`
- Cache whatsapp_mode in env var

### Phase 2: Frontend Performance (Priority: Critical)
- Waterfall → `Promise.all([messages, client, orders])`
- Remove refreshConversations flood — update specific conversation in cache
- Clean useCallback dependencies
- Add virtualization if lag persists

### Phase 3: Media Fix (Priority: High)
- Add video `onError` with download fallback
- Fix CORS headers in nginx for `/media/`
- Unify URL normalization function
- Lazy load images in lightbox

### Phase 4: Matrix Bridge (Priority: High)
- Add Synapse + mautrix-whatsapp to docker-compose
- Make MatrixWhatsAppService the default WhatsApp provider
- Add exponential backoff retry logic
- Map Matrix room events → CRM Message model
- Remove/deprecate WABA integration

### Phase 5: Stability (Priority: Medium)
- WebSocket auto-cleanup on connection errors
- Init Alembic migrations
- Deduplicate messages by (content, direction, created_at ± 2s)
- Sync SMTP → aiosmtplib or fully offload to Celery

## Decision: Matrix Replaces WABA
- mautrix-whatsapp becomes the sole WhatsApp backend
- WABA code stays but is disabled by default
- Matrix module already partially exists in backend
- Synapse server needs to be deployed and configured
