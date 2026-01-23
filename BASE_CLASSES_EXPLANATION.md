# Пояснення: Звідки береться `from core.db import Base`

## Структура Base класів в проєкті

У проєкті є **ДВА різні Base класи** для роботи з базою даних:

### 1. `db.Base` (Sync - синхронний)
**Файл:** `backend/db.py`
```python
from sqlalchemy.orm import declarative_base
Base = declarative_base()
```
- Використовується для **старого коду** (legacy)
- Синхронний engine
- Використовується в `backend/models.py` (старі моделі)

### 2. `core.db.Base` (Async - асинхронний) ⭐
**Файл:** `backend/core/db.py`
```python
from sqlalchemy.orm import DeclarativeBase
class Base(DeclarativeBase):
    pass
```
- Використовується для **нового коду** (модулі)
- Асинхронний engine (`create_async_engine`)
- Використовується в усіх модулях:
  - `modules/crm/models.py` ✅
  - `modules/notifications/models.py` ✅
  - `modules/auth/models.py` ✅
  - `modules/finance/models.py` ✅
  - `modules/communications/models.py` ✅

## Чому `modules/crm/models.py` використовує `from core.db import Base`?

Це **правильний імпорт** для нових модулів, тому що:

1. ✅ Всі нові модулі використовують **async/await** синтаксис
2. ✅ `core.db.Base` працює з **async engine** (`postgresql+asyncpg://`)
3. ✅ Це дозволяє використовувати `AsyncSession` для запитів
4. ✅ Краща продуктивність для паралельних запитів

## Проблема, яку ми виправили

**Проблема:** `main.py` створював таблиці використовуючи тільки sync `Base` з `db.py`, тому таблиці для async моделей (як `notification_settings`) не створювалися.

**Рішення:** Оновлено `main.py` - тепер він автоматично створює таблиці для обох Base класів:
- Sync таблиці через `db.Base.metadata.create_all()`
- Async таблиці через SQL запити в `lifespan()` функції

## Як перевірити

Після перезапуску backend, перевірте логи:
```
Creating notification_settings table...
✓ Table 'notification_settings' created
```

Або перевірте в базі:
```sql
SELECT * FROM notification_settings LIMIT 1;
```

## Висновок

`from core.db import Base` в `modules/crm/models.py` - це **правильний імпорт** для async моделей. Це стандартний підхід для сучасних FastAPI додатків з async/await.

