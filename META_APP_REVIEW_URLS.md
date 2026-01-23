# URLs для перевірки Meta App

## Обов'язкові URLs для Meta App Review

### 1. URL обратного вызова на деавторизацию (Deauthorization Callback URL)

```
https://tlumaczeniamt.com.pl/api/v1/communications/instagram/deauthorize
```

**Метод:** POST  
**Опис:** Викликається Meta коли користувач видаляє додаток або відкликає дозволи. Очищає access_token та інші дані користувача.

---

### 2. URL запроса на удаление данных (Data Deletion Request URL)

```
https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion
```

**Метод:** POST  
**Опис:** Викликається Meta коли користувач запитує видалення своїх даних. Видаляє всі розмови та повідомлення Instagram для користувача.

**Відповідь:** Повертає `confirmation_code` та URL для перевірки статусу:
```json
{
  "url": "https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status?confirmation_code=XXX",
  "confirmation_code": "XXX"
}
```

---

### 3. URL для перевірки статусу видалення даних

```
https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status?confirmation_code=XXX
```

**Метод:** GET  
**Опис:** Meta використовує цей URL для перевірки статусу видалення даних користувача.

---

## Публічні сторінки (для перевірки Meta)

### 4. Умови використання (Terms of Service)

```
https://tlumaczeniamt.com.pl/terms
```

**Опис:** Сторінка з умовами використання сервісу. Доступна в футері всіх сторінок.

---

### 5. Політика конфіденційності (GDPR Policy)

```
https://tlumaczeniamt.com.pl/gdpr
```

**Опис:** Сторінка з політикою конфіденційності та GDPR. Доступна в футері всіх сторінок.

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

## Перевірка роботи endpoints

### Тест деавторизації:
```bash
curl -X POST https://tlumaczeniamt.com.pl/api/v1/communications/instagram/deauthorize \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test_user_id"}'
```

**Очікувана відповідь:**
```json
{"status": "ok"}
```

### Тест видалення даних:
```bash
curl -X POST https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion \
  -H "Content-Type: application/json" \
  -d '{"user_id": "test_user_id", "confirmation_code": "test_code_123"}'
```

**Очікувана відповідь:**
```json
{
  "url": "https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status?confirmation_code=test_code_123",
  "confirmation_code": "test_code_123"
}
```

### Тест статусу видалення:
```bash
curl https://tlumaczeniamt.com.pl/api/v1/communications/instagram/data-deletion-status?confirmation_code=test_code_123
```

**Очікувана відповідь:**
```json
{
  "status": "completed",
  "confirmation_code": "test_code_123",
  "message": "Data deletion completed"
}
```

---

## Важливо

⚠️ **HTTPS обов'язковий**: Всі URLs мають використовувати HTTPS

⚠️ **Публічний доступ**: Endpoints мають бути доступні без автентифікації (Meta викликає їх напряму)

⚠️ **Валідація**: Endpoints мають валідувати `signed_request` від Meta для безпеки (в майбутньому)

⚠️ **Логування**: Всі запити логуються для діагностики

