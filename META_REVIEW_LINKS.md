# Посилання для Meta App Review

## Facebook URLs

### Facebook Webhook URL (Callback URL)
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook**

**Опис:** Використовується для налаштування Facebook Webhook в Meta Dashboard.
- **GET** - верифікація webhook (Meta надсилає `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`)
- **POST** - отримання повідомлень від Meta

**Як налаштувати:**
1. Meta Dashboard → Messenger → Webhooks
2. Callback URL: `https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook`
3. Verify Token: той самий, що в Settings → Facebook

---

### Facebook OAuth Redirect URI
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback**

**Опис:** Використовується для OAuth авторизації Facebook компаній.
- **GET** - обробляє redirect від Meta після авторизації
- Обмінює OAuth code на access_token
- Автоматично зберігає access_token та page_id в налаштуваннях

**Як налаштувати:**
1. Meta Dashboard → Settings → Basic → OAuth Settings
2. **Valid OAuth Redirect URIs** (Проверяемый URI переадресации): `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback`
3. **App Domains** (Разрешенные домены для SDK JavaScript):
   - `tlumaczeniamt.com.pl`
   - `www.tlumaczeniamt.com.pl`
   - `localhost` (для розробки)
4. Settings → Facebook → введіть App ID та App Secret
5. Натисніть "Підключити Facebook" в Settings UI

---

## Facebook App Review Endpoints

### URL обратного вызова на деавторизацию (Facebook)
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize**

**Метод:** POST  
**Опис:** Викликається Meta коли користувач видаляє додаток або відкликає дозволи Facebook.

**Параметри:**
- `signed_request` - підписаний запит від Meta з інформацією про користувача

---

### URL запроса на удаление данных (Facebook)
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion**

**Метод:** POST  
**Опис:** Викликається Meta коли користувач запитує видалення своїх даних Facebook.

**Параметри:**
- `user_id` - ID користувача Facebook
- `signed_request` - підписаний запит від Meta

**Відповідь:**
```json
{
  "url": "https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status?confirmation_code=...",
  "confirmation_code": "..."
}
```

---

### URL для перевірки статусу видалення (Facebook)
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status**

**Метод:** GET  
**Опис:** Meta використовує цей URL для перевірки статусу видалення даних Facebook.

**Параметри:**
- `confirmation_code` - код підтвердження з запиту на видалення

---

## Публічні сторінки (доступні в футері сайту)

### Умови використання
🔗 **https://tlumaczeniamt.com.pl/terms**

### Політика конфіденційності (GDPR)
🔗 **https://tlumaczeniamt.com.pl/gdpr**

---

## API Endpoints для Meta

### URL обратного вызова на деавторизацию
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/instagram/deauthorize**

**Метод:** POST  
**Опис:** Викликається Meta коли користувач видаляє додаток або відкликає дозволи.

---

### URL запроса на удаление данных
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion**

**Метод:** POST  
**Опис:** Викликається Meta коли користувач запитує видалення своїх даних.

---

### URL для перевірки статусу видалення
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status**

**Метод:** GET  
**Опис:** Meta використовує цей URL для перевірки статусу видалення даних.

---

## Як налаштувати в Meta App Dashboard

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Instagram** → **Basic Settings**
4. В розділі **"Data Deletion"** введіть:
   - **Data Deletion Request URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion`
   - **Data Deletion Status URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status`
5. В розділі **"Deauthorization"** введіть:
   - **Deauthorization Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/instagram/deauthorize`
6. В розділі **"App Review"** вкажіть:
   - **Privacy Policy URL**: `https://tlumaczeniamt.com.pl/gdpr`
   - **Terms of Service URL**: `https://tlumaczeniamt.com.pl/terms`

---

## Перевірка

Всі посилання доступні та працюють. Футер з посиланнями на Terms та GDPR відображається на всіх сторінках CRM системи.

