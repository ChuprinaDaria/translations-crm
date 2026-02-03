# RAG Endpoints - Список API для Sloth

Всі endpoints підтримують авторизацію через `X-RAG-TOKEN` header.

## Авторизація

```http
X-RAG-TOKEN: adme_rag_secret_987654321
Content-Type: application/json
```

---

## 📋 Основні Endpoints для RAG

### 1. **Отримати conversation (діалог)**
```http
GET /api/v1/communications/conversations/{conversation_id}
```

**Параметри:**
- `conversation_id` (string) - ID діалогу або external_id

**Відповідь:**
```json
{
  "id": "uuid",
  "client_id": "uuid або null",
  "platform": "telegram|whatsapp|email",
  "external_id": "test-123",
  "messages": [...],
  "unread_count": 0
}
```

---

### 2. **Відправити повідомлення**
```http
POST /api/v1/communications/conversations/{conversation_id}/messages
```

**Body:**
```json
{
  "content": "Привіт! Як справи?",
  "attachments": null,
  "meta_data": {
    "ai_generated": true,
    "confidence": 0.95
  }
}
```

**Відповідь:**
```json
{
  "id": "uuid",
  "conversation_id": "uuid",
  "content": "Привіт! Як справи?",
  "direction": "outbound",
  "status": "sent",
  "created_at": "2026-02-03T18:30:00Z"
}
```

---

### 3. **Створити клієнта з діалогу**
```http
POST /api/v1/communications/conversations/{conversation_id}/create-client
```

**Body:**
```json
{
  "name": "Іван Петренко",
  "phone": "+380501234567",
  "email": "ivan@example.com",
  "company_name": "ТОВ Приклад"
}
```

**Відповідь:**
```json
{
  "client_id": "uuid",
  "status": "created"
}
```

---

### 4. **Пошук клієнта по телефону**
```http
GET /api/v1/crm/clients/search-by-phone/{phone}
```

**Параметри:**
- `phone` (string) - Номер телефону (будь-який формат)

**Відповідь:**
```json
{
  "found": true,
  "client": {
    "id": "uuid",
    "full_name": "Іван Петренко",
    "name": "Іван Петренко",
    "phone": "+380501234567",
    "email": "ivan@example.com",
    "source": "telegram"
  }
}
```

Або якщо не знайдено:
```json
{
  "found": false
}
```

---

### 5. **Створити клієнта (альтернативний спосіб)**
```http
POST /api/v1/crm/clients
```

**Body:**
```json
{
  "full_name": "Іван Петренко",
  "phone": "+380501234567",
  "email": "ivan@example.com",
  "source": "telegram",
  "conversation_id": "uuid або null",
  "external_id": "test-123",
  "platform": "telegram"
}
```

---

### 6. **Створити ліда (рекомендовано для RAG)**
```http
POST /api/v1/integrations/receive-lead
```

**Body:**
```json
{
  "name": "Іван Петренко",
  "full_name": "Іван Петренко",
  "email": "ivan@example.com",
  "phone": "+380501234567",
  "company_name": "ТОВ Приклад",
  "message": "Потрібен переклад документів",
  "source": "rag",
  "platform": "telegram",
  "external_id": "+380501234567",
  "conversation_id": "test-123"
}
```

**Відповідь:**
```json
{
  "status": "success",
  "source": "verified_rag",
  "client_id": "uuid",
  "message": "Клієнт успішно створено: Іван Петренко"
}
```

---

### 7. **Отримати inbox (список діалогів)**
```http
GET /api/v1/communications/inbox
```

**Query параметри:**
- `filter` (string, optional) - all | new | in_progress | needs_reply | archived
- `platform` (string, optional) - telegram | whatsapp | email
- `search` (string, optional) - пошук по імені клієнта
- `limit` (int, default=50) - кількість діалогів
- `offset` (int, default=0) - зміщення для пагінації

---

## 🔧 Приклади використання

### Приклад 1: Відправити повідомлення новому клієнту

```bash
# 1. Відправити повідомлення
curl -X POST "http://your-crm.com/api/v1/communications/conversations/test-123/messages" \
  -H "X-RAG-TOKEN: adme_rag_secret_987654321" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Доброго дня! Чим можу допомогти?",
    "meta_data": {"ai_generated": true}
  }'
```

### Приклад 2: Перевірити чи є клієнт, якщо ні - створити

```bash
# 1. Пошук клієнта
curl -X GET "http://your-crm.com/api/v1/crm/clients/search-by-phone/+380501234567" \
  -H "X-RAG-TOKEN: adme_rag_secret_987654321"

# 2. Якщо не знайдено, створити через receive-lead
curl -X POST "http://your-crm.com/api/v1/integrations/receive-lead" \
  -H "X-RAG-TOKEN: adme_rag_secret_987654321" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Іван Петренко",
    "phone": "+380501234567",
    "platform": "telegram",
    "external_id": "+380501234567",
    "conversation_id": "test-123"
  }'
```

### Приклад 3: Створити клієнта з існуючого діалогу

```bash
curl -X POST "http://your-crm.com/api/v1/communications/conversations/test-123/create-client" \
  -H "X-RAG-TOKEN: adme_rag_secret_987654321" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Іван Петренко",
    "phone": "+380501234567",
    "email": "ivan@example.com"
  }'
```

---

## 📊 Типовий робочий процес для RAG

1. **Отримати повідомлення від клієнта** (webhook від платформи → Sloth)

2. **Перевірити чи є клієнт у CRM:**
   ```
   GET /api/v1/crm/clients/search-by-phone/{phone}
   ```

3. **Якщо клієнта немає - створити:**
   ```
   POST /api/v1/integrations/receive-lead
   ```
   або
   ```
   POST /api/v1/communications/conversations/{conversation_id}/create-client
   ```

4. **Згенерувати відповідь (AI)**

5. **Відправити відповідь:**
   ```
   POST /api/v1/communications/conversations/{conversation_id}/messages
   ```

---

## ⚠️ Обмеження для RAG

RAG може:
- ✅ Відправляти повідомлення
- ✅ Створювати клієнтів
- ✅ Шукати клієнтів
- ✅ Читати діалоги

RAG **НЕ** може:
- ❌ Призначати менеджерів
- ❌ Архівувати діалоги
- ❌ Видаляти повідомлення
- ❌ Змінювати налаштування системи

---

## 🔐 Безпека

- Токен `X-RAG-TOKEN` зберігається в БД (таблиця `ai_settings`)
- Токен можна змінити в налаштуваннях AI в CRM
- Кожен запит з RAG токеном логується
- Невалідний токен → 403 Forbidden

---

## 📝 Коди помилок

- **200 OK** - Успіх
- **401 Unauthorized** - Немає токену (ні RAG, ні JWT)
- **403 Forbidden** - Невалідний RAG токен
- **404 Not Found** - Conversation/Client не знайдено
- **422 Validation Error** - Невалідні дані в body
- **500 Internal Server Error** - Помилка сервера

