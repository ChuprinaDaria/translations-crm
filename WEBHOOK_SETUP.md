# Налаштування Webhook для WhatsApp, Instagram, Facebook

## Проблема: "Проверка URL обратного вызова или маркера подтверждения не пройдена"

Ця помилка виникає, коли `verify_token` в Meta Developer Console не збігається з `verify_token` в налаштуваннях вашого додатку.

## Рішення

### 1. WhatsApp Webhook

#### Крок 1: Збережіть Verify Token в налаштуваннях додатку

1. Відкрийте ваш додаток: `https://tlumaczeniamt.com.pl`
2. Перейдіть в **Settings** → **WhatsApp**
3. В полі **"Verify Token"** введіть той самий токен, який ви вказали в Meta:
   ```
   DashaSuperDev2026
   ```
4. Натисніть **"Зберегти"**

#### Крок 2: Налаштуйте Webhook в Meta Developer Console

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **WhatsApp** → **Configuration** → **Webhooks**
4. Натисніть **"Edit"** або **"Add Webhook"**
5. Введіть:
   - **Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/whatsapp`
   - **Verify Token**: `DashaSuperDev2026` (той самий, що в налаштуваннях додатку!)
6. Натисніть **"Verify and Save"**

#### Крок 3: Перевірте доступність URL

Переконайтеся, що ваш сервер доступний:
```bash
curl https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=DashaSuperDev2026&hub.challenge=12345
```

Якщо все налаштовано правильно, ви повинні отримати відповідь з числом `12345`.

### 2. Instagram Webhook

#### Крок 1: Збережіть Verify Token в налаштуваннях додатку

1. Відкрийте ваш додаток: `https://tlumaczeniamt.com.pl`
2. Перейдіть в **Settings** → **Instagram**
3. В полі **"Verify Token"** введіть токен (наприклад: `DashaSuperDev2026`)
4. Натисніть **"Зберегти"**

#### Крок 2: Налаштуйте Webhook в Meta Developer Console

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Instagram** → **Webhooks**
4. Введіть:
   - **Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/instagram`
   - **Verify Token**: той самий, що в налаштуваннях додатку
5. Натисніть **"Verify and Save"**

### 3. Facebook Webhook

#### Крок 1: Збережіть Verify Token в налаштуваннях додатку

1. Відкрийте ваш додаток: `https://tlumaczeniamt.com.pl`
2. Перейдіть в **Settings** → **Facebook**
3. В полі **"Verify Token"** введіть токен (наприклад: `DashaSuperDev2026`)
4. Натисніть **"Зберегти"**

#### Крок 2: Налаштуйте Webhook в Meta Developer Console

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Messenger** → **Webhooks**
4. Введіть:
   - **Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook`
   - **Verify Token**: той самий, що в налаштуваннях додатку
5. Натисніть **"Verify and Save"**

## Важливо

⚠️ **Verify Token має бути однаковим в обох місцях:**
- В налаштуваннях додатку (Settings → WhatsApp/Instagram/Facebook)
- В Meta Developer Console

⚠️ **URL має бути доступним публічно:**
- Переконайтеся, що ваш сервер доступний з інтернету
- Перевірте, що nginx правильно проксує запити до backend
- Перевірте, що порт 443 (HTTPS) відкритий

⚠️ **Перевірте логи:**
Після спроби верифікації перевірте логи backend:
```bash
docker logs <backend-container-name>
```

Ви повинні побачити логи типу:
```
WhatsApp webhook verification: mode=subscribe, token=DashaSuperDev2026
WhatsApp verify_token from config: DashaSuperDev...
WhatsApp verify_token from Meta: DashaSuperDev...
WhatsApp webhook verified successfully
```

## Структура Webhook Endpoints

Всі webhook endpoints мають два методи:

### GET - Верифікація (Meta вимагає для налаштування)
```
GET /api/v1/communications/webhooks/{platform}?hub.mode=subscribe&hub.verify_token={token}&hub.challenge={challenge}
```

### POST - Отримання повідомлень
```
POST /api/v1/communications/webhooks/{platform}
Headers: X-Hub-Signature-256: sha256={signature}
Body: JSON з даними webhook
```

## Діагностика проблем

### Проблема: "Verification token mismatch"

**Причина:** Токен в Meta не збігається з токеном в налаштуваннях додатку.

**Рішення:**
1. Перевірте, що токен збережений в Settings → WhatsApp/Instagram/Facebook
2. Переконайтеся, що використовуєте той самий токен в Meta Developer Console
3. Перезапустіть backend після зміни налаштувань (якщо потрібно)

### Проблема: "Invalid verification request"

**Причина:** Meta не надсилає правильні параметри або URL недоступний.

**Рішення:**
1. Перевірте доступність URL через curl
2. Перевірте, що nginx правильно налаштований
3. Перевірте логи backend для деталей

### Проблема: URL недоступний

**Причина:** Сервер не відповідає на запити.

**Рішення:**
1. Перевірте, що backend запущений: `docker ps`
2. Перевірте nginx конфігурацію
3. Перевірте firewall налаштування
4. Перевірте SSL сертифікат

## Приклад налаштування для WhatsApp

### В налаштуваннях додатку (Settings → WhatsApp):
```
Access Token: EAAxxxxxxxxxxxxx
Phone Number ID: 123456789012345
App Secret: abcdef1234567890abcdef1234567890
Verify Token: DashaSuperDev2026  ← ТУТ
```

### В Meta Developer Console:
```
Callback URL: https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/whatsapp
Verify Token: DashaSuperDev2026  ← ТАКИЙ САМИЙ
```

## Перевірка після налаштування

Після успішної верифікації в Meta Developer Console ви побачите:
- ✅ "Webhook verified successfully"
- ✅ Список підписок (subscriptions) для webhook

Тепер ваш додаток готовий отримувати повідомлення через webhook!




