# Виправлення Backend & Infrastructure - План порятунку

## ✅ 1. Виправлення маперів SQLAlchemy (Critical)

### Проблема
Лістери (email, telegram) "червоні", бо не бачать модель User через relationship.

### Рішення
Додано імпорти моделей в лістери, щоб SQLAlchemy знав про них:

**Файл:** `backend/email_imap_listener.py`
```python
# Імпортуємо моделі щоб SQLAlchemy знав про них для relationship
from modules.auth.models import User  # noqa: F401
from modules.crm.models import Client  # noqa: F401
from modules.communications.models import Conversation, Message  # noqa: F401
```

**Файл:** `backend/telegram_listener.py`
```python
# Імпортуємо моделі щоб SQLAlchemy знав про них для relationship
from modules.auth.models import User  # noqa: F401
from modules.crm.models import Client  # noqa: F401
from modules.communications.models import Conversation, Message  # noqa: F401
```

**Примітка:** В `modules/communications/models.py` вже використовуються рядкові посилання:
- `relationship("Client", ...)` ✅
- `relationship("User", ...)` ✅

Це правильно, але SQLAlchemy все одно потребує, щоб моделі були імпортовані для реєстрації в registry.

## ✅ 2. Виправлення 502 на фронті

### Проблема
502 Bad Gateway означає, що nginx не може досягти backend сервера.

### Перевірка конфігурації

**nginx-production.conf:**
- ✅ Правильно проксує `/api` на `http://crm_translations_backend:8000`
- ✅ Правильно віддає frontend статику з `/usr/share/nginx/html`
- ✅ WebSocket конфігурація правильна

**docker-compose.production.yml:**
- ✅ Backend контейнер називається `crm_translations_backend`
- ✅ Nginx використовує правильну назву контейнера
- ✅ Всі сервіси в одній мережі `crm_translations_network`

### Можливі причини 502:

1. **Backend контейнер не запущений**
   ```bash
   docker ps | grep backend
   docker logs crm_translations_backend --tail 100
   ```

2. **Backend контейнер впав**
   ```bash
   docker ps -a | grep backend
   docker logs crm_translations_backend
   ```

3. **Backend не слухає на порту 8000**
   - Перевірте логи backend
   - Перевірте чи backend запустився успішно

4. **Проблеми з мережею Docker**
   ```bash
   docker network inspect crm_translations_network
   ```

### Рішення для сервера:

```bash
cd /opt/translations/translations-crm
docker-compose -f docker-compose.production.yml restart backend
docker-compose -f docker-compose.production.yml logs backend --tail 50
```

## ✅ 3. Чистка "сміття" в базі - Platform колонка

### Проблема
Колонка називається `platform` (не `platform_type` чи інше).

### Перевірка

**Модель:** `modules/communications/models.py`
```python
platform: Mapped[PlatformEnum] = mapped_column(String, nullable=False, index=True)
```

**Таблиця:** `communications_conversations`
- Колонка: `platform` ✅
- Тип: `VARCHAR` ✅
- Значення: `'telegram'`, `'whatsapp'`, `'email'`, `'instagram'`, `'facebook'` ✅

### SQL запити використовують правильну назву:

```sql
-- email_imap_listener.py
WHERE c.platform = 'email'
WHERE platform = 'email' AND external_id = :external_id

-- telegram_listener.py  
WHERE platform = 'telegram' AND external_id = :external_id
```

### Якщо є проблеми з даними:

```sql
-- Перевірка унікальних значень
SELECT DISTINCT platform FROM communications_conversations;

-- Виправлення некоректних значень (якщо потрібно)
UPDATE communications_conversations 
SET platform = 'email' 
WHERE platform NOT IN ('telegram', 'whatsapp', 'email', 'instagram', 'facebook');
```

## Додаткові перевірки

### Перевірка імпортів в main.py

**Файл:** `backend/main.py`
```python
from modules.auth.models import User  # ✅ Вже є
from modules.crm.models import Client, Order, ...  # ✅ Вже є
from modules.communications.models import Conversation, Message  # ✅ Вже є
```

### Перевірка моделей

**Файл:** `modules/communications/models.py`
- ✅ Використовуються рядкові посилання: `relationship("Client", ...)`
- ✅ Використовується `TYPE_CHECKING` для type hints
- ✅ Моделі правильно визначені

## Підсумок виправлень

1. ✅ **Додано імпорти моделей в лістери** - SQLAlchemy тепер знає про User та Client
2. ✅ **Перевірено nginx конфігурацію** - все правильно налаштовано
3. ✅ **Перевірено platform колонку** - використовується правильна назва

## Наступні кроки для сервера

1. **Перезапустити лістери:**
   ```bash
   docker-compose -f docker-compose.production.yml restart email_imap_listener telegram_listener
   ```

2. **Перевірити логи:**
   ```bash
   docker-compose -f docker-compose.production.yml logs email_imap_listener --tail 50
   docker-compose -f docker-compose.production.yml logs telegram_listener --tail 50
   ```

3. **Перевірити backend:**
   ```bash
   docker-compose -f docker-compose.production.yml logs backend --tail 50
   curl http://localhost:8002/health
   ```

4. **Перевірити nginx:**
   ```bash
   docker-compose -f docker-compose.production.yml exec nginx nginx -t
   docker-compose -f docker-compose.production.yml restart nginx
   ```



