# Facebook Webhook URL для Meta Dashboard

## URL обратного вызова (Callback URL)

```
https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook
```

## Як налаштувати в Meta App Dashboard

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Messenger** → **Webhooks** (або **Facebook** → **Webhooks**)
4. Натисніть **"Add Callback URL"** або **"Edit"**
5. Введіть:
   - **Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook`
   - **Verify Token**: той самий токен, який ви вказали в Settings → Facebook → Verify Token
6. Натисніть **"Verify and Save"**

## Як це працює

### 1. Верифікація (GET запит)
Meta надсилає GET запит з параметрами:
- `hub.mode=subscribe`
- `hub.verify_token=ваш_токен`
- `hub.challenge=випадкове_число`

Backend перевіряє `verify_token` і повертає `hub.challenge` якщо токен правильний.

### 2. Отримання повідомлень (POST запит)
Після верифікації Meta надсилає POST запити з повідомленнями:
- Заголовок `X-Hub-Signature-256` для перевірки підпису
- JSON body з даними повідомлення

Backend перевіряє підпис та обробляє повідомлення.

## Перевірка

Після налаштування перевірте логи backend:
```bash
docker logs crm_translations_backend | grep Facebook
```

Має з'явитися:
```
Facebook webhook verification: mode=subscribe, token=ваш_токен
Facebook webhook verified successfully
```

## Важливо

⚠️ **Verify Token має бути однаковим:**
- В Settings → Facebook → Verify Token
- В Meta Dashboard → Webhooks → Verify Token

⚠️ **HTTPS обов'язковий**: Meta працює тільки через HTTPS

⚠️ **URL має бути доступним**: Переконайтеся що сервер доступний з інтернету

