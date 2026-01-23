# Facebook Meta Dashboard - Швидке налаштування

## 1. Проверяемый URI переадресации (Valid OAuth Redirect URIs)

**Розташування:** Meta Dashboard → Settings → Basic → OAuth Settings → Valid OAuth Redirect URIs

**URL для копіювання:**
```
https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback
```

---

## 2. Разрешенные домены для SDK JavaScript (Allowed Domains for JavaScript SDK)

**Розташування:** Meta Dashboard → Settings → Basic → App Domains

**Домени для копіювання (по одному на рядок):**
```
tlumaczeniamt.com.pl
www.tlumaczeniamt.com.pl
localhost
```

⚠️ **Важливо:**
- БЕЗ `http://` або `https://`
- БЕЗ слешів в кінці (`/`)
- `localhost` для розробки

---

## Швидкий чек-лист

### OAuth Settings
- [ ] **Valid OAuth Redirect URIs**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/callback`

### App Domains
- [ ] `tlumaczeniamt.com.pl`
- [ ] `www.tlumaczeniamt.com.pl`
- [ ] `localhost`

### Deauthorization
- [ ] **Deauthorization Callback URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/deauthorize`

### Data Deletion
- [ ] **Data Deletion Request URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion`
- [ ] **Data Deletion Status URL**: `https://tlumaczeniamt.com.pl/api/v1/communications/facebook/data-deletion-status`

---

## Як знайти в Meta Dashboard

1. Перейдіть: [Meta for Developers](https://developers.facebook.com/)
2. Виберіть ваш додаток
3. **Settings** → **Basic**
4. Прокрутіть до потрібного розділу:
   - **OAuth Settings** → Valid OAuth Redirect URIs
   - **App Domains** → додайте домени
   - **Deauthorization** → Deauthorization Callback URL
   - **Data Deletion** → обидва URL

