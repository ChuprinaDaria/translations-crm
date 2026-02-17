# Matrix Bridge Integration для WhatsApp

Модуль для інтеграції WhatsApp через Matrix Bridge (mautrix-whatsapp).

## Архітектура

Модуль реалізує альтернативний шлях для роботи з WhatsApp через Matrix Bridge, окремо від "WhatsApp Classical" (Meta Business API).

### Структура модуля

```
matrix/
├── __init__.py          # Експорт основних класів
├── base.py              # BaseWhatsAppProvider інтерфейс
├── provider.py          # MatrixProvider (клієнт matrix-nio)
├── service.py          # MatrixWhatsAppService (реалізація BaseWhatsAppProvider)
├── mapper.py           # Мапери Matrix -> Inbox формат
├── schemas.py          # Pydantic моделі
├── router.py           # FastAPI endpoints
└── README.md           # Документація
```

## Компоненти

### BaseWhatsAppProvider

Базовий інтерфейс для WhatsApp провайдерів. Реалізується:
- `WhatsAppService` (Classical Meta API)
- `MatrixWhatsAppService` (Matrix Bridge)

### MatrixProvider

Клієнт для роботи з Matrix через `matrix-nio.AsyncClient`. Виступає як клієнт до mautrix-whatsapp bridge.

### MatrixWhatsAppService

Сервіс, який реалізує `BaseWhatsAppProvider` та `MessengerService`. Обробляє:
- Відправку повідомлень через Matrix
- Отримання повідомлень з Matrix
- Мапінг Matrix сутностей в внутрішній формат

### MatrixMapper

Мапери для конвертації:
- Matrix Rooms → Conversation external_id
- Matrix Events → Message content, type, attachments
- Matrix sender info → Inbox sender info

## Налаштування

### WHATSAPP_MODE

В налаштуваннях (Settings/Config) є перемикач:

```python
WHATSAPP_MODE: Literal["classical", "matrix"]
```

- `"classical"` - використовує Meta Business API (за замовчуванням)
- `"matrix"` - використовує Matrix Bridge

### Matrix Configuration

#### Системні налаштування (вводить адмін)

В адмінці Settings → Matrix Bridge System Config:
- **Homeserver URL** - `https://matrix.your-server.com` (куди FastAPI слатиме запити)
- **Server Name** - `your-server.com` (для формування user ID, наприклад: `@admin:your-server.com`)
- **Admin Login** - Логін головного адміна Matrix
- **Admin Password** - Пароль головного адміна (для автоматичного створення користувачів)
- **Bridge Admin Secret** - Токен з `registration.yaml` (для команд мосту)

**Автоматично генерується при збереженні:**
- Admin Access Token - отримується при логіні, зберігається в БД
- Admin Device ID - генерується Matrix
- Admin User ID - Matrix user ID адміна

#### Налаштування користувачів (автоматично)

Для кожного користувача CRM автоматично:
- Створюється Matrix користувач (якщо немає)
- Генерується пароль та access token
- Зберігається в БД під `matrix_user_{user_id}_*`

## API Endpoints

### Системні налаштування (тільки адмін)

#### GET `/api/v1/settings/matrix-system-config`

Отримати системні налаштування Matrix Bridge (без пароля).

#### POST `/api/v1/settings/matrix-system-config`

Оновити системні налаштування Matrix Bridge. Автоматично виконує логін адміна та зберігає access token.

### Користувацькі endpoints

#### POST `/api/v1/integrations/matrix/users/{user_id}/connect-whatsapp`

Підключити WhatsApp для користувача. Генерує QR-код для сканування.

**Магія:**
1. Створює Matrix користувача (якщо немає)
2. Логінить користувача
3. Запитує QR-код у bridge
4. Повертає QR-код на фронт

### Legacy endpoints (для сумісності)

#### GET `/api/v1/integrations/matrix/config`

Отримати конфігурацію Matrix Bridge.

#### POST `/api/v1/integrations/matrix/config`

Оновити конфігурацію Matrix Bridge.

### GET `/api/v1/integrations/matrix/rooms`

Отримати список Matrix кімнат (WhatsApp чатів).

### GET `/api/v1/integrations/matrix/rooms/{room_id}/messages`

Отримати повідомлення з Matrix кімнати.

### POST `/api/v1/integrations/matrix/sync`

Синхронізувати стан з Matrix homeserver.

### POST `/api/v1/integrations/matrix/webhook`

Webhook endpoint для отримання подій від mautrix-whatsapp.

## Використання

### Відправка повідомлень

При відправці повідомлення через `/api/v1/communications/conversations/{id}/messages`, система автоматично вибирає провайдера на основі `WHATSAPP_MODE`:

```python
# В router.py
whatsapp_mode = crud.get_whatsapp_mode(db)

if whatsapp_mode == "matrix":
    service = MatrixWhatsAppService(db)
else:
    service = WhatsAppService(db)  # Classical
```

### Отримання повідомлень

Повідомлення можуть надходити через:
1. **Sync API** - періодична синхронізація через `/api/v1/integrations/matrix/sync`
2. **Webhook** - події від mautrix-whatsapp через `/api/v1/integrations/matrix/webhook`

## Залежності

```bash
pip install matrix-nio
```

## Налаштування mautrix-whatsapp Bridge

Перед використанням Matrix Bridge необхідно встановити та налаштувати mautrix-whatsapp bridge.

### Вимоги

- Matrix homeserver (наприклад, Synapse) з підтримкою application services
- PostgreSQL v16+ (якщо використовується Synapse)
- WhatsApp клієнт на телефоні (фізичному або віртуальному)
- ffmpeg (для відправки gif з Matrix)

### Встановлення

#### Варіант 1: Завантажити готовий бінарник

1. Завантажте бінарник для вашої архітектури:
   - Linux amd64: https://mau.dev/mautrix/whatsapp/-/jobs/artifacts/main/download?job=build%20amd64
   - Linux arm64: https://mau.dev/mautrix/whatsapp/-/jobs/artifacts/main/download?job=build%20arm64
   - Linux arm: https://mau.dev/mautrix/whatsapp/-/jobs/artifacts/main/download?job=build%20arm
   - Або знайдіть на https://mau.dev/mautrix/whatsapp/-/pipelines

2. Розпакуйте архів у нову директорію

#### Варіант 2: Збірка з вихідного коду

```bash
git clone https://github.com/mautrix/whatsapp.git mautrix-whatsapp
cd mautrix-whatsapp
./build.sh
```

### Конфігурація

1. Згенеруйте приклад конфігурації:
   ```bash
   ./mautrix-whatsapp -e
   ```
   Це створить файл `config.yaml`

2. Оновіть конфігурацію:
   - Вкажіть URL вашого Matrix homeserver
   - Налаштуйте підключення до PostgreSQL
   - Налаштуйте інші параметри за потреби

3. Згенеруйте файл реєстрації appservice:
   ```bash
   ./mautrix-whatsapp -g
   ```
   Це створить файл `registration.yaml`

4. Зареєструйте bridge на homeserver:
   - Додайте `registration.yaml` до конфігурації homeserver
   - Перезапустіть homeserver

5. Запустіть bridge:
   ```bash
   ./mautrix-whatsapp
   ```

### Аутентифікація та отримання Access Token

#### Крок 1: Підключення до bridge bot

1. Відкрийте Matrix клієнт (Element, FluffyChat тощо)
2. Підключіться до вашого homeserver
3. Створіть приватний чат з bridge bot (зазвичай `@whatsappbot:your.server`)
   - Якщо bot не приймає запрошення, перевірте налаштування bridge та homeserver

#### Крок 2: Авторизація через WhatsApp

**Варіант A: Через QR-код (рекомендовано)**

1. Відправте команду `login qr` в чат з bridge bot
2. Bridge надішле QR-код
3. Відкрийте WhatsApp на телефоні
4. Перейдіть в **Menu** → **Settings** → **Linked devices**
5. Натисніть **Link a device**
6. Відскануйте QR-код, надісланий bridge bot
7. Після успішної авторизації, bot повідомить про успішний вхід

**Варіант B: Через 8-значний код**

1. Відправте команду `login phone` в чат з bridge bot
2. Введіть номер телефону, коли bot попросить
3. Bridge надішле 8-значний код
4. Відкрийте WhatsApp на телефоні
5. Перейдіть в **Menu** → **Settings** → **Linked devices**
6. Натисніть **Link with a phone number instead**
7. Введіть 8-значний код
8. Після успішної авторизації, bot повідомить про успішний вхід

#### Крок 3: Отримання Access Token

Після успішної авторизації, вам потрібен Access Token для вашого Matrix користувача (не для bridge bot).

**Через Matrix API:**

```bash
curl -X POST https://your-homeserver.com/_matrix/client/r0/login \
  -H "Content-Type: application/json" \
  -d '{
    "type": "m.login.password",
    "user": "@your-user:your-homeserver.com",
    "password": "your-password"
  }'
```

Відповідь міститиме `access_token`, який потрібно використати в налаштуваннях CRM.

**Через Matrix клієнт:**

1. Відкрийте налаштування клієнта
2. Знайдіть розділ "Advanced" або "Developer"
3. Скопіюйте Access Token (зазвичай починається з `syt_`)

#### Крок 4: Створення portal rooms

Приблизно через хвилину після входу, bridge почне створювати portal rooms для всіх WhatsApp чатів. Кількість повідомлень для backfill можна налаштувати в конфігурації bridge (за замовчуванням 50 повідомлень для недавніх чатів).

#### Важливі примітки

⚠️ **Обмеження WhatsApp Web API:**
- Якщо телефон буде офлайн більше 2 тижнів, linked devices будуть відключені
- Bridge попереджає, якщо не отримує дані від телефону більше 12 днів
- Детальніше: https://faq.whatsapp.com/general/download-and-installation/about-linked-devices

⚠️ **Ризик блокування акаунту:**
- WhatsApp може заблокувати акаунти, які виглядають підозріло
- Використання bridge сам по собі не повинно викликати блокування
- Ризик збільшується при комбінації з:
  - Запуском WhatsApp в Android емуляторі
  - Використанням VoIP номерів
  - Використанням новоствореного акаунту
  - Ініціюванням DM до неконтактів
  - Іншою підозрілою активністю

#### Вихід з системи

Для виходу з bridge, відправте команду `logout` в чат з bridge bot.

### Налаштування в CRM

1. Перейдіть в Settings → Matrix Bridge
2. Введіть:
   - **Homeserver URL**: URL вашого Matrix homeserver (наприклад: `https://matrix.example.com`)
   - **Access Token**: Token, отриманий після авторизації
   - **User ID** (опціонально): Ваш Matrix User ID (наприклад: `@user:matrix.example.com`)
   - **Device ID** (опціонально): Device ID (автоматично визначається)
3. Збережіть налаштування
4. Перейдіть в Settings → WhatsApp та встановіть `whatsapp_mode` в `"matrix"`

### systemd Service (опціонально)

Для автоматичного запуску bridge при завантаженні системи:

1. Створіть користувача:
   ```bash
   sudo adduser --system mautrix-whatsapp --home /opt/mautrix-whatsapp
   ```

2. Створіть service файл `/etc/systemd/system/mautrix-whatsapp.service`:
   ```ini
   [Unit]
   Description=mautrix-whatsapp bridge

   [Service]
   Type=exec
   User=mautrix-whatsapp
   WorkingDirectory=/opt/mautrix-whatsapp
   ExecStart=/opt/mautrix-whatsapp/mautrix-whatsapp
   Restart=on-failure
   RestartSec=30s

   [Install]
   WantedBy=multi-user.target
   ```

3. Запустіть service:
   ```bash
   sudo systemctl enable mautrix-whatsapp
   sudo systemctl start mautrix-whatsapp
   ```

## Статус

Модуль реалізує базовий функціонал:
- ✅ Підключення до Matrix через matrix-nio
- ✅ Відправка текстових повідомлень
- ✅ Відправка медіа-повідомлень
- ✅ Отримання повідомлень через sync
- ✅ Мапінг Matrix сутностей в Inbox формат
- ✅ Webhook endpoint для mautrix-whatsapp
- ✅ WHATSAPP_MODE перемикач

## Примітки

- Matrix Access Token зберігається в `app_settings` під поточним користувачем
- Всі Matrix сутності автоматично мапяться на внутрішній стандарт Inbox Page
- Фронт не знає, звідки прийшло повідомлення - з "Classical" чи "Matrix"
- Модуль stateless настільки, наскільки це дозволяє протокол Matrix

## Корисні посилання

- [mautrix-whatsapp документація](https://docs.mau.fi/bridges/go/whatsapp/index.html)
- [Matrix room для допомоги](https://matrix.to/#/#whatsapp:maunium.net)
- [GitHub репозиторій](https://github.com/mautrix/whatsapp)

