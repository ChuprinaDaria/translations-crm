# Налаштування OAuth для Instagram

## Redirect URI для Meta App Dashboard

Для налаштування входу в Instagram від імені компанії, потрібно вказати **Redirect URI** в Meta App Dashboard.

### Правильний URL:

```
https://tlumaczeniamt.com.pl/api/v1/communications/instagram/callback
```

## Крок 1: Додати Redirect URI в Meta App Dashboard

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Instagram** → **Basic Settings**
4. Або перейдіть в **Facebook Login** → **Settings**
5. В розділі **Valid OAuth Redirect URIs** додайте:
   ```
   https://tlumaczeniamt.com.pl/api/v1/communications/instagram/callback
   ```
6. Якщо використовуєте обидва домени (з www та без), додайте обидва:
   ```
   https://tlumaczeniamt.com.pl/api/v1/communications/instagram/callback
   https://www.tlumaczeniamt.com.pl/api/v1/communications/instagram/callback
   ```
7. Натисніть **"Save Changes"**

## Крок 2: Налаштувати Instagram App ID та App Secret

1. Відкрийте ваш додаток: `https://tlumaczeniamt.com.pl`
2. Перейдіть в **Settings** → **Instagram**
3. Введіть:
   - **Instagram App ID** (з Meta App Dashboard)
   - **App Secret** (з Meta App Dashboard)
   - **Verify Token** (для webhook)
4. Натисніть **"Зберегти Instagram"**

## Крок 3: Ініціювати OAuth flow

### Варіант 1: Через URL напряму

Відкрийте в браузері:
```
https://tlumaczeniamt.com.pl/api/v1/communications/instagram/auth
```

### Варіант 2: Через кнопку в Settings (майбутнє)

Кнопка "Підключити Instagram" буде додана в Settings UI, яка викликає цей же URL.

## Як це працює

1. **Користувач натискає "Підключити Instagram"**
   - Backend перенаправляє на Meta OAuth сторінку
   - URL: `https://www.facebook.com/v18.0/dialog/oauth?...`

2. **Користувач авторизується в Meta**
   - Meta перенаправляє назад на callback URL з `code`

3. **Backend обмінює code на access_token**
   - Використовує App ID та App Secret
   - Отримує access_token від Meta

4. **Backend зберігає access_token**
   - Зберігає в `app_settings` таблиці
   - Також зберігає `instagram_page_id` якщо знайдено

5. **Користувач бачить успішне повідомлення**
   - Автоматично перенаправляється до Settings

## Важливо

⚠️ **HTTPS обов'язковий**: Meta працює тільки через захищене з'єднання

⚠️ **Точний збіг URL**: Redirect URI має точно збігатися з тим, що вказано в Meta Dashboard

⚠️ **Permissions**: OAuth запитує наступні permissions:
- `instagram_basic` - базова інформація про Instagram акаунт
- `instagram_manage_messages` - управління повідомленнями
- `pages_show_list` - список сторінок
- `pages_read_engagement` - читання engagement даних

## Troubleshooting

### Помилка: "Redirect URI mismatch"
- Перевірте що URL в Meta Dashboard точно збігається з callback URL
- Переконайтеся що використовується HTTPS
- Перевірте наявність/відсутність trailing slash

### Помилка: "Invalid App ID or App Secret"
- Перевірте що App ID та App Secret правильно введені в Settings
- Переконайтеся що вони з правильного Meta App

### Помилка: "Access token not received"
- Перевірте логи backend для деталей
- Переконайтеся що App Secret правильний
- Перевірте що code не використано двічі (code можна використати тільки один раз)

## API Endpoints

- `GET /api/v1/communications/instagram/auth` - Початок OAuth flow
- `GET /api/v1/communications/instagram/callback` - OAuth callback (використовується Meta)

