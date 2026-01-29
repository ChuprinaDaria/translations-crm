# Статус WebSocket та Real-time нотифікацій

## 📊 Загальний статус

| Платформа | WebSocket | Real-time нотифікації | Статус |
|-----------|-----------|----------------------|--------|
| **Telegram** | ✅ | ✅ | Працює |
| **WhatsApp** | ✅ | ✅ | Працює |
| **Email** | ✅ | ✅ | Працює |
| **Facebook** | ✅ | ✅ | Працює |
| **Instagram** | ✅ | ✅ | Працює |

---

## 🔌 WebSocket Endpoints

### 1. Messages WebSocket (для inbox)
**Endpoint:** `ws://localhost:8000/api/v1/communications/ws/{user_id}`

**Файл:** `backend/main.py`

**Функціонал:**
- ✅ Підключення користувача до real-time повідомлень
- ✅ Broadcast нових повідомлень з усіх платформ
- ✅ Ping/pong для збереження з'єднання
- ✅ Автоматичне відключення при помилках

**Frontend hook:** `useMessagesWebSocket` в `frontend/src/modules/communications/hooks/useMessagesWebSocket.ts`

### 2. Notifications WebSocket (для сповіщень)
**Endpoint:** `ws://localhost:8000/api/v1/notifications/ws/{user_id}`

**Файл:** `backend/modules/notifications/router.py`

**Функціонал:**
- ✅ Real-time сповіщення про системні події
- ✅ Налаштування нотифікацій користувача

**Frontend hook:** `useNotificationWebSocket` в `frontend/src/modules/notifications/hooks/useNotificationWebSocket.ts`

---

## 📱 Telegram - Real-time нотифікації

### ✅ Реалізовано

**Компоненти:**

1. **Telegram Listener** (`backend/telegram_listener.py`)
   - ✅ Окремий скрипт для прослуховування повідомлень
   - ✅ Використовує Telethon для підключення до Telegram
   - ✅ Підтримує кілька акаунтів одночасно
   - ✅ Зберігає повідомлення в БД
   - ✅ **Надсилає WebSocket нотифікації через HTTP endpoint**

2. **WebSocket нотифікації:**
   ```python
   # backend/telegram_listener.py:203
   async def notify_websocket(conv_id, msg_id, content, sender_name, external_id, ...):
       # POST до /api/v1/communications/broadcast-message
       # Автоматично сповіщає всіх підключених клієнтів
   ```

3. **Потік даних:**
   ```
   Telegram → telegram_listener.py → БД → notify_websocket() 
   → POST /broadcast-message → WebSocket broadcast → Frontend
   ```

### 🚀 Запуск

```bash
# Вручну
cd backend
python telegram_listener.py

# Або через systemd/supervisor для автозапуску
```

### 📝 Логування

Додано детальне логування:
- ✅ Підключення до Telegram
- ✅ Отримання повідомлень
- ✅ Відправка WebSocket нотифікацій
- ✅ Помилки обробки

---

## 💬 WhatsApp - Real-time нотифікації

### ✅ Реалізовано

**Компоненти:**

1. **Webhook Endpoints:**
   - ✅ `GET /api/v1/communications/webhooks/whatsapp` - верифікація
   - ✅ `POST /api/v1/communications/webhooks/whatsapp` - отримання повідомлень

2. **Webhook Handler** (`backend/modules/communications/webhooks/whatsapp.py`)
   - ✅ Верифікація підпису (X-Hub-Signature-256)
   - ✅ Обробка вхідних повідомлень
   - ✅ Викликає `WhatsAppService.receive_message()`

3. **WhatsApp Service** (`backend/modules/communications/services/whatsapp.py`)
   ```python
   # Рядок 195-202
   async def receive_message(...):
       # Зберігає в БД
       # Notify via WebSocket
       await notify_new_message(message, conversation)
   ```

4. **Потік даних:**
   ```
   WhatsApp → Webhook POST → handle_whatsapp_webhook() 
   → WhatsAppService.receive_message() → notify_new_message() 
   → WebSocket broadcast → Frontend
   ```

### 🔧 Налаштування

1. **Meta Developer Console:**
   - Webhook URL: `https://your-domain.com/api/v1/communications/webhooks/whatsapp`
   - Verify Token: встановлюється в Settings → WhatsApp

2. **Перевірка:**
   ```bash
   # Перевірити логи webhook
   docker logs crm_translations_backend | grep -i whatsapp
   ```

---

## 📧 Email - Real-time нотифікації

### ✅ Реалізовано

**Компоненти:**

1. **Email IMAP Listener** (`backend/email_imap_listener.py`)
   - ✅ Автоматично перевіряє email кожні 60 секунд
   - ✅ Підтримує кілька менеджерських SMTP акаунтів
   - ✅ Зберігає повідомлення в БД
   - ✅ **Надсилає WebSocket нотифікації**

2. **WebSocket нотифікації:**
   ```python
   # backend/email_imap_listener.py:132
   async def notify_websocket(conv_id, msg_id, content, sender_name, external_id):
       # POST до /api/v1/communications/test-notification
       # Автоматично сповіщає всіх підключених клієнтів
   ```

3. **Потік даних:**
   ```
   Email → email_imap_listener.py → БД → notify_websocket() 
   → POST /test-notification → WebSocket broadcast → Frontend
   ```

### 🚀 Запуск

**Автоматично через Docker:**
```bash
# В docker-compose.yml є сервіс email_imap_listener
docker-compose up -d email_imap_listener
```

**Вручну:**
```bash
cd backend
python email_imap_listener.py
```

### 📝 Логування

Додано детальне логування:
- ✅ Підключення до IMAP
- ✅ Успішний логін
- ✅ Кількість знайдених email
- ✅ Обробка кожного акаунта
- ✅ Відправка WebSocket нотифікацій

---

## 🔄 Як працює WebSocket broadcast

### 1. MessagesConnectionManager

**Файл:** `backend/modules/communications/router.py`

```python
class MessagesConnectionManager:
    active_connections: Dict[str, WebSocket]
    
    async def broadcast(self, message: dict):
        # Відправляє повідомлення всім підключеним клієнтам
        for user_id, connection in self.active_connections.items():
            await connection.send_json(message)
```

### 2. Broadcast Endpoint

**Файл:** `backend/main.py:202`

```python
@app.post("/api/v1/communications/broadcast-message")
async def broadcast_message(notification: dict):
    # Отримує нотифікацію від listener'ів
    # Broadcast до всіх WebSocket клієнтів
    await messages_manager.broadcast(notification)
```

### 3. notify_new_message Helper

**Файл:** `backend/modules/communications/router.py:903`

```python
async def notify_new_message(message: Message, conversation: Conversation):
    # Використовується WhatsApp/Telegram/Facebook/Instagram сервісами
    await messages_manager.broadcast({
        "type": "new_message",
        "conversation_id": str(conversation.id),
        "message": {...},
        "conversation": {...}
    })
```

---

## 📋 Формат WebSocket повідомлень

### New Message Notification

```json
{
  "type": "new_message",
  "conversation_id": "uuid",
  "message": {
    "id": "uuid",
    "conversation_id": "uuid",
    "direction": "inbound",
    "type": "text",
    "content": "Текст повідомлення",
    "status": "sent",
    "attachments": [],
    "created_at": "2026-01-22T10:00:00Z"
  },
  "conversation": {
    "id": "uuid",
    "platform": "telegram|whatsapp|email|facebook|instagram",
    "external_id": "+380501234567",
    "client_name": "Ім'я клієнта"
  }
}
```

---

## ✅ Перевірка роботи

### 1. Перевірити WebSocket підключення

```bash
# Подивитись активні з'єднання
docker logs crm_translations_backend | grep "WebSocket connected"

# Подивитись broadcast повідомлення
docker logs crm_translations_backend | grep "Broadcasting message"
```

### 2. Тестувати Telegram

1. Запустити `telegram_listener.py`
2. Відправити повідомлення на Telegram акаунт
3. Перевірити логи:
   ```bash
   # Telegram listener
   python telegram_listener.py
   
   # Backend logs
   docker logs -f crm_translations_backend | grep -i telegram
   ```

### 3. Тестувати WhatsApp

1. Налаштувати webhook в Meta Developer Console
2. Відправити тестове повідомлення
3. Перевірити логи:
   ```bash
   docker logs -f crm_translations_backend | grep -i whatsapp
   ```

### 4. Тестувати Email

1. Переконатись що `email_imap_listener` запущений
2. Відправити email на менеджерський SMTP акаунт
3. Перевірити логи:
   ```bash
   docker logs -f crm_translations_email_listener
   ```

### 5. Тестувати WebSocket з фронтенду

Відкрити inbox в браузері та перевірити:
- ✅ WebSocket підключається
- ✅ Отримуються нотифікації про нові повідомлення
- ✅ Inbox оновлюється в реальному часі

---

## 🐛 Відомі проблеми та рішення

### Проблема: WebSocket не підключається

**Рішення:**
1. Перевірити CORS налаштування
2. Перевірити origin в WebSocket endpoint
3. Перевірити що user_id правильний формат (UUID)

### Проблема: Нотифікації не приходять

**Рішення:**
1. Перевірити що listener запущений (Telegram/Email)
2. Перевірити що webhook налаштований (WhatsApp)
3. Перевірити логи broadcast endpoint:
   ```bash
   docker logs crm_translations_backend | grep "broadcast"
   ```

### Проблема: Email не приходять в inbox

**Рішення:**
1. Перевірити що `email_imap_listener` запущений
2. Перевірити IMAP налаштування
3. Перевірити що є активні менеджерські SMTP акаунти

---

## 📊 Підсумок

### ✅ Що працює:

1. **WebSocket для всіх платформ** ✅
   - Messages WebSocket (`/api/v1/communications/ws/{user_id}`)
   - Notifications WebSocket (`/api/v1/notifications/ws/{user_id}`)

2. **Telegram real-time** ✅
   - Listener працює
   - WebSocket нотифікації працюють

3. **WhatsApp real-time** ✅
   - Webhook endpoints працюють
   - WebSocket нотифікації працюють

4. **Email real-time** ✅
   - IMAP listener працює
   - WebSocket нотифікації працюють

5. **Facebook/Instagram real-time** ✅
   - Webhook endpoints працюють
   - WebSocket нотифікації працюють

### 🎯 Висновок

**Всі платформи мають real-time нотифікації через WebSocket!** ✅

Система повністю налаштована для отримання повідомлень в реальному часі з:
- Telegram (через listener)
- WhatsApp (через webhook)
- Email (через IMAP listener)
- Facebook (через webhook)
- Instagram (через webhook)

Всі повідомлення автоматично зберігаються в БД та сповіщають користувачів через WebSocket.

