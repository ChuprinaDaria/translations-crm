# API Integration Guide

## Огляд

CRM система повністю інтегрована з backend API за адресою **https://mdev.alwaysdata.net** для управління користувачами, товарами, категоріями та підкатегоріями.

## Налаштування

### Базова URL API
```typescript
// Use proxy in development mode to avoid CORS issues
// In production, use direct API URL
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.DEV)
  ? '/api'  // Development: use proxy
  : 'https://mdev.alwaysdata.net';  // Production: direct requests
```

**CORS Проксі конфігурація:**

Проект налаштований з Vite проксі для обходу CORS помилок під час розробки:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://mdev.alwaysdata.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      }
    }
  }
})
```

**Як це працює:**
- **Development mode** (`npm run dev`): всі запити до `/api/*` проксюються на `https://mdev.alwaysdata.net/*`
- **Production mode** (`npm run build`): запити йдуть безпосередньо на `https://mdev.alwaysdata.net`
- CORS помилки автоматично обходяться під час розробки

Всі запити використовують `fetch` API з правильними заголовками:
- `Content-Type: application/json` для всіх POST/PUT запитів
- `Authorization: Bearer {token}` для захищених ендпоінтів
- `mode: 'cors'` для всіх запитів

## Аутентифікація з TOTP (Двофакторна аутентифікація)

### 1. Реєстрація

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "email": "user@example.com",
  "id": 1,
  "is_active": true,
  "is_admin": false,
  "created_at": "2025-11-24T03:18:19.673Z",
  "otpauth_url": "otpauth://totp/CRM:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=CRM"
}
```

**UI Flow:**
1. Користувач заповнює форму з email та паролем
2. Після успішної реєстрації показується QR код з `otpauth_url`
3. Користувач сканує QR код в Google Authenticator або Authy
4. QR код генерується за допомогою бібліотеки `qrcode`:
```typescript
import QRCode from 'qrcode';
const qrCodeUrl = await QRCode.toDataURL(response.otpauth_url);
```
5. Кнопка "Продовжити до логіну" переводить на форму входу

**HTTP Codes:**
- `200` - Успішна реєстрація
- `400` - Користувач вже існує
- `422` - Невалідні дані

---

### 2. Логін

**Endpoint:** `POST /auth/login`

**⚠️ ВАЖЛИВО:** Response - це **простий string (токен)**, не JSON об'єкт!

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "code": "123456"
}
```

**Response:** Plain text string (токен)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
```

**UI Flow:**
1. Користувач вводить email, пароль та 6-значний код з Google Authenticator
2. Поле для коду: `type="text"`, `maxLength={6}`, `placeholder="000000"`
3. Автоматична фільтрація введення (лише цифри):
```typescript
onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
```
4. Після успішного логіну:
   - Токен зберігається: `localStorage.setItem('auth_token', token)`
   - Редирект на головну сторінку
   - Токен додається до всіх запитів: `Authorization: Bearer {token}`

**HTTP Codes:**
- `200` - Успішний вхід
- `401` - Невірні облікові дані або TOTP код
- `422` - Невалідні дані

---

### 3. Управління токенами

```typescript
export const tokenManager = {
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  },

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  },

  removeToken(): void {
    localStorage.removeItem('auth_token');
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
};
```

---

## API для товарів (Items)

### 1. GET /items

**Параметри:** `skip` (integer), `limit` (integer)

**⚠️ ВАЖЛИВО:** Response - це **масив об'єктів**, не пагінований об'єкт!

**Request:**
```
GET /items?skip=0&limit=20
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Канапе з лососем",
    "description": "Свіжий лосось на хрусткому хлібці",
    "price": 45.00,
    "weight": 50,
    "unit": "г",
    "photo_url": "https://example.com/photo.jpg",
    "active": true,
    "subcategory_id": 1,
    "subcategory": {
      "id": 1,
      "name": "Холодні закуски",
      "category_id": 1,
      "category": {
        "id": 1,
        "name": "Закуски"
      }
    },
    "created_at": "2025-11-24T02:09:28.376Z"
  }
]
```

---

### 2. POST /items (Створення товару)

**Request Body:**
```json
{
  "name": "Канапе з лососем",
  "description": "Свіжий лосось на хрусткому хлібці",
  "price": 45.00,
  "weight": 50,
  "unit": "г",
  "photo_url": "https://example.com/photo.jpg",
  "active": true,
  "subcategory_id": 1
}
```

**Response:** Створений об'єкт товару

**UI компоненти:**
- Modal/Dialog з формою
- Обов'язкові поля: `name`, `price`, `subcategory_id`
- Select для `subcategory_id` з даними з `/subcategories`
- Checkbox для `active`
- Toast notification після успішного створення

---

### 3. GET /items/{item_id}

**Response:** Об'єкт товару (той самий формат що й у списку)

**UI:** Детальна сторінка або modal з повною інформацією

---

### 4. PUT /items/{item_id} (Оновлення товару)

**Request Body:**
```json
{
  "name": "Канапе з лососем (оновлено)",
  "subcategory_id": 1,
  "description": "Новий опис",
  "price": 50.00,
  "weight": 60,
  "unit": "г",
  "photo_url": "https://example.com/photo2.jpg",
  "active": true
}
```

**Response:** Оновлений об'єкт товару

**UI:** Форма редагування (аналогічна створенню, але з заповненими даними)

---

### 5. DELETE /items/{item_id}

**Response:** Plain text string (підтвердження)

**UI:**
- Кнопка "Видалити" на картці товару
- AlertDialog з підтвердженням: "Ви впевнені?"
- Toast notification після видалення
- Автоматичне оновлення списку

---

## API для категорій

### 1. GET /categories

**Response:**
```json
[
  {
    "id": 1,
    "name": "Закуски"
  },
  {
    "id": 2,
    "name": "Супи"
  }
]
```

**UI:** 
- Select dropdown для фільтрації товарів
- Список для управління категоріями

---

### 2. POST /categories

**Request Body:**
```json
{
  "name": "Десерти"
}
```

**Response:** Створена категорія

**UI:** Dialog з простою формою (одне поле)

---

## API для підкатегорій

### 1. GET /subcategories

**Параметри:** `category_id` (optional integer)

**Request:**
```
GET /subcategories?category_id=1
```

**Response:**
```json
[
  {
    "id": 1,
    "name": "Холодні закуски",
    "category_id": 1,
    "category": {
      "id": 1,
      "name": "Закуски"
    }
  }
]
```

**UI:** Select dropdown, що фільтрується при виборі категорії

---

### 2. POST /subcategories

**Request Body:**
```json
{
  "name": "Гарячі закуски",
  "category_id": 1
}
```

**Response:** Створена підкатегорія

---

## Обробка помилок

### HTTP коди помилок:

| Код | Опис | Дія |
|-----|------|-----|
| `401 Unauthorized` | Відсутній або невалідний токен | Редирект на логін, видалити токен |
| `422 Unprocessable Entity` | Помилка валідації даних | Показати помилки під полями форми |
| `404 Not Found` | Ресурс не знайдено | Показати повідомлення користувачу |
| `500 Internal Server Error` | Серверна помилка | Показати загальне повідомлення |
| `Network Error` | Відсутнє з'єднання | "Немає з'єднання з сервером" |

### Приклад обробки:

```typescript
try {
  const response = await itemsApi.getItems(0, 20);
  setItems(response);
} catch (error: any) {
  if (error.status === 401) {
    // Redirect to login
    tokenManager.removeToken();
    window.location.href = '/login';
  } else if (error.status === 422) {
    // Show validation errors
    toast.error(error.data?.detail || "Помилка валідації");
  } else {
    // Generic error
    toast.error("Помилка завантаження даних");
  }
}
```

---

## UX/UI вимоги

### Loading States
- ✅ Skeleton screens під час початкового завантаження
- ✅ Spinner на кнопках під час виконання дій
- ✅ Disabled стан для форм під час завантаження
- ✅ Loading indicator на кнопці "Оновити"

### Toast Notifications
- ✅ Успішні операції: зелений toast
- ✅ Помилки: червоний toast
- ✅ Попередження: жовтий toast

### Валідація форм
- ✅ Email формат
- ✅ Обов'язкові поля (позначені *)
- ✅ Мінімальна довжина пароля (6 символів)
- ✅ Збіг паролів при реєстрації
- ✅ 6-значний TOTP код (лише цифри)

### Responsive дизайн
- ✅ Мобільні пристрої (< 768px)
- ✅ Планшети (768px - 1024px)
- ✅ Десктоп (> 1024px)
- ✅ Адаптивні таблиці з горизонтальним скролом

### Порожні стани
- ✅ "Додайте перший товар" - коли немає товарів
- ✅ "Товари не знайдено" - при пошуку без результатів
- ✅ Skeleton screens під час завантаження

---

## Використання в коді

### Приклад: Реєстрація з QR кодом

```typescript
import QRCode from 'qrcode';
import { authApi } from '../lib/api';

const handleRegister = async () => {
  try {
    const response = await authApi.register({ email, password });
    
    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(response.otpauth_url);
    
    // Show QR code to user
    setShowQR(true);
    setQRCode(qrCodeUrl);
  } catch (error) {
    console.error('Registration failed:', error);
  }
};
```

### Приклад: Логін з TOTP

```typescript
import { authApi, tokenManager } from '../lib/api';

const handleLogin = async () => {
  try {
    // Login returns plain string token
    const token = await authApi.login({ email, password, code });
    
    // Save token
    tokenManager.setToken(token);
    
    // Redirect to dashboard
    navigate('/dashboard');
  } catch (error) {
    console.error('Login failed:', error);
  }
};
```

### Приклад: Отримання товарів

```typescript
import { itemsApi } from '../lib/api';

const loadItems = async () => {
  try {
    // API returns array, not paginated object
    const items = await itemsApi.getItems(0, 20);
    setItems(items);
  } catch (error) {
    console.error('Failed to load items:', error);
  }
};
```

---

## Структура файлів проекту

```
/lib/api.ts                          # API client з усіма функціями
/components/auth/AuthPage.tsx        # Головна сторінка аутентифікації
/components/auth/LoginForm.tsx       # Форма логіну з TOTP
/components/auth/RegisterForm.tsx    # Форма реєстрації з QR кодом
/components/ItemsManagement.tsx      # Управління товарами
/components/CategoriesManagement.tsx # Управління категоріями
```

---

## Додаткові залежності

### Встановлені пакети:
```json
{
  "qrcode": "^1.5.3"  // Генерація QR кодів для TOTP
}
```

---

## Безпека

⚠️ **Важливі нотатки:**

1. **Токени зберігаються в localStorage** - для production варто розглянути httpOnly cookies
2. **Всі API запити мають використовувати HTTPS** (поточний endpoint вже використовує HTTPS)
3. **TOTP коди валідні протягом 30 секунд** - час на сервері має бути синхронізований
4. **Система не призначена для збору PII** або зберігання надзвичайно чутливих даних
5. **Пароль мінімум 6 символів** - для production рекомендується 8+ символів

---

## Тестування

### Тестовий workflow:

1. **Реєстрація:**
   - Відкрийте сторінку реєстрації
   - Введіть email та пароль
   - Натисніть "Зареєструватися"
   - Відскануйте QR код в Google Authenticator
   - Натисніть "Продовжити до логіну"

2. **Логін:**
   - Введіть email та пароль з реєстрації
   - Введіть 6-значний код з Google Authenticator
   - Натисніть "Увійти"
   - Перевірте редирект на dashboard

3. **Управління товарами:**
   - Натисніть "Додати товар"
   - Заповніть форму
   - Натисніть "Створити"
   - Перевірте що товар з'явився в списку

4. **Вихід:**
   - Натисніть на аватар в header
   - Виберіть "Вийти"
   - Перевірте редирект на логін

---

## Troubleshooting

### Проблема: "Cannot read properties of undefined (reading 'VITE_API_BASE_URL')"
**Рішення:** API_BASE_URL тепер hardcoded як `'https://mdev.alwaysdata.net'`

### Проблема: "401 Unauthorized" на кожному запиті
**Рішення:** Перевірте що токен правильно зберігається в localStorage та додається до заголовків

### Проблема: "Invalid TOTP code"
**Рішення:** 
- Перевірте що час на телефоні та сервері синхронізований
- Переконайтеся що QR код був правильно відсканований
- Спробуйте згенерувати новий акаунт

### Проблема: Response парсинг помилки при логіні
**Рішення:** Логін ендпоінт повертає plain text token, не JSON. Код вже налаштований для обробки обох форматів.

---

**Версія документації:** 2.0  
**Дата оновлення:** 24 листопада 2024  
**API Base URL:** https://mdev.alwaysdata.net