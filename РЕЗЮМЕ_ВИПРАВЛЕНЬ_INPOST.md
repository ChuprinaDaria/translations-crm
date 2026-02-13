# Резюме: Виправлення помилки InPost API

## 🔴 Що було не так

InPost API повертав помилку `401 - Token is missing or invalid` через **неправильну конфігурацію автентифікації**.

### Проблеми:
1. ❌ В базі даних `api_key='124089'` - це organization_id, а **НЕ** JWT токен
2. ❌ Код намагався використовувати `webhook_secret` як JWT токен для API автентифікації
3. ❌ Плутанина між призначенням різних полів

## ✅ Що було виправлено

### 1. Код оновлено:
- ✅ `get_api_key()` метод тепер правильно використовує `api_key` для автентифікації
- ✅ `webhook_secret` використовується **ТІЛЬКИ** для верифікації webhook запитів
- ✅ Оновлено коментарі в моделях та схемах для ясності

### 2. Файли змінено:
- `/backend/modules/postal_services/service.py` - виправлено логіку `get_api_key()`
- `/backend/modules/postal_services/models.py` - оновлено коментарі полів
- `/backend/modules/postal_services/schemas.py` - оновлено описи в API схемах
- `INPOST_ШВИДКИЙ_СТАРТ.md` - додано важливі уточнення

### 3. Створено нові файли:
- `ІНСТРУКЦІЯ_ВИПРАВЛЕННЯ_INPOST.md` - детальна інструкція для виправлення
- `database/migrations/fix_inpost_api_key.sql` - SQL скрипт для оновлення бази даних
- `РЕЗЮМЕ_ВИПРАВЛЕНЬ_INPOST.md` - цей файл

## 🔧 Що ПОТРІБНО ЗРОБИТИ ВАМ зараз

### Крок 1: Отримати правильні дані з панелі InPost

1. Увійдіть на https://inpost.pl/
2. Перейдіть в **API Settings** (або **Ustawienia API**)
3. Скопіюйте:
   - **Organization Token** (JWT токен) - це довгий рядок ~200+ символів
   - **Organization ID** - це числовий ID (наприклад `124089`)

### Крок 2: Оновити налаштування

#### Варіант A: Через веб-інтерфейс (РЕКОМЕНДОВАНО)
1. Відкрийте ваш CRM
2. Налаштування → InPost
3. Вставте:
   - **Production API Key**: ваш JWT токен
   - **Organization ID**: `124089` (або ваш ID)
4. Збережіть

#### Варіант B: Через SQL
```bash
# Підключіться до бази даних
docker exec -it crm_translations_db psql -U postgres -d crm_db

# Виконайте (замінивши YOUR_JWT_TOKEN на справжній токен):
UPDATE inpost_settings 
SET 
  api_key = 'YOUR_REAL_JWT_TOKEN_FROM_INPOST',
  organization_id = '124089',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

# Перевірте
SELECT id, LENGTH(api_key) as token_length, organization_id, is_enabled 
FROM inpost_settings;
```

### Крок 3: Перезапустити backend
```bash
docker-compose restart backend
```

### Крок 4: Перевірити
```bash
# Дивіться логи
docker-compose logs -f backend | grep -i inpost

# Шукайте:
# ✅ [InPost] get_api_key: Using api_key (JWT token), length: XXX
# ✅ [InPost] Response status: 200 (або 201)

# Якщо бачите:
# ❌ [InPost] Response status: 401
# Тоді перевірте, що JWT токен скопійовано правильно
```

### Крок 5: Спробувати створити посилку
Створіть тестову посилку через ваш CRM інтерфейс.

## 📝 Що означають поля

| Поле | Призначення | Приклад | Обов'язкове |
|------|-------------|---------|-------------|
| `api_key` | JWT токен для API автентифікації | `eyJhbGciOiJSUzI...` (~200+ символів) | ✅ ТАК |
| `organization_id` | Числовий ID для URL запитів | `124089` | ✅ ТАК |
| `webhook_secret` | Секрет для webhook верифікації | `my-secret-123` | ❌ Опціонально |
| `webhook_url` | URL для отримання webhook | `https://domain.com/api/v1/...` | ❌ Опціонально |

## ⚠️ ВАЖЛИВО

### Що таке JWT токен?
JWT токен (Organization Token) - це **довгий рядок** (~200-500 символів), який виглядає так:
```
eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJzQlpXVzFNZzVlQnpDYU1XU3JvTlBjRWFveFpXcW9Ua2FuZVB3X291LWxvIn0.eyJleHAiOjIwODU4MTgyOTQsImlhdCI6MTc3MzM0NDI5NCwianRpIjoiYWJjZGVmMTIzNDU2IiwiaXNzIjoiaHR0cHM6Ly9sb2dpbi5pbnBvc3QucGwvYXV0aC9yZWFsbXMvZXh0ZXJuYWwiLCJhdWQiOiJzaGlweC1hcGkiLCJzdWIiOiJhYmNkZWYxMjM0NTYiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzaGlweC1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiYWJjZGVmLTEyMzQtNTY3OC05MGFiLWNkZWYiLCJhY3IiOiIxIiwicmVhbG1fYWNjZXNzIjp7InJvbGVzIjpbIm9yZ2FuaXphdGlvbi1tZW1iZXIiXX0sInNjb3BlIjoib3JnYW5pemF0aW9uLXNjb3BlIiwib3JnYW5pemF0aW9uIjoxMjQwODl9.VFGfOc1HAKD1jHxRtthN-oUo2qcPhKaxgm67BtIvitW2yG93V9msbZgBOlf3ijKZM3CRFzdASK20m21gL3Azu8BTJ4C05JmXQx1kWMDFYZq8D5iTsyEYPnJmpx9q_X5UVaQdJZxxQbUXIXk8UKrVw
```

### Різниця між полями:
- **`api_key`** = JWT токен (для API запитів)
- **`organization_id`** = Числовий ID (для URL)
- **`webhook_secret`** = Секрет (для webhook, НЕ для API!)

### ❌ НЕПРАВИЛЬНО:
```
api_key = '124089'  # Це organization_id, а не JWT токен!
```

### ✅ ПРАВИЛЬНО:
```
api_key = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIs...'  # JWT токен
organization_id = '124089'  # Числовий ID
```

## 🔗 Корисні посилання

- [InPost Portal](https://inpost.pl/)
- [InPost Developer Portal](https://developer.inpost.pl/)
- [API Documentation](https://dokumentacja-inpost.atlassian.net/)

## ❓ Питання?

Якщо після виконання всіх кроків проблема залишається:
1. Перевірте логи детально: `docker-compose logs backend | grep -A 20 -B 5 "inpost"`
2. Перевірте, що JWT токен не застарів
3. Перевірте, що ви використовуєте правильний API endpoint (production vs sandbox)
4. Подивіться детальну інструкцію в `ІНСТРУКЦІЯ_ВИПРАВЛЕННЯ_INPOST.md`

---

**Дата виправлення:** 13.02.2026  
**Статус:** ✅ Код виправлено, потрібно оновити конфігурацію в БД

