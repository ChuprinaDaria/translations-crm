# CORS Proxy Setup Guide

## Проблема CORS

При розробці frontend додатку, який підключається до API на іншому домені (https://mdev.alwaysdata.net), браузер блокує запити через політику Same-Origin Policy (CORS).

## Рішення: Vite Dev Server Proxy

Для обходу CORS помилок під час розробки використовується Vite Proxy Server.

---

## Конфігурація

### 1. vite.config.ts

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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

**Пояснення параметрів:**

- **`target`** - URL backend API, на який проксюються запити
- **`changeOrigin: true`** - змінює origin заголовок на target URL (необхідно для CORS)
- **`rewrite`** - видаляє `/api` з початку path (запит `/api/items` стає `/items`)
- **`secure: false`** - дозволяє проксювати на HTTPS сервери з самопідписаними сертифікатами

---

### 2. API Base URL в lib/api.ts

```typescript
// Use proxy in development mode to avoid CORS issues
// In production, use direct API URL
const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.DEV)
  ? '/api'  // Development: use proxy
  : 'https://mdev.alwaysdata.net';  // Production: direct requests
```

**Логіка:**

- **Development mode** (`npm run dev`): `API_BASE_URL = '/api'`
  - Запит: `fetch('/api/items')`
  - Vite proxy перетворює на: `https://mdev.alwaysdata.net/items`
  
- **Production mode** (`npm run build`): `API_BASE_URL = 'https://mdev.alwaysdata.net'`
  - Запит: `fetch('https://mdev.alwaysdata.net/items')`
  - Прямий запит без проксі

---

### 3. Fetch з CORS mode

```typescript
const response = await fetch(`${API_BASE_URL}${endpoint}`, {
  ...options,
  headers,
  mode: 'cors',
});
```

**`mode: 'cors'`** вказує браузеру використовувати CORS протокол.

---

## Як це працює

### Development Flow

```
Browser Request:
  fetch('/api/auth/login')
         ↓
Vite Dev Server Proxy:
  /api/auth/login → https://mdev.alwaysdata.net/auth/login
         ↓
Backend API:
  https://mdev.alwaysdata.net/auth/login
         ↓
Response:
  ← Backend → Vite Proxy → Browser
```

**Переваги:**
- ✅ Немає CORS помилок
- ✅ Backend не потребує змін
- ✅ Працює локально без додаткових налаштувань

---

### Production Flow

```
Browser Request:
  fetch('https://mdev.alwaysdata.net/auth/login')
         ↓
Backend API:
  https://mdev.alwaysdata.net/auth/login
         ↓
Response:
  ← Backend → Browser
```

**Примітка:** У production backend має мати правильні CORS заголовки або frontend має бути на тому ж домені.

---

## Перевірка що проксі працює

### 1. Запустіть dev server

```bash
npm run dev
```

### 2. Відкрийте DevTools → Network

### 3. Виконайте API запит (наприклад, логін)

### 4. Перевірте Request URL

**Правильно (Development):**
```
Request URL: http://localhost:5173/api/auth/login
```

**Неправильно:**
```
Request URL: https://mdev.alwaysdata.net/auth/login
(CORS error в консолі)
```

---

## Troubleshooting

### Проблема: "CORS policy error" навіть з проксі

**Можливі причини:**

1. **Неправильна конфігурація vite.config.ts**
   - Перевірте що файл існує в корені проекту
   - Перевірте синтаксис конфігурації

2. **Не перезапустили dev server**
   - Після зміни `vite.config.ts` потрібно перезапустити `npm run dev`

3. **API_BASE_URL не використовує проксі**
   - Перевірте що в development mode використовується `/api`
   - Перевірте `import.meta.env.DEV`

### Проблема: "404 Not Found" на /api/* endpoints

**Рішення:**

Перевірте `rewrite` функцію в vite.config.ts:
```typescript
rewrite: (path) => path.replace(/^\/api/, '')
```

Це видаляє `/api` з шляху перед проксюванням.

### Проблема: В production не працюють запити

**Рішення:**

Переконайтеся що backend API:
1. Має правильні CORS заголовки
2. Дозволяє запити з домену вашого frontend
3. Або frontend та backend на одному домені

**CORS заголовки на backend:**
```
Access-Control-Allow-Origin: https://your-frontend-domain.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

---

## Альтернативні рішення CORS

Якщо Vite proxy не працює, розгляньте альтернативи:

### 1. CORS Anywhere (для тестування)

```typescript
const API_BASE_URL = 'https://cors-anywhere.herokuapp.com/https://mdev.alwaysdata.net';
```

⚠️ **Не використовувати в production!**

### 2. Backend CORS налаштування

Попросіть backend додати CORS заголовки для вашого домену.

### 3. Nginx reverse proxy

Якщо ви контролюєте deployment, налаштуйте Nginx:

```nginx
location /api/ {
    proxy_pass https://mdev.alwaysdata.net/;
    proxy_set_header Host mdev.alwaysdata.net;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Перевірка конфігурації

### Checklist ✅

- [ ] `vite.config.ts` існує в корені проекту
- [ ] Proxy налаштовано на `https://mdev.alwaysdata.net`
- [ ] `API_BASE_URL` використовує `/api` в development
- [ ] Dev server перезапущено після змін конфігурації
- [ ] Network tab показує запити до `localhost:5173/api/*`
- [ ] Немає CORS помилок в консолі

---

## Команди

```bash
# Запустити dev server з проксі
npm run dev

# Build для production (без проксі)
npm run build

# Preview production build локально
npm run preview
```

---

## Додаткові ресурси

- [Vite Server Options - Proxy](https://vitejs.dev/config/server-options.html#server-proxy)
- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Understanding CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

---

**Дата:** 24 листопада 2024  
**Версія Vite:** 5.x+  
**Backend API:** https://mdev.alwaysdata.net
