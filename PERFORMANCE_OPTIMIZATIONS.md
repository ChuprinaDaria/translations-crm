# Оптимізації продуктивності CRM

## 📋 Зміст

1. [Виконані оптимізації](#виконані-оптимізації)
2. [Інструкції для деплою](#інструкції-для-деплою)
3. [Діагностика Autobot та AI](#діагностика-autobot-та-ai)
4. [Налаштування Celery/Redis](#налаштування-celeryredis)

---

## ✅ Виконані оптимізації

### 1. Оптимізація запитів до БД (N+1 проблема)

**Файл:** `backend/modules/communications/router.py`

**Проблема:** Для кожної розмови в inbox робився окремий запит для отримання останнього повідомлення.

**Рішення:** Використано window function для отримання останнього повідомлення в одному запиті:

```python
# Підзапит для отримання останнього повідомлення кожної розмови
last_message_subquery = db.query(
    Message.conversation_id,
    Message.content.label('last_message_content'),
    func.row_number().over(
        partition_by=Message.conversation_id,
        order_by=desc(Message.created_at)
    ).label('rn')
).subquery()
```

**Результат:** Замість N+1 запитів тепер 1 запит.

---

### 2. Пагінація повідомлень

**Файл:** `backend/modules/communications/router.py`

**Проблема:** При відкритті розмови завантажувалися ВСІ повідомлення.

**Рішення:** Додано пагінацію з параметрами `limit` та `offset`:

```python
@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=500),  # За замовчуванням 100 повідомлень
    offset: int = Query(0, ge=0),
    ...
)
```

**Результат:** Швидше завантаження діалогів, менше навантаження на сервер.

---

### 3. Кешування медіа файлів

**Файли:** 
- `backend/modules/communications/router.py`
- `nginx-production.conf`

**Рішення:**

**Backend (HTTP заголовки):**
```python
headers = {
    "Cache-Control": "public, max-age=604800, immutable",  # 7 днів
    "ETag": f'"{etag}"',
}
```

**Nginx (проксі кеш):**
```nginx
proxy_cache media_cache;
proxy_cache_valid 200 7d;
expires 7d;
add_header Cache-Control "public, immutable";
```

**Результат:** Медіа файли кешуються на 7 днів, зменшується навантаження на backend.

---

### 4. Оптимізація Celery

**Файл:** `backend/tasks/celery_app.py`

**Зміни:**
- Додано черги з пріоритетами (high_priority, default, low_priority)
- Налаштовано роутинг задач за пріоритетом
- Зменшено таймаути для швидших відповідей
- Додано retry політики

```python
task_routes={
    # Високий пріоритет - відповіді клієнтам
    'send_message_task': {'queue': 'high_priority'},
    'process_ai_reply_task': {'queue': 'high_priority'},
    
    # Низький пріоритет - фонові задачі
    'download_and_save_media_task': {'queue': 'low_priority'},
}
```

---

### 5. SQL індекси

**Файл:** `database/optimize_indexes.sql`

Створено індекси для:
- Швидкого отримання повідомлень розмови
- Підрахунку непрочитаних
- Фільтрації за платформою
- Пошуку клієнтів

---

## 🚀 Інструкції для деплою

### Крок 1: Застосувати SQL індекси

```bash
# На сервері
cd /path/to/translations-crm

# Виконати SQL скрипт
docker exec -i crm_translations_postgres psql -U translator -d crm_db < database/optimize_indexes.sql
```

**Примітка:** Якщо gin_trgm_ops не працює, спочатку:
```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Крок 2: Перезапустити сервіси

```bash
# Перезапустити backend та celery
docker-compose -f docker-compose.production.yml restart backend celery_worker celery_beat

# Або повний перезапуск
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d
```

### Крок 3: Перевірити nginx конфігурацію

```bash
# Створити директорію для кешу (якщо не існує)
docker exec crm_translations_nginx mkdir -p /var/cache/nginx/media

# Перезавантажити nginx
docker exec crm_translations_nginx nginx -s reload
```

### Крок 4: Перевірити що все працює

```bash
# Перевірити статус контейнерів
docker ps | grep crm

# Перевірити логи
docker logs crm_translations_backend --tail 50
docker logs crm_translations_celery_worker --tail 50
```

---

## 🤖 Діагностика Autobot та AI

### Чому Autobot не відповідає?

1. **Autobot працює ТІЛЬКИ в неробочий час!**
   
   Перевірте налаштування робочих годин:
   ```bash
   docker exec -it crm_translations_backend python -c "
   from core.database import SessionLocal
   from modules.autobot.models import AutobotSettings
   from modules.autobot.service import AutobotService
   db = SessionLocal()
   for s in db.query(AutobotSettings).all():
       print(f'Office {s.office_id}: enabled={s.enabled}')
       service = AutobotService(db)
       is_working, reason = service.is_working_hours(s.office_id)
       print(f'  Is working hours: {is_working}, Reason: {reason}')
   db.close()
   "
   ```

2. **AI налаштування:**
   ```bash
   docker exec -it crm_translations_backend python -c "
   from core.database import SessionLocal
   from modules.ai_integration.models import AISettings
   db = SessionLocal()
   s = db.query(AISettings).first()
   if s:
       print(f'AI Enabled: {s.is_enabled}')
       print(f'RAG API URL: {s.rag_api_url}')
       print(f'RAG API Key: {\"SET\" if s.rag_api_key else \"NOT SET\"}')
       print(f'Active Channels: {s.active_channels}')
   else:
       print('NO AI SETTINGS!')
   db.close()
   "
   ```

3. **Celery worker працює:**
   ```bash
   docker logs crm_translations_celery_worker --tail 20
   docker exec crm_translations_celery_worker celery -A tasks.celery_app inspect ping
   ```

---

## 🔧 Налаштування Celery/Redis

### Перевірка Redis

```bash
# Ping Redis
docker exec crm_translations_redis redis-cli ping
# Очікувана відповідь: PONG

# Перевірити черги
docker exec crm_translations_redis redis-cli LLEN celery
```

### Перевірка Celery Worker

```bash
# Статус worker
docker exec crm_translations_celery_worker celery -A tasks.celery_app inspect active

# Зареєстровані tasks
docker exec crm_translations_celery_worker celery -A tasks.celery_app inspect registered

# Статистика
docker exec crm_translations_celery_worker celery -A tasks.celery_app inspect stats
```

### Якщо worker не працює

```bash
# Перезапустити тільки celery
docker-compose -f docker-compose.production.yml restart celery_worker celery_beat

# Перевірити логи
docker logs crm_translations_celery_worker --tail 100
```

### Очищення черги (якщо застрягли задачі)

```bash
# УВАГА: Це видалить всі задачі в черзі!
docker exec crm_translations_redis redis-cli FLUSHDB
```

---

## 📊 Моніторинг

### Додати Flower (веб-інтерфейс для Celery)

Додайте до `docker-compose.production.yml`:

```yaml
flower:
  build: ./backend
  container_name: crm_translations_flower
  command: celery -A tasks.celery_app flower --port=5555
  ports:
    - "5555:5555"
  environment:
    - REDIS_URL=${REDIS_URL}
  depends_on:
    - redis
  networks:
    - crm_translations_network
```

Потім:
```bash
docker-compose -f docker-compose.production.yml up -d flower
```

Flower буде доступний на `http://your-server:5555`

---

## 📝 Чек-лист після деплою

- [ ] SQL індекси застосовані
- [ ] Backend перезапущений
- [ ] Celery worker працює
- [ ] Redis доступний
- [ ] Nginx перезавантажений
- [ ] Медіа файли завантажуються
- [ ] Inbox завантажується швидко
- [ ] Autobot налаштований (якщо потрібен)
- [ ] AI налаштування перевірені

---

**Дата:** 2026-02-04  
**Автор:** AI Assistant

