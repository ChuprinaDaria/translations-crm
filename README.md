# Cafe CRM Backend

FastAPI backend для CRM системи кафе.

## Структура проєкту

```
app/
├── main.py          # Точка входу FastAPI
├── routes.py        # API endpoints
├── models.py        # SQLAlchemy моделі
├── schema.py        # Pydantic схеми
├── db.py           # Конфігурація бази даних
├── crud.py         # CRUD операції для items/KP
├── crud_user.py    # CRUD операції для users
├── requirements.txt # Python залежності
└── uploads/        # Шаблони для PDF генерації
```

## Встановлення та запуск

### З Docker (рекомендовано)

1. Створіть `.env` файл в директорії `app/`:
```env
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here
APP_ENV=dev
```

2. Запустіть через Docker Compose:
```bash
cd app
docker-compose up -d --build
```

3. Або через Docker:
```bash
cd app
docker build -t cafe-backend .
docker run -p 8000:8000 --env-file .env cafe-backend
```

### Без Docker

1. Створіть віртуальне середовище:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

2. Встановіть залежності:
```bash
pip install -r app/requirements.txt
```

3. Створіть `.env` файл з необхідними змінними

4. Запустіть сервер:
```bash
cd app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

- `GET /docs` - Swagger документація
- `POST /auth/register` - Реєстрація користувача
- `POST /auth/login` - Вхід в систему
- `GET /items` - Список товарів
- `POST /items` - Створення товару
- `GET /kp` - Список комерційних пропозицій
- `POST /kp` - Створення КП
- `GET /kp/{kp_id}/pdf` - Генерація PDF для КП

## База даних

Використовується PostgreSQL. Моделі автоматично створюються при першому запуску.

## Змінні оточення

- `DATABASE_URL` - URL підключення до PostgreSQL
- `JWT_SECRET` - Секретний ключ для JWT токенів
- `APP_ENV` - Середовище (dev/prod)

