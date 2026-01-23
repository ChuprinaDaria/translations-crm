# Facebook App Review URLs для Meta Dashboard

## URL для налаштування в Meta App Dashboard

### 1. URL обратного вызова на деавторизацию (Deauthorization Callback URL)

```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize
```

**Метод:** POST  
**Опис:** Викликається Meta коли користувач видаляє додаток або відкликає дозволи Facebook.

**Параметри:**
- `signed_request` - підписаний запит від Meta з інформацією про користувача (формат: `<signature>.<payload>`)

**Що робить:**
- Розпаковує `signed_request` та отримує `user_id`
- Очищає `facebook_access_token` та `facebook_page_id` в налаштуваннях
- Повертає `{"status": "ok"}`

---

### 2. URL запроса на удаление данных (Data Deletion Request URL)

```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion
```

**Метод:** POST  
**Опис:** Викликається Meta коли користувач запитує видалення своїх даних Facebook.

**Параметри:**
- `user_id` - ID користувача Facebook
- `signed_request` - підписаний запит від Meta (опціонально)

**Що робить:**
- Генерує `confirmation_code`
- Видаляє всі розмови Facebook (`Conversation.platform == FACEBOOK`) для `user_id`
- Видаляє всі повідомлення з цих розмов
- Повертає `confirmation_code` та URL для перевірки статусу

**Відповідь:**
```json
{
  "url": "https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status?confirmation_code=XXX",
  "confirmation_code": "XXX"
}
```

---

### 3. URL для перевірки статусу видалення даних (Data Deletion Status URL)

```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status?confirmation_code=XXX
```

**Метод:** GET  
**Опис:** Meta використовує цей URL для перевірки статусу видалення даних користувача.

**Параметри:**
- `confirmation_code` - код підтвердження з запиту на видалення

**Відповідь:**
```json
{
  "status": "completed",
  "confirmation_code": "XXX",
  "message": "Data deletion request has been processed"
}
```

---

## Як налаштувати в Meta App Dashboard

### Крок 1: OAuth Redirect URI (Проверяемый URI переадресации)

1. Перейдіть в [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. Перейдіть в **Settings** → **Basic**
4. Прокрутіть до розділу **"OAuth Settings"**
5. В розділі **"Valid OAuth Redirect URIs"** (Проверяемый URI переадресации) додайте:
   ```
   https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback
   ```
6. Натисніть **"Save Changes"**

### Крок 2: Allowed Domains for JavaScript SDK (Разрешенные домены для SDK JavaScript)

1. В тому ж розділі **Settings** → **Basic**
2. Прокрутіть до **"App Domains"** (або **"Allowed Domains for JavaScript SDK"**)
3. Додайте домени (по одному на рядок):
   ```
   tlumaczeniamt.com.pl
   www.tlumaczeniamt.com.pl
   localhost
   ```
4. Натисніть **"Save Changes"**

### Крок 3: Deauthorization & Data Deletion URLs

1. В розділі **Settings** → **Basic**
2. Прокрутіть до **"Data Deletion"** та введіть:
   - **Data Deletion Request URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion`
   - **Data Deletion Status URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status`
3. Прокрутіть до **"Deauthorization"** та введіть:
   - **Deauthorization Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize`
4. Натисніть **"Save Changes"**

---

## Перевірка

Після налаштування перевірте логи backend:
```bash
docker logs crm_translations_backend | grep Facebook
```

Має з'явитися:
```
Facebook deauthorize: cleared access token for user ...
Facebook data deletion: deleted X messages and Y conversations for user ...
```

---

## Важливо

⚠️ **Всі endpoints повертають 200 OK** - навіть при помилках, щоб Meta не повторював запити

⚠️ **signed_request** - Meta надсилає підписаний запит, який містить `user_id` та іншу інформацію

⚠️ **confirmation_code** - генерується автоматично для кожного запиту на видалення даних

⚠️ **Видалення даних** - видаляються тільки розмови та повідомлення Facebook для конкретного `user_id`

