# Повне виправлення WebSocket підключення

## Проблема
WebSocket не підключається з помилкою `1006` (abnormal closure):
```
WebSocket connection to 'wss://tlumaczeniamt.com.pl:8000/api/v1/communications/ws/current-user' failed
```

## Виправлення

### ✅ Крок 1: Nginx конфігурація

**Файл:** `nginx-production.conf`

Оновлено блок для WebSocket:
```nginx
location ~* ^/api/v1/(communications|notifications)/ws/ {
    proxy_pass http://crm_translations_backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_cache_off;  # ← ДОДАНО
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;  # ← ДОДАНО
}
```

**Важливо:** 
- `proxy_cache_off` - вимикає кешування для WebSocket
- `proxy_send_timeout` - дозволяє довгі з'єднання

### ✅ Крок 2: Frontend URL

**Файл:** `frontend/src/modules/communications/hooks/useMessagesWebSocket.ts`

Виправлено URL для production (без порту):
```typescript
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const host = isProduction 
  ? window.location.host  // Production: tlumaczeniamt.com.pl (без :8000)
  : `${window.location.hostname}:8000`;  // Development: localhost:8000
const wsUrl = `${protocol}//${host}/api/v1/communications/ws/${userId}`;
```

**Результат:**
- Development: `ws://localhost:8000/api/v1/communications/ws/{userId}`
- Production: `wss://tlumaczeniamt.com.pl/api/v1/communications/ws/{userId}` ✅

### ✅ Крок 3: Backend CORS та Origin Check

**Файл:** `backend/main.py`

1. **Додано wss:// до allowed_origins:**
```python
allowed_origins = [
    "http://localhost:5173",
    "ws://localhost:5173",
    "wss://localhost:5173",  # ← ДОДАНО
    "https://tlumaczeniamt.com.pl",
    "http://tlumaczeniamt.com.pl",
    "wss://tlumaczeniamt.com.pl",  # ← ДОДАНО
    "ws://tlumaczeniamt.com.pl",  # ← ДОДАНО
    # ... інші домени
]
```

2. **Додано origin check для WebSocket endpoint:**
```python
@app.websocket("/api/v1/communications/ws/{user_id}")
async def websocket_messages_endpoint(websocket: WebSocket, user_id: str):
    # Перевірка origin для WebSocket (CORS middleware не працює для WS)
    origin = websocket.headers.get("origin") or websocket.headers.get("Origin")
    if origin:
        allowed_hosts = [
            "https://tlumaczeniamt.com.pl",
            "http://tlumaczeniamt.com.pl",
            "https://www.tlumaczeniamt.com.pl",
            "http://www.tlumaczeniamt.com.pl",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        if not any(origin.startswith(host) for host in allowed_hosts):
            logger.warning(f"WebSocket connection rejected: invalid origin {origin}")
            await websocket.close(code=1008, reason="Origin not allowed")
            return
    # ... решта коду
```

**Важливо:** CORS middleware не працює для WebSocket, тому потрібна ручна перевірка origin.

### ✅ Крок 4: User ID

**Файл:** `frontend/src/modules/communications/pages/InboxPageEnhanced.tsx`

Виправлено отримання user_id:
```typescript
const userId = getUserIdFromToken();  // ← ДОДАНО
const { isConnected: wsConnected } = useMessagesWebSocket({
  userId: userId || 'current-user',  // Використовуємо реальний ID
  // ...
});
```

## Перевірка після виправлення

### 1. Перезапустіть сервіси:
```bash
# На сервері
docker-compose restart nginx backend
```

### 2. Перевірте логи backend:
```bash
docker logs crm_translations_backend | grep WebSocket
```

Має з'явитися:
```
WebSocket connection attempt from user: {real-uuid}, origin: https://tlumaczeniamt.com.pl
WebSocket accepted for user: {real-uuid}
```

### 3. Перевірте в консолі браузера:

**Правильний URL:**
```
[WebSocket] Connecting to: wss://tlumaczeniamt.com.pl/api/v1/communications/ws/{real-uuid}
[WebSocket] Connected
```

**Неправильний URL (якщо ще є помилка):**
```
[WebSocket] Connecting to: wss://tlumaczeniamt.com.pl:8000/api/v1/communications/ws/current-user
WebSocket connection failed
```

## Якщо все ще не працює

### Перевірте SSL сертифікат

Якщо використовується HTTPS, переконайтеся що:
1. Nginx слухає на порту 443 з SSL
2. SSL сертифікат валідний
3. WebSocket використовує `wss://` протокол

Додайте в `nginx-production.conf`:
```nginx
server {
    listen 443 ssl http2;
    server_name tlumaczeniamt.com.pl www.tlumaczeniamt.com.pl;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    # Те саме що і вище для location /api, /auth та location /
    # Включно з WebSocket location
}
```

### Перевірте firewall

Переконайтеся що порт 443 (HTTPS/WSS) відкритий:
```bash
sudo ufw status
sudo ufw allow 443/tcp
```

## Підсумок змін

✅ Nginx: Додано `proxy_cache_off` та `proxy_send_timeout`  
✅ Frontend: Виправлено URL (без порту в production)  
✅ Frontend: Використовується реальний user_id  
✅ Backend: Додано wss:// до allowed_origins  
✅ Backend: Додано origin check для WebSocket endpoints  

Після цих змін WebSocket має працювати правильно! 🎉

