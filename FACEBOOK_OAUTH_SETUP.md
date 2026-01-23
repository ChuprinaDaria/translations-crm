# Facebook OAuth Setup для Meta Dashboard

## Redirect URI для OAuth

```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback
```

## Як налаштувати в Meta App Dashboard

### 1. Налаштування OAuth Redirect URIs (Проверяемый URI переадресации)

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Settings** → **Basic**
4. Прокрутіть до розділу **"OAuth Settings"**
5. В розділі **"Valid OAuth Redirect URIs"** (Проверяемый URI переадресации) додайте:
   ```
   https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback
   ```
6. Натисніть **"Save Changes"**

⚠️ **Важливо:** URL має точно збігатися з тим, що використовується в коді backend

### 2. Налаштування Allowed Domains для JavaScript SDK (Разрешенные домены для SDK JavaScript)

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Settings** → **Basic**
4. Прокрутіть до розділу **"App Domains"** або **"Allowed Domains for JavaScript SDK"**
5. Додайте домени (по одному на рядок):
   ```
   tlumaczeniamt.com.pl
   www.tlumaczeniamt.com.pl
   localhost
   ```
6. Натисніть **"Save Changes"**

⚠️ **Важливо:** 
- Додавайте домени БЕЗ `http://` або `https://`
- `localhost` потрібен для розробки
- Домени мають точно збігатися з тими, де використовується Facebook SDK

### 3. Налаштування в Settings UI

1. Відкрийте ваш додаток: `https://tlumaczeniamt.com.pl`
2. Перейдіть в **Settings** → **Facebook**
3. Введіть:
   - **App ID**: ваш Facebook App ID з Meta Dashboard
   - **App Secret**: ваш Facebook App Secret з Meta Dashboard
   - **Verify Token**: будь-який токен для верифікації webhook (наприклад: `DashaSuperDev2026`)
4. Натисніть **"Підключити Facebook"**
5. Вас перенаправить на Meta для авторизації
6. Після успішної авторизації ви повернетесь до налаштувань, і **Access Token** та **Page ID** будуть автоматично збережені

## Як це працює

### 1. Початок OAuth (GET /api/v1/communications/facebook/auth)
- Користувач натискає "Підключити Facebook" в Settings UI
- Backend перенаправляє на Meta OAuth сторінку з параметрами:
  - `client_id`: ваш App ID
  - `redirect_uri`: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback`
  - `scope`: `pages_show_list,pages_read_engagement,pages_manage_metadata,pages_messaging`
  - `response_type`: `code`

### 2. OAuth Callback (GET /api/v1/communications/facebook/callback)
- Meta перенаправляє користувача назад з `code`
- Backend обмінює `code` на `access_token` через Meta Graph API
- Backend отримує список сторінок користувача (`/me/accounts`)
- Backend зберігає `access_token` та `page_id` в налаштуваннях
- Користувач бачить повідомлення про успіх і автоматично повертається до Settings

## Важливо

⚠️ **Redirect URI має точно збігатися:**
- В Meta Dashboard → Settings → Basic → Valid OAuth Redirect URIs
- В коді backend (`/api/v1/communications/facebook/callback`)

⚠️ **HTTPS обов'язковий**: Meta працює тільки через HTTPS

⚠️ **App ID та App Secret:**
- Можуть бути однаковими для Facebook та Instagram (якщо використовується один Meta App)
- Якщо Facebook App ID не вказано, система спробує використати Instagram App ID

⚠️ **Permissions (Scopes):**
- `pages_show_list` - отримати список сторінок
- `pages_read_engagement` - читати взаємодії
- `pages_manage_metadata` - керувати метаданими
- `pages_messaging` - надсилати повідомлення

## Перевірка

Після налаштування перевірте логи backend:
```bash
docker logs crm_translations_backend | grep Facebook
```

Має з'явитися:
```
Facebook OAuth redirect: https://www.facebook.com/v18.0/dialog/oauth?...
Facebook OAuth successful. Access token saved. Page ID: ...
```

## Troubleshooting

### Помилка: "Invalid redirect_uri"
- Перевірте, що Redirect URI точно збігається в Meta Dashboard та в коді
- Переконайтеся, що використовується HTTPS

### Помилка: "App ID не налаштовано"
- Введіть Facebook App ID в Settings → Facebook
- Або введіть Instagram App ID (якщо використовується один App для обох платформ)

### Помилка: "Access token не отримано"
- Перевірте App Secret в Settings → Facebook
- Перевірте, що App Secret правильний в Meta Dashboard

