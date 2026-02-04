# InPost Integration Guide

## Огляд

Повна інтеграція з InPost API для автоматичного створення та відстеження відправлень. Модуль підтримує:

- ✅ Створення відправлень (пачкомати та кур'єр)
- ✅ Відстеження в реальному часі через webhook
- ✅ Пошук пачкоматів
- ✅ Генерація етикеток
- ✅ Історія статусів
- ✅ Sandbox режим для тестування

## Структура модуля

```
backend/modules/postal_services/
├── __init__.py           # Ініціалізація модуля
├── models.py             # SQLAlchemy моделі (InPostShipment, InPostSettings)
├── schemas.py            # Pydantic схеми для API
├── service.py            # InPostService - бізнес-логіка та API клієнт
└── router.py             # FastAPI endpoints
```

## Моделі бази даних

### InPostSettings
Налаштування InPost API:
- `api_key` - Production API ключ (Organization token)
- `sandbox_mode` - Використовувати sandbox для тестування
- `sandbox_api_key` - Sandbox API ключ
- `webhook_url` - URL для webhook оновлень
- `webhook_secret` - Секретний ключ для перевірки webhook
- `default_sender_*` - Інформація про відправника за замовчуванням
- `is_enabled` - Увімкнути/вимкнути інтеграцію

### InPostShipment
Відправлення InPost:
- `order_id` - Зв'язок з замовленням CRM
- `shipment_id` - ID відправлення в InPost
- `tracking_number` - Номер для відстеження
- `delivery_type` - Тип доставки (parcel_locker, courier, pop)
- `parcel_locker_code` - Код пачкомату (напр. KRA010)
- `courier_address` - Адреса для кур'єрської доставки
- `receiver_*` - Інформація про одержувача
- `sender_*` - Інформація про відправника
- `package_size` - Розмір посилки (small, medium, large)
- `status` - Статус відправлення
- `status_history` - Історія змін статусу (JSONB)
- `tracking_url` - Публічний URL для відстеження
- `label_url` - URL для завантаження етикетки
- `cost` - Вартість доставки

## API Endpoints

### Відправлення

#### POST `/api/v1/postal-services/inpost/shipments`
Створити нове відправлення.

**Request:**
```json
{
  "order_id": "uuid",
  "delivery_type": "parcel_locker",
  "parcel_locker_code": "KRA010",
  "receiver": {
    "email": "customer@example.com",
    "phone": "+48123456789",
    "name": "Jan Kowalski"
  },
  "package_size": "small",
  "package_weight": 1.5,
  "insurance_amount": 100.00,
  "cod_amount": 50.00
}
```

**Response:**
```json
{
  "id": "uuid",
  "shipment_id": "inpost_id",
  "tracking_number": "123456789",
  "tracking_url": "https://inpost.pl/sledzenie-przesylek?number=123456789",
  "label_url": "https://...",
  "status": "confirmed",
  "created_at": "2026-02-04T10:00:00Z"
}
```

#### GET `/api/v1/postal-services/inpost/shipments/{shipment_id}`
Отримати інформацію про відправлення.

#### GET `/api/v1/postal-services/inpost/shipments/by-order/{order_id}`
Отримати відправлення по ID замовлення.

#### POST `/api/v1/postal-services/inpost/shipments/{shipment_id}/refresh`
Оновити статус відправлення з InPost API.

#### DELETE `/api/v1/postal-services/inpost/shipments/{shipment_id}`
Скасувати відправлення.

### Відстеження

#### GET `/api/v1/postal-services/inpost/tracking/{tracking_number}`
Отримати інформацію про відстеження.

**Response:**
```json
{
  "tracking_number": "123456789",
  "tracking_url": "https://inpost.pl/sledzenie-przesylek?number=123456789",
  "status": "out_for_delivery",
  "status_description": "Przesyłka w drodze do paczkomatu",
  "last_update": "2026-02-04T12:00:00Z",
  "events": [
    {
      "status": "confirmed",
      "description": "Nadano",
      "timestamp": "2026-02-04T10:00:00Z",
      "location": "Kraków"
    }
  ]
}
```

### Пошук пачкоматів

#### GET `/api/v1/postal-services/inpost/parcel-lockers`
Знайти найближчі пачкомати.

**Query Parameters:**
- `city` - Назва міста
- `post_code` - Поштовий індекс (формат: 00-000)
- `latitude` & `longitude` - Координати
- `radius` - Радіус пошуку в метрах (за замовчуванням: 5000)

**Response:**
```json
[
  {
    "name": "KRA010",
    "address": {
      "street": "ul. Krakowska",
      "building_number": "10",
      "city": "Kraków",
      "post_code": "30-001"
    },
    "location": {
      "latitude": 50.0647,
      "longitude": 19.9450
    },
    "opening_hours": "24/7",
    "functions": ["parcel_send", "parcel_collect"],
    "payment_available": true
  }
]
```

### Налаштування

#### GET `/api/v1/postal-services/inpost/settings`
Отримати налаштування InPost.

#### PUT `/api/v1/postal-services/inpost/settings`
Оновити налаштування InPost.

**Request:**
```json
{
  "api_key": "your_api_key",
  "sandbox_mode": false,
  "webhook_url": "https://your-domain.com/api/v1/postal-services/inpost/webhook",
  "webhook_secret": "secret",
  "default_sender_email": "sender@company.com",
  "default_sender_phone": "+48123456789",
  "default_sender_name": "Company Name",
  "is_enabled": true
}
```

### Webhook

#### POST `/api/v1/postal-services/inpost/webhook`
Webhook для отримання оновлень статусу від InPost (не потребує авторизації).

**Headers:**
- `X-Webhook-Secret` - Секретний ключ для перевірки

**Request:**
```json
{
  "event": "status.updated",
  "data": {
    "id": "shipment_id",
    "tracking_number": "123456789",
    "status": "delivered",
    "status_description": "Odebrano z paczkomatu"
  }
}
```

## Налаштування

### 1. Отримання API ключа

1. Зареєструйтеся в InPost: https://inpost.pl/
2. Створіть Organization
3. Перейдіть в API Settings
4. Згенеруйте Organization Token (API Key)

### 2. Налаштування в CRM

1. Відкрийте **Налаштування → InPost**
2. Введіть **API Key**
3. Налаштуйте **Webhook** (опціонально):
   - URL: `https://your-domain.com/api/v1/postal-services/inpost/webhook`
   - Secret: згенеруйте випадковий ключ
4. Заповніть **Відправника за замовчуванням**:
   - Ім'я/назва компанії
   - Email
   - Телефон
5. Увімкніть інтеграцію
6. Збережіть

### 3. Налаштування Webhook в InPost

1. Перейдіть в InPost Organization панель
2. API Settings → Webhooks
3. Додайте новий webhook:
   - URL: `https://your-domain.com/api/v1/postal-services/inpost/webhook`
   - Secret: той самий, що в CRM
   - Events: виберіть всі події статусів

### 4. Тестування (Sandbox)

1. Увімкніть "Sandbox режим"
2. Введіть Sandbox API Key
3. Використовуйте тестові дані з InPost документації

## Використання

### Створення відправлення для замовлення

```python
from modules.postal_services.service import InPostService
from modules.postal_services.schemas import CreateShipmentRequest, ReceiverInfo, PackageSize, DeliveryType

service = InPostService(db)

# Відправлення в пачкомат
request = CreateShipmentRequest(
    order_id=order.id,
    delivery_type=DeliveryType.PARCEL_LOCKER,
    parcel_locker_code="KRA010",
    receiver=ReceiverInfo(
        email="customer@example.com",
        phone="+48123456789",
        name="Jan Kowalski"
    ),
    package_size=PackageSize.SMALL,
    package_weight=1.5
)

shipment = await service.create_shipment(request)
print(f"Tracking URL: {shipment.tracking_url}")
```

### Відстеження статусу

```python
# Оновити статус з InPost API
shipment = await service.update_shipment_status(shipment_id)

# Перевірити історію статусів
for event in shipment.status_history:
    print(f"{event['timestamp']}: {event['status']} - {event['description']}")
```

### Пошук пачкоматів

```python
# По місту
lockers = await service.search_parcel_lockers(city="Kraków")

# По координатам
lockers = await service.search_parcel_lockers(
    latitude=50.0647,
    longitude=19.9450,
    radius=2000  # 2 км
)

for locker in lockers:
    print(f"{locker.name}: {locker.address}")
```

## Статуси відправлень

| Статус | Опис |
|--------|------|
| `created` | Створено в системі |
| `confirmed` | Підтверджено в InPost |
| `dispatched_by_sender` | Відправлено відправником |
| `collected_from_sender` | Забрано від відправника |
| `taken_by_courier` | Взято кур'єром |
| `adopted_at_source_branch` | Прийнято на відділенні |
| `sent_from_source_branch` | Відправлено з відділення |
| `ready_to_pickup` | Готово до отримання |
| `out_for_delivery` | Доставляється |
| `delivered` | Доставлено |
| `pickup_reminder_sent` | Надіслано нагадування |
| `returned_to_sender` | Повернено відправнику |
| `avizo` | Не вдалося доставити |
| `canceled` | Скасовано |
| `error` | Помилка |

## Розміри посилок

| Розмір | Габарити | Макс. вага |
|--------|----------|------------|
| `small` | Gabaryt A: 8 x 38 x 64 cm | 25 kg |
| `medium` | Gabaryt B: 19 x 38 x 64 cm | 25 kg |
| `large` | Gabaryt C: 41 x 38 x 64 cm | 25 kg |

## Webhook Events

InPost відправляє webhook події при зміні статусу:

- `status.updated` - Зміна статусу відправлення
- `shipment.updated` - Оновлення інформації про відправлення

Події автоматично оброблюються і оновлюють статус в базі даних.

## Безпека

1. **API Key**: Зберігається в базі даних, маскується в API відповідях
2. **Webhook Secret**: Перевіряється при отриманні webhook подій
3. **HTTPS**: Webhook URL повинен використовувати HTTPS
4. **Authorization**: Всі endpoints (крім webhook) потребують авторизації

## Помилки та їх вирішення

### "InPost API key is not configured"
- Перевірте, чи введений API ключ в налаштуваннях
- Перевірте, чи увімкнена інтеграція

### "Shipment not yet created in InPost"
- Відправлення створено локально, але не підтверджено в InPost
- Перевірте логи на наявність помилок API

### "Failed to create shipment"
- Перевірте правильність даних (код пачкомату, адреса)
- Перевірте баланс рахунку в InPost
- Перевірте ліміти API

### Webhook не працює
- Перевірте, чи доступний URL ззовні
- Перевірте webhook secret
- Перевірте логи на наявність помилок авторизації

## Міграція бази даних

Для застосування змін в базі даних виконайте:

```bash
# Застосувати міграцію
psql -U your_user -d your_database -f database/migrations/create_inpost_tables.sql

# Або через Python скрипт
python backend/run_migration.py database/migrations/create_inpost_tables.sql
```

## API Reference Links

- InPost API Documentation: https://documentation-points-api.easypack24.net/
- InPost ShipX API: https://api-shipx-pl.easypack24.net/v1/
- InPost Sandbox: https://sandbox-api-shipx-pl.easypack24.net/v1/

## Підтримка

Для питань та підтримки:
- InPost Support: https://inpost.pl/pomoc
- API Support: api@inpost.pl

