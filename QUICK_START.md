# 🚀 CRM Translation - Швидкий старт

## ✅ Система запущена та готова до роботи!

### 📊 Статус сервісів:

| Сервіс | Адреса | Статус |
|--------|--------|--------|
| 🗄️ **PostgreSQL** | `localhost:5434` | ✅ Працює |
| 🔧 **Backend (FastAPI)** | http://localhost:8000 | ✅ Працює |
| 📚 **API Docs (Swagger)** | http://localhost:8000/docs | ✅ Доступні |
| 💻 **Frontend (React)** | http://localhost:5173 | ✅ Працює |

---

## 🔐 Облікові дані

### База даних PostgreSQL:
```
Host: localhost
Port: 5434
Database: crm_db
Username: translator
Password: traslatorini2025
```

### Підключення:
```bash
psql -h localhost -p 5434 -U translator -d crm_db
```

---

## 🎯 Швидкі посилання

### Frontend:
- **Головна:** http://localhost:5173
- **CRM Kanban:** http://localhost:5173 → CRM → Kanban
- **Замовлення:** http://localhost:5173 → Замовлення
- **Клієнти:** http://localhost:5173 → Clients
- **Перекладачі:** http://localhost:5173 → Translators
- **Налаштування:** http://localhost:5173 → Settings

### Backend API:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **OpenAPI JSON:** http://localhost:8000/openapi.json

---

## 🛠️ Управління сервісами

### Запуск:
```bash
# Запустити все
./start-all.sh

# Або окремо:
./start-backend.sh    # Запустити бекенд
./start-frontend.sh   # Запустити фронтенд
```

### Перегляд логів:
```bash
./view-logs.sh        # Логи backend та frontend в реальному часі
```

### Зупинка:
```bash
# Зупинити бекенд
pkill -f "uvicorn"

# Зупинити фронтенд
pkill -f "vite"
```

---

## 🐛 Виправлені проблеми

### ✅ Проблема з імпортом (16.01.2026)
**Помилка:** `ImportError: cannot import name 'get_current_user_from_token'`

**Рішення:** Видалено невикористаний імпорт з `backend/modules/notifications/router.py`

**Файл:** 
```python
# backend/modules/notifications/router.py
# Було:
from modules.auth.dependencies import get_current_user_from_token

# Стало:
# (імпорт видалено, бо не використовувався)
```

---

## 📁 Структура проекту

```
translations-crm/
├── backend/                    # FastAPI бекенд
│   ├── main.py                # Точка входу
│   ├── modules/               # Модулі (auth, crm, finance, etc.)
│   ├── core/                  # Конфігурація, DB, Security
│   └── venv/                  # Python virtual environment
│
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── modules/          # Модулі (crm, finance, etc.)
│   │   ├── components/       # UI компоненти
│   │   └── main.tsx          # Точка входу
│   └── package.json
│
├── database/                  # PostgreSQL
│   └── migrations/           # Міграції та seed дані
│
├── start-backend.sh          # Скрипт запуску бекенду
├── start-frontend.sh         # Скрипт запуску фронтенду
├── view-logs.sh              # Перегляд логів
├── CRM_IMPLEMENTATION_STATUS.md   # Детальний статус проекту
└── QUICK_START.md            # Цей файл
```

---

## 📚 API Endpoints (основні)

### 🔐 Auth
- `POST /auth/login` - Логін
- `POST /auth/register` - Реєстрація

### 👥 Клієнти
- `GET /api/v1/crm/clients` - Список клієнтів
- `POST /api/v1/crm/clients` - Створити клієнта
- `GET /api/v1/crm/clients/{id}` - Деталі клієнта

### 📦 Замовлення
- `GET /api/v1/crm/orders` - Список замовлень
- `POST /api/v1/crm/orders` - Створити замовлення
- `GET /api/v1/crm/orders/{id}` - Деталі замовлення
- `PATCH /api/v1/crm/orders/{id}` - Оновити замовлення

### 🌍 Перекладачі
- `GET /api/v1/crm/translators` - Список перекладачів
- `POST /api/v1/crm/translators` - Додати перекладача

### 📝 Нотатки
- `GET /api/v1/crm/notes` - Список нотаток
- `POST /api/v1/crm/notes` - Створити нотатку

### 🏢 Офіси
- `GET /api/v1/crm/offices` - Список офісів
- `POST /api/v1/crm/offices` - Додати офіс

---

## 🎓 Корисні команди

### Backend (Python):
```bash
# Активувати venv
cd backend && source venv/bin/activate

# Встановити залежності
pip install -r requirements.txt

# Запустити в dev режимі
uvicorn main:app --reload --port 8000

# Створити міграцію (якщо використовуєте Alembic)
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Frontend (Node.js):
```bash
cd frontend

# Встановити залежності
npm install

# Запустити dev сервер
npm run dev

# Зібрати для production
npm run build

# Перевірити збірку
npm run preview
```

### Database:
```bash
# Підключитися до PostgreSQL
psql -h localhost -p 5434 -U translator -d crm_db

# Експорт бази даних
pg_dump -h localhost -p 5434 -U translator crm_db > backup.sql

# Імпорт бази даних
psql -h localhost -p 5434 -U translator crm_db < backup.sql
```

---

## 🎉 Готово!

Система повністю запущена та готова до використання. 

**Для початку роботи відкрийте:** http://localhost:5173

**Для перегляду API:** http://localhost:8000/docs

---

**Дата створення:** 16 січня 2026  
**Версія:** 1.0
