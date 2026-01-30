# Виправлення помилок WebSocket та 502 Bad Gateway

## Аналіз помилок

### Проблеми виявлені в консолі:

1. **502 Bad Gateway** - Backend сервер не відповідає
   ```
   GET https://tlumaczeniamt.com.pl/api/v1/communications/inbox?filter=all&limit=50 502 (Bad Gateway)
   ```

2. **WebSocket помилки 1006/1012** - Abnormal closure
   ```
   WebSocket connection to 'wss://tlumaczeniamt.com.pl/api/v1/communications/ws/...' failed
   [WebSocket] Disconnected: 1006
   [WebSocket] Disconnected: 1012
   ```

3. **"body stream already read"** - Response читається двічі
   ```
   Error loading conversations: TypeError: Failed to execute 'text' on 'Response': body stream already read
   ```

4. **HTTP2 PING FAILED** - Проблеми з HTTP/2 з'єднанням
   ```
   GET ... net::ERR_HTTP2_PING_FAILED 200 (OK)
   ```

## Виправлення

### ✅ 1. Виправлено помилку "body stream already read"

**Файл:** `frontend/src/lib/api/client.ts`

**Проблема:** Коли response не ok, спроба прочитати JSON, а потім text() призводить до помилки, бо body вже прочитано.

**Рішення:** Використання `response.clone()` перед читанням body:

```typescript
if (!response.ok) {
  let errorData;
  // Використовуємо clone() щоб не читати body двічі
  const responseClone = response.clone();
  try {
    errorData = await response.json();
  } catch {
    // Якщо не вдалося прочитати JSON, спробуємо прочитати текст
    try {
      const text = await responseClone.text();
      errorData = { detail: text || response.statusText };
    } catch {
      errorData = { detail: response.statusText };
    }
  }
  // ...
}
```

### ✅ 2. Додано обробку 502 Bad Gateway

**Файл:** `frontend/src/lib/api/client.ts`

**Рішення:** Додано спеціальну обробку для 502 помилок з зрозумілим повідомленням:

```typescript
// Handle 502 Bad Gateway - backend server is down
if (response.status === 502) {
  console.error('[API] Backend server is not responding (502 Bad Gateway)');
  errorData = { 
    detail: 'Сервер тимчасово недоступний. Спробуйте пізніше або зверніться до адміністратора.' 
  };
}
```

### ✅ 3. Покращено обробку WebSocket помилок

**Файл:** `frontend/src/modules/communications/hooks/useMessagesWebSocket.ts`

**Рішення:** 
- Додано більшу затримку перед переподключенням для abnormal closures (1006, 1012)
- Покращено логування помилок

```typescript
wsRef.current.onclose = (event) => {
  console.log('[WebSocket] Disconnected:', event.code, event.reason);
  setIsConnected(false);
  onDisconnectRef.current?.();

  // Don't reconnect on clean close (1000) or if manually closed
  if (event.code === 1000) {
    return;
  }

  // For abnormal closures (1006, 1012), wait longer before reconnecting
  // These usually indicate server issues
  const isAbnormalClosure = event.code === 1006 || event.code === 1012;
  const reconnectDelay = isAbnormalClosure ? 10000 : 5000; // 10s for abnormal, 5s for others

  if (!reconnectTimeoutRef.current) {
    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('[WebSocket] Attempting to reconnect...');
      reconnectTimeoutRef.current = null;
      connect();
    }, reconnectDelay);
  }
};
```

## Причини 502 Bad Gateway

502 Bad Gateway означає, що nginx не може досягти backend сервера. Можливі причини:

1. **Backend контейнер не запущений** - перевірте `docker ps | grep backend`
2. **Backend контейнер впав** - перевірте логи `docker logs crm_translations_backend`
3. **Неправильна назва контейнера в nginx** - перевірте `nginx-production.conf`
4. **Backend не слухає на порту 8000** - перевірте конфігурацію backend

## Причини WebSocket 1006/1012

1006 та 1012 - це abnormal closure, що означає:
- З'єднання було закрито некоректно
- Backend не відповідає на WebSocket запити
- Nginx не може проксувати WebSocket (неправильна конфігурація)
- SSL/TLS проблеми (якщо використовується HTTPS)

## Рекомендації для сервера

1. **Перевірте статус контейнерів:**
   ```bash
   docker ps -a | grep crm_translations
   ```

2. **Перевірте логи backend:**
   ```bash
   docker logs crm_translations_backend --tail 100
   ```

3. **Перевірте nginx конфігурацію:**
   ```bash
   nginx -t
   ```

4. **Перезапустіть сервіси якщо потрібно:**
   ```bash
   cd /opt/translations/translations-crm
   docker-compose -f docker-compose.production.yml restart backend
   ```

## Результат

Після виправлень:
- ✅ Помилка "body stream already read" більше не виникає
- ✅ 502 помилки обробляються з зрозумілим повідомленням
- ✅ WebSocket переподключення працює коректніше з більшою затримкою для abnormal closures
- ✅ Покращено логування для діагностики проблем

