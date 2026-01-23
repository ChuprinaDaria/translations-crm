# Налаштування Facebook в Meta App Dashboard

## Швидкий чек-лист для Meta Dashboard

### 1. Проверяемый URI переадресации (Valid OAuth Redirect URIs)

**Розташування:** Settings → Basic → OAuth Settings → Valid OAuth Redirect URIs

**URL для додавання:**
```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback
```

**Як додати:**
1. Перейдіть в **Settings** → **Basic**
2. Прокрутіть до **"OAuth Settings"**
3. В розділі **"Valid OAuth Redirect URIs"** натисніть **"Add URI"**
4. Введіть: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback`
5. Натисніть **"Save Changes"**

⚠️ **Важливо:** 
- URL має точно збігатися (включаючи `https://`)
- Не додавайте порт (не `:8000` або `:443`)
- URL має бути доступним з інтернету

---

### 2. Разрешенные домены для SDK JavaScript (Allowed Domains for JavaScript SDK)

**Розташування:** Settings → Basic → App Domains

**Домени для додавання:**
```
tlumaczeniamt.com.pl
www.tlumaczeniamt.com.pl
localhost
```

**Як додати:**
1. Перейдіть в **Settings** → **Basic**
2. Прокрутіть до **"App Domains"**
3. Додайте домени (по одному на рядок):
   - `tlumaczeniamt.com.pl`
   - `www.tlumaczeniamt.com.pl`
   - `localhost` (для розробки)
4. Натисніть **"Save Changes"**

⚠️ **Важливо:**
- Додавайте домени БЕЗ `http://` або `https://`
- Додавайте БЕЗ слешів в кінці (`/`)
- `localhost` потрібен для розробки на локальній машині
- Домени мають точно збігатися з тими, де використовується Facebook SDK

---

### 3. Deauthorization Callback URL

**Розташування:** Settings → Basic → Deauthorization

**URL для додавання:**
```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize
```

**Як додати:**
1. Перейдіть в **Settings** → **Basic**
2. Прокрутіть до **"Deauthorization"**
3. Введіть: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize`
4. Натисніть **"Save Changes"**

---

### 4. Data Deletion URLs

**Розташування:** Settings → Basic → Data Deletion

**URLs для додавання:**

**Data Deletion Request URL:**
```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion
```

**Data Deletion Status URL:**
```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status
```

**Як додати:**
1. Перейдіть в **Settings** → **Basic**
2. Прокрутіть до **"Data Deletion"**
3. Введіть обидва URL
4. Натисніть **"Save Changes"**

---

## Повний чек-лист налаштувань

### OAuth Settings
- [ ] Valid OAuth Redirect URIs: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback`

### App Domains
- [ ] `tlumaczeniamt.com.pl`
- [ ] `www.tlumaczeniamt.com.pl`
- [ ] `localhost` (для розробки)

### Deauthorization
- [ ] Deauthorization Callback URL: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize`

### Data Deletion
- [ ] Data Deletion Request URL: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion`
- [ ] Data Deletion Status URL: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status`

### App Review
- [ ] Privacy Policy URL: `https://tlumaczeniamt.com.pl/gdpr`
- [ ] Terms of Service URL: `https://tlumaczeniamt.com.pl/terms`

---

## Перевірка налаштувань

Після налаштування перевірте:

1. **OAuth Redirect URI:**
   - Спробуйте натиснути "Підключити Facebook" в Settings UI
   - Має відбутися перенаправлення на Meta для авторизації

2. **JavaScript SDK:**
   - Відкрийте консоль браузера на `https://tlumaczeniamt.com.pl`
   - Має з'явитися: `Facebook SDK script loaded and ready for initialization`
   - Після автентифікації: `Facebook SDK initialized with App ID: ...`

3. **Deauthorization:**
   - Meta може протестувати endpoint автоматично
   - Перевірте логи: `docker logs crm_translations_backend | grep Facebook`

---

## Troubleshooting

### Помилка: "Invalid redirect_uri"
- Перевірте, що URL точно збігається в Meta Dashboard та в коді
- Переконайтеся, що використовується HTTPS
- Перевірте, що немає зайвих слешів або портів

### Помилка: "Domain not allowed"
- Перевірте, що домен додано в App Domains
- Переконайтеся, що домен без `http://` або `https://`
- Перевірте, що немає зайвих слешів

### SDK не завантажується
- Перевірте консоль браузера на помилки
- Переконайтеся, що домен додано в App Domains
- Перевірте, що App ID правильний в Settings → Facebook

