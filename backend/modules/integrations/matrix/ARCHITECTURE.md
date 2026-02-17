# Архітектура Matrix Bridge Integration

## Огляд

Модуль `app/integrations/matrix` (реалізовано як `modules/integrations/matrix`) додає підтримку WhatsApp через Matrix Bridge (mautrix-whatsapp) до існуючої екосистеми FastAPI.

## Ключові принципи

### 1. Switch Logic

В налаштуваннях (Settings/Config) є перемикач:
```python
WHATSAPP_MODE: Literal["classical", "matrix"]
```

Перемикач зберігається в `app_settings` таблиці як `whatsapp_mode` і використовується для вибору провайдера при відправці повідомлень.

### 2. Separate Module

Весь код для роботи з Matrix живе в `modules/integrations/matrix`. Жодної логіки Matrix в основних сервісах Inbox.

### 3. The Bridge

Сама реалізація Matrix-мосту — це зовнішній Go-бінарник (mautrix-whatsapp). Python-модуль виступає лише клієнтом через `matrix-nio.AsyncClient`.

### 4. Data Mapping

Всі сутності Matrix (Rooms, Events) автоматично мапяться на внутрішній стандарт Inbox Page через `MatrixMapper`:
- Matrix Rooms → Conversation external_id
- Matrix Events → Message content, type, attachments
- Matrix sender → Inbox sender info

Фронт не знає, звідки прийшло повідомлення — з "Classical" чи "Matrix".

### 5. Minimalism

Ніяких зайвих абстракцій. Тільки:
- FastAPI endpoints
- `nio.AsyncClient`
- Мапери даних

## Архітектурні обмеження

### BaseWhatsAppProvider Interface

Matrix-модуль реалізує спільний інтерфейс `BaseWhatsAppProvider`:

```python
class BaseWhatsAppProvider(ABC):
    @abstractmethod
    async def send_message(...) -> MessageModel
    @abstractmethod
    async def receive_message(...) -> MessageModel
    @abstractmethod
    async def get_or_create_conversation(...) -> Conversation
```

Реалізації:
- `WhatsAppService` (Classical) - через Meta Business API
- `MatrixWhatsAppService` (Matrix) - через Matrix Bridge

### Stateless Integration

Інтеграція stateless настільки, наскільки це дозволяє протокол Matrix. Використовується:
- Sync API для отримання нових повідомлень
- Webhook endpoint для подій від mautrix-whatsapp

### Налаштування

#### Системні налаштування (вводить адмін)

Зберігаються через `/settings/matrix-system-config`:
- `matrix_homeserver_url` - URL Matrix homeserver (https://matrix.your-server.com)
- `matrix_server_name` - Server name для формування user ID (your-server.com)
- `matrix_admin_login` - Логін головного адміна
- `matrix_admin_password` - Пароль головного адміна (TODO: зашифрувати)
- `matrix_bridge_admin_secret` - Токен з registration.yaml

**Автоматична генерація при збереженні:**
- `matrix_admin_access_token` - Отримується при логіні адміна, зберігається в БД
- `matrix_admin_device_id` - Генерується Matrix при логіні
- `matrix_admin_user_id` - Matrix user ID адміна

#### Налаштування користувачів (автоматично генерується)

Для кожного користувача CRM:
- `matrix_user_{user_id}_access_token` - Access token користувача
- `matrix_user_{user_id}_device_id` - Device ID користувача
- `matrix_user_{user_id}_matrix_id` - Matrix user ID (@username:server.com)
- `matrix_user_{user_id}_password` - Пароль для Matrix (генерується автоматично)

#### User Connection Flow

1. Користувач натискає "Підключити WhatsApp" в профілі
2. FastAPI автоматично:
   - Створює Matrix користувача (якщо немає) через admin API
   - Логінить користувача та отримує access token
   - Запитує QR-код у bridge через bridge bot
   - Повертає QR-код на фронт
3. Користувач сканує QR-код в WhatsApp
4. Bridge автоматично створює portal rooms для чатів

## Компоненти

### 1. BaseWhatsAppProvider (`base.py`)

Базовий інтерфейс для WhatsApp провайдерів. Визначає контракт для:
- Відправки повідомлень
- Отримання повідомлень
- Створення/отримання розмов

### 2. MatrixProvider (`provider.py`)

Клієнт для роботи з Matrix через `matrix-nio.AsyncClient`:
- Підключення до Matrix homeserver
- Sync для отримання нових повідомлень
- Відправка текстових та медіа-повідомлень
- Завантаження медіа на Matrix homeserver

### 3. MatrixWhatsAppService (`service.py`)

Сервіс, який реалізує `BaseWhatsAppProvider` та `MessengerService`:
- Інтеграція з існуючою архітектурою
- Використання `MatrixProvider` для комунікації з Matrix
- Мапінг через `MatrixMapper`

### 4. MatrixMapper (`mapper.py`)

Мапери для конвертації Matrix сутностей:
- `room_to_conversation_external_id()` - конвертація room_id
- `extract_phone_from_room()` - витягування номера телефону
- `event_to_message_content()` - конвертація event в content/type/attachments
- `event_to_sender_info()` - витягування інформації про відправника
- `event_to_metadata()` - створення метаданих

### 5. Router (`router.py`)

FastAPI endpoints:
- `GET /config` - отримати конфігурацію
- `POST /config` - оновити конфігурацію
- `GET /rooms` - список кімнат
- `GET /rooms/{room_id}/messages` - повідомлення з кімнати
- `POST /sync` - синхронізація
- `POST /webhook` - webhook для mautrix-whatsapp

## Інтеграція з існуючою системою

### Router Integration

В `modules/communications/router.py` при відправці повідомлення:

```python
elif conversation.platform == PlatformEnum.WHATSAPP:
    whatsapp_mode = crud.get_whatsapp_mode(db)
    
    if whatsapp_mode == "matrix":
        service = MatrixWhatsAppService(db)
    else:
        service = WhatsAppService(db)  # Classical
    
    message = await service.send_message(...)
```

### Settings Integration

В `routes.py` додано `whatsapp_mode` до WhatsApp config:
- `GET /settings/whatsapp-config` - повертає `whatsapp_mode`
- `POST /settings/whatsapp-config` - приймає `whatsapp_mode`

### CRUD Functions

В `crud.py` додано:
- `get_matrix_settings()` - отримати Matrix налаштування
- `get_whatsapp_mode()` - отримати WHATSAPP_MODE (за замовчуванням "classical")

## Потік даних

### Відправка повідомлення

1. Користувач відправляє повідомлення через `/api/v1/communications/conversations/{id}/messages`
2. Router перевіряє `WHATSAPP_MODE`
3. Якщо `"matrix"` → використовує `MatrixWhatsAppService`
4. `MatrixWhatsAppService` використовує `MatrixProvider` для відправки через Matrix
5. Повідомлення зберігається в БД з `source: "matrix_bridge"`

### Отримання повідомлення

1. **Через Sync API:**
   - Виклик `/api/v1/integrations/matrix/sync`
   - `MatrixProvider` отримує нові events
   - `MatrixMapper` конвертує events в внутрішній формат
   - `MatrixWhatsAppService` створює повідомлення в БД

2. **Через Webhook:**
   - mautrix-whatsapp надсилає події на `/api/v1/integrations/matrix/webhook`
   - Обробка аналогічна до Sync API

## Залежності

```bash
pip install matrix-nio
```

## Майбутні покращення

- [ ] Підтримка E2E encryption
- [ ] Автоматична синхронізація через background task
- [ ] Кешування Matrix rooms
- [ ] Retry logic для failed messages
- [ ] Metrics та monitoring

