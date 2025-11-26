## Installation

### Using Docker (Recommended)

1. Create `.env` file with the following variables:
```
DATABASE_URL=postgresql://postgres@localhost:5432/cafe_local
JWT_SECRET=PUT_JWT_HERE
APP_ENV=dev
```

2. Build and run with Docker Compose:
```bash
docker-compose up -d --build
```

3. Or build and run with Docker directly:
```bash
docker build -t cafe-backend .
docker run -p 8000:8000 --env-file .env cafe-backend
```

### Manual Installation

1. Create virtual env via `python3 -m venv .venv`
2. Activate virtual environment via `source .venv/bin/activate`
3. Create .env with the following variables

`DATABASE_URL=postgresql://postgres@localhost:5432/cafe_local`

`JWT_SECRET = PUT_JWT_HERE`

`APP_ENV = dev` <= either "prod" or "dev"

4. Make sure to install all dependencies with `pip3 install -r requirements.txt`
5. (Optional) If you caught an error with WeasyPrint, feel free to check: https://doc.courtbouillon.org/weasyprint/stable/first_steps.html#installation (but imho on Linux there's should be no problem with it though)

## Running

With Docker:
```bash
docker-compose up
```

Without Docker:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API will be available at `http://localhost:8000`
Documentation at `http://localhost:8000/docs`

