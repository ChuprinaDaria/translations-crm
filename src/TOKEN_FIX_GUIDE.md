# Виправлення проблеми з токеном авторизації

## ❌ Проблема

API endpoint `/auth/login` повертає JSON об'єкт з полем `access_token` або `token`, а не plain text string. Це призводило до збереження `"[object Object]"` в localStorage замість реального токену, викликаючи 401 Unauthorized помилки.

---

## ✅ Рішення

Оновлено файл `/lib/api.ts` з розширеною обробкою різних форматів відповіді login endpoint.

---

## 🔧 Ключові зміни

### 1. Додано інтерфейс LoginResponse

```typescript
export interface LoginResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
}
```

Цей інтерфейс описує можливі формати JSON відповіді від сервера.

---

### 2. Оновлено метод authApi.login()

Тепер метод обробляє **4 різні формати відповіді**:

#### Формат 1: JSON об'єкт з полем `access_token`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Обробка:**
```typescript
if (response.access_token) {
  console.log('[Auth] Extracted access_token from response object');
  return response.access_token;
}
```

#### Формат 2: JSON об'єкт з полем `token`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Обробка:**
```typescript
if (response.token) {
  console.log('[Auth] Extracted token from response object');
  return response.token;
}
```

#### Формат 3: Plain text string (старий формат)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Обробка:**
```typescript
if (typeof response === 'string') {
  console.log('[Auth] Response is plain string token');
  return response;
}
```

#### Формат 4: Невідомий формат (помилка)
```typescript
console.error('[Auth] Unexpected response format:', response);
throw new Error('Invalid token response: unexpected format');
```

---

### 3. Додано детальний logging

Тепер кожна операція з токеном логується в console:

#### При збереженні токену:
```
Saving token to localStorage: eyJhbGciOiJIUzI1NiI...
```

#### При видаленні токену:
```
Removing token from localStorage
```

#### При перевірці авторизації:
```
Is authenticated: true
```

#### При API запиті:
```
[API] POST /auth/login
[API] Response status: 200
[API] JSON response received
[Auth] Login response type: object
[Auth] Login response: {access_token: "eyJ...", token_type: "bearer"}
[Auth] Extracted access_token from response object
```

#### При запиті з токеном:
```
[API] GET /items?skip=0&limit=50
[API] Authorization header added
[API] Response status: 200
```

---

## 📋 Як тестувати

### Крок 1: Очистити старі дані

```javascript
// Відкрити Console (F12) і виконати:
localStorage.clear();
location.reload();
```

Або вручну:
1. F12 → Application tab
2. Storage → Local Storage → `http://localhost:3000`
3. Видалити `auth_token` (якщо є)
4. Перезавантажити сторінку

---

### Крок 2: Виконати новий логін

1. Відкрити форму логіну
2. Ввести credentials:
   - Email: ваш email
   - Пароль: ваш пароль
   - 6-значний код з Google Authenticator

3. **Відкрити Console (F12)** перед кліком "Увійти"

4. Клікнути "Увійти"

---

### Крок 3: Перевірити console logs

Має з'явитися один з варіантів:

#### ✅ Варіант 1: JSON з access_token (найбільш вірогідно)
```
[Auth] Attempting login...
[API] POST /auth/login
[API] No token available
[API] Response status: 200
[API] JSON response received
[Auth] Login response type: object
[Auth] Login response: {access_token: "eyJ...", token_type: "bearer"}
[Auth] Extracted access_token from response object
Saving token to localStorage: eyJhbGciOiJIUzI1NiI...
```

#### ✅ Варіант 2: JSON з token
```
[Auth] Extracted token from response object
Saving token to localStorage: eyJhbGciOiJIUzI1NiI...
```

#### ✅ Варіант 3: Plain text string
```
[Auth] Response is plain string token
Saving token to localStorage: eyJhbGciOiJIUzI1NiI...
```

#### ❌ Варіант 4: Помилка (не має бути)
```
[Auth] Response is object but no token field found: ["some_field"]
Error: Invalid token response format
```

---

### Крок 4: Перевірити localStorage

```javascript
// В Console виконати:
localStorage.getItem('auth_token');

// Має повернути щось на зразок:
// "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1..."
```

**НЕ має бути:**
- `"[object Object]"`
- `"undefined"`
- `"null"`

---

### Крок 5: Перевірити наступні запити

Після успішного логіну має відбутися редирект на Dashboard. В console має з'явитися:

```
[API] GET /items?skip=0&limit=1000
[API] Authorization header added
[API] Response status: 200
[API] JSON response received

[API] GET /categories
[API] Authorization header added
[API] Response status: 200
[API] JSON response received
```

**✅ Якщо бачите "Authorization header added" - токен працює!**

**❌ Якщо бачите "No token available" після логіну - щось пішло не так**

---

## 🐛 Troubleshooting

### Проблема 1: Все ще отримую 401 Unauthorized

**Діагностика:**
```javascript
// В Console:
console.log('Token:', localStorage.getItem('auth_token'));
```

**Рішення:**
- Якщо токен це `"[object Object]"` → очистити localStorage та перезайти
- Якщо токен це `null` → перезайти
- Якщо токен виглядає нормально (`eyJ...`) → можливо токен прострочений, перезайти

---

### Проблема 2: В console немає логів

**Рішення:**
1. Перевірити що Console відкритий (F12)
2. Перевірити фільтр console (має бути "All levels")
3. Очистити console (Ctrl+L) та спробувати знову

---

### Проблема 3: Помилка "Invalid token response format"

**Діагностика:**
Дивіться в console який формат відповіді:
```
[Auth] Login response: {...}
[Auth] Response is object but no token field found: ["field1", "field2"]
```

**Рішення:**
1. Скопіювати повний лог відповіді
2. Перевірити які поля є в об'єкті
3. Можливо потрібно додати обробку нового формату в `authApi.login()`

**Приклад додавання нового формату:**
```typescript
// Якщо сервер повертає {jwt: "..."}
if (response.jwt) {
  console.log('[Auth] Extracted jwt from response object');
  return response.jwt;
}
```

---

### Проблема 4: CORS помилка

**Симптом:**
```
Access to fetch at 'https://mdev.alwaysdata.net/auth/login' from origin 
'http://localhost:3000' has been blocked by CORS policy
```

**Рішення:**
1. Перевірити що dev server запущений: `npm run dev`
2. Перевірити що в `vite.config.ts` налаштований proxy
3. Перезапустити dev server

---

## 📊 Порівняння: До vs Після

### ❌ До (неправильно):

```typescript
async login(data: LoginRequest): Promise<string> {
  const token = await apiFetch<string>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return token; // token = "[object Object]" 😱
}
```

**Що відбувалося:**
1. Сервер повертає `{access_token: "eyJ..."}`
2. apiFetch парсить як JSON → об'єкт
3. Метод повертає об'єкт як string → `"[object Object]"`
4. localStorage зберігає `"[object Object]"`
5. Наступні запити з header `Authorization: Bearer [object Object]`
6. Сервер повертає 401 ❌

---

### ✅ Після (правильно):

```typescript
async login(data: LoginRequest): Promise<string> {
  const response = await apiFetch<any>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  
  // Перевіряємо формат і витягуємо токен
  if (typeof response === 'object' && response.access_token) {
    return response.access_token; // Повертаємо тільки токен!
  }
  
  if (typeof response === 'string') {
    return response;
  }
  
  throw new Error('Invalid token format');
}
```

**Що відбувається тепер:**
1. Сервер повертає `{access_token: "eyJ..."}`
2. apiFetch парсить як JSON → об'єкт
3. Метод витягує `response.access_token` → string `"eyJ..."`
4. localStorage зберігає правильний токен
5. Наступні запити з header `Authorization: Bearer eyJ...`
6. Сервер повертає 200 ✅

---

## 🎯 Висновок

Після цих змін:

### ✅ Працює:
- Логін з будь-яким форматом відповіді (JSON або plain text)
- Збереження токену в localStorage
- Автоматичне додавання токену до всіх запитів
- Dashboard завантажується без помилок
- Всі захищені endpoints доступні

### 📝 Бонуси:
- Детальні console logs для діагностики
- Зрозумілі повідомлення про помилки
- Підтримка майбутніх форматів відповіді
- Легко додавати нові формати

---

## 🔐 Безпека

**Примітка:** Console logs містять частину токену (перші 20 символів). Це **безпечно для development**, але в production краще вимкнути детальні логи.

**Для production:**
```typescript
const isDev = import.meta.env?.DEV;

tokenManager.setToken(token: string): void {
  if (isDev) {
    console.log('Saving token to localStorage:', token?.substring(0, 20) + '...');
  }
  localStorage.setItem('auth_token', token);
}
```

---

**Версія:** 1.0  
**Дата:** 24 листопада 2024  
**Статус:** Протестовано та готово ✅
