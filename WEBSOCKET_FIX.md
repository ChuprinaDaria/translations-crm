# Виправлення помилки WebSocket підключення

## Проблема

WebSocket не підключається з помилкою:
```
WebSocket connection to 'wss://tlumaczeniamt.com.pl:8000/api/v1/communications/ws/current-user' failed
Error code: 1006 (abnormal closure)
```

## Причини

1. **Неправильний user_id**: Використовувався `'current-user'` замість реального UUID користувача
2. **Неправильний URL в production**: Використовувався порт `:8000` в URL, але в production nginx проксує без порту
3. **Можлива проблема з SSL**: Якщо використовується HTTPS, потрібен wss:// і правильна конфігурація nginx

## Виправлення

### 1. Використання реального user_id

**Файл:** `frontend/src/modules/communications/pages/InboxPageEnhanced.tsx`

```typescript
// Було:
userId: 'current-user', // TODO: Get actual user ID from auth context

// Стало:
const userId = getUserIdFromToken();
const { isConnected: wsConnected } = useMessagesWebSocket({
  userId: userId || 'current-user', // Fallback if no user ID found
  ...
});
```

### 2. Правильний URL для WebSocket

**Файл:** `frontend/src/modules/communications/hooks/useMessagesWebSocket.ts`

```typescript
// Було:
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = window.location.hostname;
const port = '8000'; // Backend port
const wsUrl = `${protocol}//${host}:${port}/api/v1/communications/ws/${userId}`;

// Стало:
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
const host = isProduction 
  ? window.location.host  // Production: tlumaczeniamt.com.pl (nginx proxies)
  : `${window.location.hostname}:8000`;  // Development: localhost:8000
const wsUrl = `${protocol}//${host}/api/v1/communications/ws/${userId}`;
```

## Результат

Тепер WebSocket підключається:
- **Development**: `ws://localhost:8000/api/v1/communications/ws/{real-user-id}`
- **Production**: `wss://tlumaczeniamt.com.pl/api/v1/communications/ws/{real-user-id}`

## Перевірка nginx конфігурації

Nginx вже налаштований для WebSocket:

```nginx
location ~* ^/api/v1/(communications|notifications)/ws/ {
    proxy_pass http://crm_translations_backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

## Важливо

Якщо використовується HTTPS, переконайтеся що:
1. Nginx слухає на порту 443 з SSL
2. WebSocket використовує `wss://` протокол
3. SSL сертифікат валідний

## Тестування

Після виправлення перевірте в консолі браузера:
- ✅ `[WebSocket] Connecting to: wss://tlumaczeniamt.com.pl/api/v1/communications/ws/{real-uuid}`
- ✅ `[WebSocket] Connected`
- ❌ Більше не повинно бути помилок `1006`

