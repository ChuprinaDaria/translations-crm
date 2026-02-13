# Інструкція: Виправлення проблеми з InPost API

## 🔴 Проблема
InPost API повертає помилку `401 - Token is missing or invalid` через неправильну конфігурацію API ключа.

## 🔍 Причина
В базі даних:
- `api_key='124089'` - це виглядає як organization_id, а **НЕ** JWT токен
- Код намагався використовувати `webhook_secret` як токен, але це **неправильно**

## ✅ Виправлення коду (вже зроблено)
Код було виправлено:
- `api_key` тепер правильно використовується для API автентифікації
- `webhook_secret` використовується тільки для верифікації webhook запитів
- `organization_id` використовується в URL запитів

## 🔧 Що потрібно зробити ВАМ:

### 1. Отримати правильний JWT токен від InPost

#### Де взяти токен:
1. Увійдіть в панель InPost: https://inpost.pl/
2. Перейдіть в **API Settings** (або **Ustawienia API**)
3. Знайдіть секцію **Organization Token** або **Access Token**
4. Згенеруйте або скопіюйте **JWT токен** (це буде довгий рядок, схожий на: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNCW...`)
5. Також знайдіть ваш **Organization ID** (це може бути число, наприклад `124089`)

### 2. Оновити налаштування в CRM

#### Варіант A: Через веб-інтерфейс (рекомендовано)
1. Відкрийте ваш CRM в браузері
2. Перейдіть в **Налаштування → InPost**
3. Вставте:
   - **API Key (Production)**: ваш JWT токен від InPost
   - **Organization ID**: ваш числовий ID організації (наприклад `124089`)
4. Збережіть

#### Варіант B: Через SQL запит
Якщо у вас є доступ до бази даних:

```sql
-- Оновіть api_key на СПРАВЖНІЙ JWT токен
UPDATE inpost_settings 
SET 
  api_key = 'ВАШ_JWT_ТОКЕН_ВІД_INPOST',
  organization_id = '124089',  -- Залиште як є, якщо це правильний ID
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;
```

**⚠️ ВАЖЛИВО**: Замініть `ВАШ_JWT_ТОКЕН_ВІД_INPOST` на справжній JWT токен з панелі InPost!

### 3. Перевірити налаштування

Після оновлення:
1. Перезапустіть backend (якщо потрібно): `docker-compose restart backend`
2. Спробуйте створити посилку знову
3. Перевірте логи: `docker-compose logs -f backend | grep -i inpost`

Ви повинні побачити:
```
[InPost] get_api_key: Using api_key (JWT token), length: XXX
[InPost] Response status: 200  # або 201
```

## 📝 Додаткова інформація

### Що означають поля:
- **api_key**: JWT токен (Organization Token) для API автентифікації - **ОБОВ'ЯЗКОВЕ**
- **organization_id**: Числовий ID організації (використовується в URL запитів) - **ОБОВ'ЯЗКОВЕ**
- **webhook_secret**: Секретний ключ для верифікації webhook запитів від InPost - **ОПЦІОНАЛЬНЕ**
- **webhook_url**: URL для отримання webhook від InPost - **ОПЦІОНАЛЬНЕ**

### Приклад правильних налаштувань:
```
api_key: eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNCWldXMU1nNWVCekNhTVdTcm9OUGNFYW94WldxbVRrYW5lUHdfb3UtbG8ifQ.eyJleHAiOjIwODU4MTgyOTQsImlhdCI6MTc3MzM0NDI5NCwianRpIjoiMTIzNDU2Nzg5MCIsImlzcyI6Imh0dHBzOi8vbG9naW4uaW5wb3N0LnBsL2F1dGgvcmVhbG1zL2V4dGVybmFsIiwiYXVkIjoic2hpcHgtYXBpIiwic3ViIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJzaGlweC1hcGkiLCJzZXNzaW9uX3N0YXRlIjoiYWJjZGVmLTEyMzQtNTY3OC05MGFiLWNkZWYxMjM0NTY3OCIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib3JnYW5pemF0aW9uLW1lbWJlciJdfSwic2NvcGUiOiJvcmdhbml6YXRpb24tc2NvcGUiLCJvcmdhbml6YXRpb24iOjEyNDA4OX0.VFGfOc1HAKD1jHxRtthN-oUo2qcPhKaxgm67BtIvitW2yG93V9msbZgBOlf3ijKZM3CRFzdASK20m21gL3Azu8BTJ4C05JmXQx1kWMDFYZq8D5iTsyEYPnJmpx9q_X5UVaQdJZxxQbUXIXk8UKrVw
organization_id: 124089
sandbox_mode: false
is_enabled: true
```

## ❓ Питання чи проблеми?

Якщо після виконання цих кроків проблема залишається:
1. Перевірте, що JWT токен скопійовано повністю (без зайвих пробілів)
2. Перевірте, що токен не застарів (деякі токени мають термін дії)
3. Перевірте, що ви використовуєте правильний API URL (production vs sandbox)
4. Перегляньте повні логи для додаткових помилок

## 🔗 Корисні посилання
- [InPost Developer Portal](https://developer.inpost.pl/)
- [InPost API Documentation](https://dokumentacja-inpost.atlassian.net/)

