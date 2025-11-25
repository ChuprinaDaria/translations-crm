# Пояснення структури API клієнта

## Архітектура `/lib/api.ts`

Весь API клієнт побудований на базі **однієї центральної функції** `apiFetch`, яка обробляє всі запити.

---

## 1. Базова функція `apiFetch<T>`

Це ядро всього API клієнта - універсальна обгортка навколо `fetch`:

```typescript
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // 1. Отримуємо токен з localStorage
  const token = tokenManager.getToken();
  
  // 2. Налаштовуємо заголовки
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 3. Додаємо Authorization якщо є токен
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 4. Виконуємо запит
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    mode: 'cors',
  });

  // 5. Обробка помилок
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    throw new ApiError(response.status, response.statusText, errorData);
  }

  // 6. Обробка різних типів відповідей
  
  // 6a. 204 No Content (видалення)
  if (response.status === 204) {
    return {} as T;
  }

  // 6b. Plain text (логін повертає просто токен)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/plain')) {
    const text = await response.text();
    return text as T;
  }

  // 6c. JSON (стандартна відповідь)
  return response.json();
}
```

**Ключові моменти:**
- ✅ Автоматично додає токен до всіх запитів
- ✅ Обробляє JSON і plain text відповіді
- ✅ Централізована обробка помилок
- ✅ TypeScript generic `<T>` для типізації відповідей

---

## 2. Як працюють різні типи запитів

### 2.1 GET запити (читання даних)

#### Приклад: Отримання списку товарів

```typescript
// В api.ts
export const itemsApi = {
  async getItems(skip = 0, limit = 50): Promise<Item[]> {
    return apiFetch<Item[]>(
      `/items?skip=${skip}&limit=${limit}`
    );
  }
}
```

**Що відбувається:**
1. `apiFetch` отримує endpoint: `/items?skip=0&limit=50`
2. В development: `fetch('/api/items?skip=0&limit=50')`
3. Vite proxy перетворює на: `https://mdev.alwaysdata.net/items?skip=0&limit=50`
4. Додається токен: `Authorization: Bearer eyJhbGc...`
5. Сервер повертає JSON масив `[{item1}, {item2}, ...]`
6. `apiFetch` парсить JSON і повертає `Item[]`

**Використання в компоненті:**
```typescript
const loadItems = async () => {
  try {
    const items = await itemsApi.getItems(0, 20);
    setItems(items); // items це Item[]
  } catch (error) {
    console.error(error);
  }
};
```

---

#### Приклад: Отримання одного товару

```typescript
async getItem(itemId: number): Promise<Item> {
  return apiFetch<Item>(`/items/${itemId}`);
}
```

**Запит:**
```
GET /api/items/123
Authorization: Bearer eyJhbGc...
```

**Відповідь:**
```json
{
  "id": 123,
  "name": "Канапе",
  "price": 45.00,
  ...
}
```

---

### 2.2 POST запити (створення даних)

#### Приклад: Створення товару

```typescript
async createItem(data: ItemCreate): Promise<Item> {
  return apiFetch<Item>('/items', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
```

**Що відбувається:**
1. `data` (JavaScript об'єкт) → `JSON.stringify(data)` → JSON string
2. `apiFetch` додає `Content-Type: application/json`
3. `apiFetch` додає `Authorization: Bearer ...`
4. `fetch` відправляє POST з body

**Запит:**
```
POST /api/items
Content-Type: application/json
Authorization: Bearer eyJhbGc...

{
  "name": "Канапе з лососем",
  "price": 45.00,
  "subcategory_id": 1,
  "active": true
}
```

**Відповідь:**
```json
{
  "id": 124,
  "name": "Канапе з лососем",
  "price": 45.00,
  ...
}
```

**Використання в компоненті:**
```typescript
const handleCreate = async () => {
  try {
    const newItem = await itemsApi.createItem({
      name: "Канапе з лососем",
      price: 45.00,
      subcategory_id: 1,
      active: true
    });
    
    toast.success("Товар створено!");
    setItems([...items, newItem]); // Додаємо в список
  } catch (error) {
    toast.error("Помилка створення");
  }
};
```

---

#### Приклад: Створення категорії

```typescript
async createCategory(name: string): Promise<Category> {
  return apiFetch<Category>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
```

**Запит:**
```
POST /api/categories
Content-Type: application/json
Authorization: Bearer eyJhbGc...

{ "name": "Десерти" }
```

---

### 2.3 PUT запити (оновлення даних)

#### Приклад: Оновлення товару

```typescript
async updateItem(itemId: number, data: Partial<ItemCreate>): Promise<Item> {
  return apiFetch<Item>(`/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}
```

**`Partial<ItemCreate>`** - TypeScript utility type, означає що всі поля optional.

**Запит:**
```
PUT /api/items/123
Content-Type: application/json
Authorization: Bearer eyJhbGc...

{
  "name": "Канапе з лососем (оновлено)",
  "price": 50.00
}
```

**Відповідь:** Оновлений об'єкт товару

**Використання:**
```typescript
const handleUpdate = async (itemId: number) => {
  try {
    const updatedItem = await itemsApi.updateItem(itemId, {
      price: 50.00, // Оновлюємо тільки ціну
    });
    
    // Оновлюємо в state
    setItems(items.map(item => 
      item.id === itemId ? updatedItem : item
    ));
    
    toast.success("Товар оновлено!");
  } catch (error) {
    toast.error("Помилка оновлення");
  }
};
```

---

### 2.4 DELETE запити (видалення даних)

#### Приклад: Видалення товару

```typescript
async deleteItem(itemId: number): Promise<string> {
  return apiFetch<string>(`/items/${itemId}`, {
    method: 'DELETE',
  });
}
```

**Запит:**
```
DELETE /api/items/123
Authorization: Bearer eyJhbGc...
```

**Відповідь:** Plain text string або 204 No Content

**Використання:**
```typescript
const handleDelete = async (itemId: number) => {
  if (!confirm("Ви впевнені?")) return;
  
  try {
    await itemsApi.deleteItem(itemId);
    
    // Видаляємо зі state
    setItems(items.filter(item => item.id !== itemId));
    
    toast.success("Товар видалено!");
  } catch (error) {
    toast.error("Помилка видалення");
  }
};
```

---

### 2.5 Спеціальний випадок: Логін (plain text response)

#### Чому логін особливий?

```typescript
async login(data: LoginRequest): Promise<string> {
  // Login returns plain string token, not JSON object
  const token = await apiFetch<string>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return token;
}
```

**Проблема:** Сервер повертає просто string, не JSON:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Замість:
```json
{ "token": "eyJhbGc..." }
```

**Рішення в `apiFetch`:**
```typescript
// Перевіряємо Content-Type
const contentType = response.headers.get('content-type');
if (contentType && contentType.includes('text/plain')) {
  const text = await response.text(); // Читаємо як текст
  return text as T;
}
```

**Використання:**
```typescript
const handleLogin = async () => {
  try {
    // token це просто string, не об'єкт
    const token = await authApi.login({ email, password, code });
    
    // Зберігаємо
    tokenManager.setToken(token);
    
    // Редирект
    navigate('/dashboard');
  } catch (error) {
    toast.error("Невірний логін");
  }
};
```

---

## 3. Запити з параметрами

### 3.1 Query parameters (в URL)

```typescript
// Підкатегорії з фільтром по категорії
async getSubcategories(categoryId?: number): Promise<Subcategory[]> {
  const params = categoryId ? `?category_id=${categoryId}` : '';
  return apiFetch<Subcategory[]>(`/subcategories${params}`);
}
```

**Використання:**
```typescript
// Всі підкатегорії
const allSubs = await subcategoriesApi.getSubcategories();
// GET /api/subcategories

// Підкатегорії категорії 5
const subs = await subcategoriesApi.getSubcategories(5);
// GET /api/subcategories?category_id=5
```

---

### 3.2 Path parameters (в URL)

```typescript
// ID в шляху
async getItem(itemId: number): Promise<Item> {
  return apiFetch<Item>(`/items/${itemId}`);
}

async deleteItem(itemId: number): Promise<string> {
  return apiFetch<string>(`/items/${itemId}`, {
    method: 'DELETE',
  });
}
```

**Використання:**
```typescript
const item = await itemsApi.getItem(123);
// GET /api/items/123

await itemsApi.deleteItem(456);
// DELETE /api/items/456
```

---

## 4. Обробка помилок

### 4.1 ApiError клас

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data?: any
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}
```

**Що зберігається:**
- `status` - HTTP код (401, 422, 500, ...)
- `statusText` - текстовий опис
- `data` - JSON відповідь від сервера (якщо є)

---

### 4.2 Обробка в компонентах

```typescript
try {
  const items = await itemsApi.getItems();
  setItems(items);
} catch (error: any) {
  // error це ApiError
  
  if (error.status === 401) {
    // Unauthorized - токен недійсний
    tokenManager.removeToken();
    navigate('/login');
    toast.error("Сесія закінчилась. Увійдіть знову");
  } 
  else if (error.status === 422) {
    // Validation error
    const detail = error.data?.detail || "Помилка валідації";
    toast.error(detail);
  } 
  else if (error.status === 404) {
    // Not found
    toast.error("Товар не знайдено");
  } 
  else if (error.status >= 500) {
    // Server error
    toast.error("Помилка сервера. Спробуйте пізніше");
  } 
  else {
    // Generic error
    toast.error(error.data?.detail || "Щось пішло не так");
  }
}
```

---

### 4.3 Валідаційні помилки (422)

Сервер може повертати:
```json
{
  "detail": [
    {
      "loc": ["body", "price"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Обробка:**
```typescript
if (error.status === 422) {
  const errors = error.data?.detail;
  if (Array.isArray(errors)) {
    errors.forEach(err => {
      const field = err.loc[err.loc.length - 1];
      toast.error(`${field}: ${err.msg}`);
    });
  }
}
```

---

## 5. Автоматична авторизація

### 5.1 tokenManager

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

### 5.2 Автоматичне додавання токену

В `apiFetch`:
```typescript
const token = tokenManager.getToken();

if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

**Це означає що:**
- Після логіну токен зберігається: `tokenManager.setToken(token)`
- Всі наступні запити **автоматично** отримують заголовок `Authorization`
- Не потрібно вручну додавати токен до кожного запиту

---

### 5.3 Lifecycle токену

```typescript
// 1. Логін
const token = await authApi.login({ email, password, code });
tokenManager.setToken(token); // Зберегли

// 2. Запити автоматично використовують токен
const items = await itemsApi.getItems(); // ✅ Токен додано автоматично
const categories = await categoriesApi.getCategories(); // ✅ Токен додано

// 3. Logout
authApi.logout(); // Видаляє tokenManager.removeToken()

// 4. Наступні запити без токену
const items = await itemsApi.getItems(); // ❌ 401 Unauthorized
```

---

## 6. Порівняння з іншими підходами

### Без API клієнта (погано ❌)

```typescript
const response = await fetch('https://mdev.alwaysdata.net/items', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  }
});

if (!response.ok) {
  // Обробка помилок...
}

const items = await response.json();
```

**Проблеми:**
- ❌ Повторюється код
- ❌ Забуваєш додати токен
- ❌ Немає централізованої обробки помилок
- ❌ Немає типізації

---

### З API клієнтом (добре ✅)

```typescript
const items = await itemsApi.getItems();
```

**Переваги:**
- ✅ Чистий код
- ✅ Автоматичний токен
- ✅ Централізована обробка помилок
- ✅ TypeScript типізація
- ✅ Легко змінити базовий URL
- ✅ Легко додати нові endpoints

---

## 7. Додавання нових endpoints

### Приклад: Додати API для замовлень

```typescript
// 1. Додати типи
export interface Order {
  id: number;
  customer_name: string;
  total: number;
  status: string;
  created_at: string;
}

export interface OrderCreate {
  customer_name: string;
  items: number[];
}

// 2. Додати API методи
export const ordersApi = {
  async getOrders(skip = 0, limit = 50): Promise<Order[]> {
    return apiFetch<Order[]>(`/orders?skip=${skip}&limit=${limit}`);
  },

  async getOrder(orderId: number): Promise<Order> {
    return apiFetch<Order>(`/orders/${orderId}`);
  },

  async createOrder(data: OrderCreate): Promise<Order> {
    return apiFetch<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateOrder(orderId: number, data: Partial<OrderCreate>): Promise<Order> {
    return apiFetch<Order>(`/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteOrder(orderId: number): Promise<string> {
    return apiFetch<string>(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  }
};

// 3. Використовувати в компонентах
const orders = await ordersApi.getOrders();
const newOrder = await ordersApi.createOrder({ customer_name: "Іван", items: [1, 2, 3] });
```

---

## 8. Best Practices

### ✅ Завжди обробляй помилки

```typescript
try {
  const items = await itemsApi.getItems();
  setItems(items);
} catch (error) {
  console.error(error);
  toast.error("Помилка завантаження");
}
```

### ✅ Використовуй loading states

```typescript
const [loading, setLoading] = useState(false);

const loadItems = async () => {
  setLoading(true);
  try {
    const items = await itemsApi.getItems();
    setItems(items);
  } catch (error) {
    toast.error("Помилка");
  } finally {
    setLoading(false); // Завжди виконується
  }
};
```

### ✅ Перевіряй 401 для редиректу

```typescript
if (error.status === 401) {
  tokenManager.removeToken();
  navigate('/login');
}
```

### ✅ Типізуй все

```typescript
// ✅ Добре
const items: Item[] = await itemsApi.getItems();

// ❌ Погано
const items: any = await itemsApi.getItems();
```

### ✅ Використовуй async/await замість .then()

```typescript
// ✅ Добре
const items = await itemsApi.getItems();

// ❌ Погано
itemsApi.getItems().then(items => { ... });
```

---

## Висновок

**Ключові переваги такої архітектури:**

1. **Один файл (`/lib/api.ts`)** - вся логіка API
2. **Функція `apiFetch`** - універсальна обгортка навколо fetch
3. **Автоматичний токен** - не треба вручну додавати до кожного запиту
4. **Типізація** - TypeScript знає структуру даних
5. **Централізована обробка помилок** - всі 401, 422, 500 в одному місці
6. **Легко розширювати** - додавання нових endpoints займає 5 хвилин

**Структура:**
```
apiFetch (базова функція)
    ↓
authApi, itemsApi, categoriesApi, subcategoriesApi (групи методів)
    ↓
Компоненти (використовують API)
```

Всі запити проходять через `apiFetch` → автоматично отримують токен, headers, обробку помилок → повертають типізовані дані.
