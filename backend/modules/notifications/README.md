# Система нотифікацій

Повнофункціональна система нотифікацій для CRM з підтримкою WebSocket, різних типів нотифікацій та налаштувань користувачів.

## Структура модуля

```
modules/notifications/
├── __init__.py
├── models.py              # SQLAlchemy моделі
├── schemas.py             # Pydantic schemas
├── router.py              # API endpoints + WebSocket
├── service.py             # Бізнес-логіка
├── websocket_manager.py   # WebSocket connection manager
├── helpers.py             # Helper functions для створення нотифікацій
└── README.md
```

## Типи нотифікацій

1. **new_message** - Нове повідомлення від клієнта
2. **payment_received** - Отримана оплата
3. **translator_accepted** - Перекладач прийняв замовлення
4. **translator_rejected** - Перекладач відхилив замовлення
5. **translation_ready** - Переклад готовий
6. **internal_note** - Додана internal note
7. **deadline_warning** - Дедлайн наближається
8. **deadline_passed** - Дедлайн прострочений

## Використання

### Створення нотифікації з інших модулів

```python
from modules.notifications.helpers import notify_payment_received

# При отриманні оплати
await notify_payment_received(
    db=db,
    user_id=user.id,
    order_number="#N/01/02/01/26/dnk",
    client_name="Іван Kowalski",
    amount=100,
    currency="zł",
    payment_method="Przelew24",
    order_id=str(order.id),
)
```

### API Endpoints

- `GET /api/v1/notifications/` - Отримати нотифікації
- `GET /api/v1/notifications/unread/count` - Кількість непрочитаних
- `POST /api/v1/notifications/{id}/read` - Позначити як прочитану
- `POST /api/v1/notifications/read-all` - Позначити всі як прочитані
- `GET /api/v1/notifications/settings` - Отримати налаштування
- `PUT /api/v1/notifications/settings` - Оновити налаштування
- `WS /api/v1/notifications/ws/{user_id}` - WebSocket endpoint

## Frontend

### Використання в компонентах

```typescript
import { useNotifications } from '@/modules/notifications';

function MyComponent() {
  const { notifications, unreadCount, markAsRead } = useNotifications({
    enabled: true,
    showToasts: true,
  });

  // ...
}
```

### NotificationCenter

Компонент автоматично додається в Header. Відображає:
- Лічильник непрочитаних нотифікацій
- Список нотифікацій
- Можливість позначити всі як прочитані

### NotificationSettings

Компонент для налаштування:
- Увімкнути/вимкнути нотифікації
- Звук, desktop notifications, вібрація
- Типи нотифікацій
- Do Not Disturb режим

## WebSocket

WebSocket автоматично підключається при використанні `useNotifications` hook. Підтримує:
- Автоматичне переподключення
- Ping/pong для підтримки з'єднання
- Відправку нотифікацій в реальному часі

## Налаштування користувача

Кожен користувач може налаштувати:
- Увімкнути/вимкнути нотифікації
- Типи нотифікацій (окремо для кожного типу)
- Do Not Disturb (будні дні та вихідні)
- Звук, desktop notifications, вібрація

## База даних

### Notification
- `id` - UUID
- `user_id` - Користувач
- `type` - Тип нотифікації
- `title`, `message` - Текст
- `entity_type`, `entity_id` - Прив'язка до сутності
- `is_read`, `read_at` - Статус прочитання
- `action_url` - URL для переходу
- `expires_at` - Автовидалення через 30 днів

### NotificationSettings
- `user_id` - Користувач
- `enabled` - Увімкнути/вимкнути
- `sound`, `desktop`, `vibration` - Налаштування
- `types_enabled` - JSON з типами
- `do_not_disturb` - JSON з налаштуваннями DND

