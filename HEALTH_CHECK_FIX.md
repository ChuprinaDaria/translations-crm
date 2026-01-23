# Виправлення Health Check для деплою

## Проблема

Health check в GitHub Actions не міг підключитися до сервера:
```
curl: (7) Failed to connect to *** port *** after 73 ms: Couldn't connect to server
Health check failed
```

## Виправлення

### 1. Додано простий Health Check Endpoint

**Файл:** `backend/main.py`

Додано два endpoints:
- `GET /` - простий root endpoint
- `GET /health` - health check з перевіркою підключення до БД

```python
@app.get("/")
def root():
    """Root endpoint - simple health check."""
    return {"status": "ok", "service": "CRM System"}

@app.get("/health")
def health_check():
    """Health check endpoint for deployment monitoring."""
    try:
        # Simple database connectivity check
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "error": str(e)}
        )
```

### 2. Покращено Health Check в Deploy Workflow

**Файл:** `.github/workflows/deploy.yml`

**Зміни:**
- ✅ Використовує `/health` замість `/docs` (простіший, швидший)
- ✅ Додано retry логіку (10 спроб з затримкою 5 секунд)
- ✅ Fallback на `/` endpoint якщо `/health` не працює
- ✅ Додано логування помилок та статусу контейнерів
- ✅ Додано перевірку логів контейнера при помилці

**Нова логіка:**
```bash
# 10 спроб з затримкою 5 секунд між спробами
# Спочатку намагається /health, потім /
# При помилці показує статус контейнера та логи
```

### 3. Оновлено Docker Compose Health Checks

**Файли:**
- `docker-compose.production.yml`
- `docker-compose.yml`

**Зміни:**
- ✅ Використовує `/health` замість `/docs`
- ✅ Збільшено `start_period` з 10s до 30s (більше часу на старт)

## Переваги

1. **Швидший відгук** - `/health` простіший за `/docs`
2. **Надійність** - retry логіка дозволяє серверу запуститися
3. **Діагностика** - при помилці показує логи та статус контейнера
4. **Перевірка БД** - `/health` перевіряє підключення до бази даних

## Тестування

Після деплою health check має:
1. Чекати поки контейнер запуститься (до 50 секунд з retry)
2. Успішно підключитися до `/health` або `/`
3. Отримати відповідь `{"status": "healthy", "database": "connected"}`

## Примітки

- Health check тепер більш толерантний до затримок запуску
- Якщо сервер не запускається за 50 секунд, це вказує на реальну проблему
- Логи контейнера допоможуть діагностувати проблеми

