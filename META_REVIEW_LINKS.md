# Посилання для Meta App Review

## Facebook Webhook URL

### URL обратного вызова (Callback URL)
🔗 **https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook**

**Опис:** Використовується для налаштування Facebook Webhook в Meta Dashboard.
- **GET** - верифікація webhook (Meta надсилає `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`)
- **POST** - отримання повідомлень від Meta

**Як налаштувати:**
1. Meta Dashboard → Messenger → Webhooks
2. Callback URL: `https://tlumaczeniamt.com.pl/api/v1/communications/webhooks/facebook`
3. Verify Token: той самий, що в Settings → Facebook

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

