# Асинхронність та Безпека

## 🚀 Асинхронні задачі (Arq)

### Налаштування

1. **Redis** (обов'язково для Arq):
   ```bash
   docker run -d -p 6379:6379 redis:alpine
   ```

2. **Змінні оточення**:
   ```env
   REDIS_URL=redis://localhost:6379/0
   TASK_MAX_JOBS=10
   TASK_TIMEOUT=300
   ```

3. **Запуск worker**:
   ```bash
   arq app.tasks.email_tasks.WorkerSettings
   ```

### Використання

#### Відправка email асинхронно:
```python
from arq import create_pool
from arq.connections import RedisSettings
from tasks.email_tasks import send_email_task

# Створити пул
pool = await create_pool(RedisSettings.from_dsn("redis://localhost:6379/0"))

# Відправити задачу
job = await pool.enqueue_job("send_email_task", to="user@example.com", subject="Test", body="Hello")
```

#### Відправка КП по email:
```python
from tasks.email_tasks import send_kp_email_task

job = await pool.enqueue_job("send_kp_email_task", kp_id=123, recipient_email="client@example.com")
```

### Переваги

✅ **Не блокує інтерфейс** - відправка пошти не чекає завершення  
✅ **Retry механізм** - Arq автоматично повторює невдалі задачі  
✅ **Моніторинг** - можна відстежувати статус задач  
✅ **Масштабування** - можна запускати кілька workers

## 📱 Meta API - Абстракція провайдерів

### Структура

```
modules/communications/providers/
├── base.py          # Базовий інтерфейс (BaseProvider)
├── meta.py          # Meta API провайдер
├── twilio.py        # Twilio провайдер
└── factory.py       # Фабрика для створення провайдерів
```

### Використання

#### Створення провайдера:
```python
from modules.communications.providers.factory import ProviderFactory

# Meta провайдер
config = {
    "access_token": "YOUR_ACCESS_TOKEN",
    "app_secret": "YOUR_APP_SECRET",
    "verify_token": "YOUR_VERIFY_TOKEN",
    "phone_number_id": "YOUR_PHONE_NUMBER_ID",  # Для WhatsApp
}
provider = ProviderFactory.create_provider("meta", config)

# Twilio провайдер
config = {
    "account_sid": "YOUR_ACCOUNT_SID",
    "auth_token": "YOUR_AUTH_TOKEN",
    "whatsapp_from": "whatsapp:+1234567890",
}
provider = ProviderFactory.create_provider("twilio", config)
```

#### Відправка повідомлення:
```python
from modules.communications.providers.base import Message

message = Message(
    recipient_id="+380123456789",
    text="Hello from CRM!"
)

result = await provider.send_message(message)
if result.success:
    print(f"Message sent: {result.message_id}")
```

#### Підміна провайдера:
```python
# Легко переключитися між провайдерами
provider = ProviderFactory.create_provider("meta", config)  # або "twilio"
```

### Додавання нового провайдера:

1. Створити клас що наслідує `BaseProvider`:
```python
from .base import BaseProvider, Message, ProviderResponse

class NewProvider(BaseProvider):
    async def send_message(self, message: Message) -> ProviderResponse:
        # Реалізація
        pass
    
    async def verify_webhook(self, signature: str, payload: bytes) -> bool:
        # Реалізація
        pass
    
    # ... інші методи
```

2. Зареєструвати в фабриці:
```python
ProviderFactory.register_provider("new_provider", NewProvider)
```

## 🔐 Scope-Based RBAC

### Scopes

Scopes визначають що саме може робити користувач:

```python
class Scope(str, Enum):
    # CRM
    CRM_VIEW_ALL = "crm:view:all"      # Перегляд всіх клієнтів
    CRM_VIEW_OWN = "crm:view:own"      # Перегляд тільки своїх
    CRM_EDIT_ALL = "crm:edit:all"      # Редагування всіх
    CRM_EDIT_OWN = "crm:edit:own"      # Редагування тільки своїх
    
    # Finance
    FINANCE_VIEW_REVENUE = "finance:view:revenue"  # Виручка
    FINANCE_VIEW_PROFIT = "finance:view:profit"     # Прибуток (тільки адмін/бухгалтер)
    FINANCE_VIEW_COSTS = "finance:view:costs"      # Витрати
    FINANCE_EDIT = "finance:edit"                  # Редагування
    
    # Analytics
    ANALYTICS_VIEW_ALL = "analytics:view:all"
    ANALYTICS_VIEW_OWN = "analytics:view:own"
    
    # Admin
    ADMIN_ALL = "admin:all"  # Повний доступ
```

### Ролі та їх scopes

```python
ROLE_SCOPES = {
    "admin": [
        Scope.ADMIN_ALL,
        Scope.FINANCE_VIEW_PROFIT,  # Адмін бачить прибуток
        # ... всі інші
    ],
    "manager": [
        Scope.FINANCE_VIEW_REVENUE,  # Менеджер бачить виручку
        # НЕ бачить FINANCE_VIEW_PROFIT ❌
    ],
    "sales-manager": [
        Scope.CRM_VIEW_OWN,  # Тільки свої клієнти
        Scope.FINANCE_VIEW_REVENUE,  # Тільки своя виручка
    ],
    "accountant": [
        Scope.FINANCE_VIEW_PROFIT,  # Бухгалтер бачить прибуток ✅
        Scope.FINANCE_VIEW_COSTS,
    ],
}
```

### Використання в endpoints

#### Захист endpoint scope:
```python
from core.rbac import require_scope, Scope

@router.get("/finance/profit")
def get_profit(
    user: User = Depends(require_scope(Scope.FINANCE_VIEW_PROFIT))
):
    """
    Менеджер отримає 403 Forbidden.
    Бухгалтер та адмін - успішно.
    """
    return {"profit": 1000000}
```

#### Фільтрація даних:
```python
from core.rbac import filter_by_scope, get_user_scopes

@router.get("/crm/clients")
def get_clients(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_db),
):
    query = db.query(Client)
    
    # Автоматично фільтрує на основі scope
    query = filter_by_scope(query, Client, user, owner_field="created_by_id")
    
    return query.all()
```

#### Перевірка scope в коді:
```python
from core.rbac import check_scope, Scope

if check_scope(user, Scope.FINANCE_VIEW_PROFIT):
    # Показати прибуток
    profit = calculate_profit()
else:
    # Показати тільки виручку
    revenue = calculate_revenue()
```

### Приклад: Менеджер vs Бухгалтер

```python
# Менеджер
GET /finance/revenue  ✅ 200 OK
GET /finance/profit   ❌ 403 Forbidden

# Бухгалтер
GET /finance/revenue  ✅ 200 OK
GET /finance/profit   ✅ 200 OK
GET /finance/costs    ✅ 200 OK
```

## 📋 Checklist для безпеки

- [x] Scope-based RBAC реалізовано
- [x] Менеджер не бачить прибуток
- [x] Бухгалтер бачить прибуток
- [x] Асинхронні задачі для SMTP
- [x] Абстракція для Meta API
- [x] Підтримка Twilio як альтернативи
- [ ] Webhook верифікація для Meta
- [ ] Rate limiting для API
- [ ] Audit log для фінансових операцій

