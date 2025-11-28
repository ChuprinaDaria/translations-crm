import os
from pathlib import Path

import db
from db import SessionLocal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import crud
import schema
from routes import router as items_router


app = FastAPI()

# Базова директорія модуля `app` і абсолютний шлях до `uploads`
BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = BASE_DIR / "uploads"


def init_default_template():
    """Ініціалізує дефолтний шаблон якщо він не існує."""
    session = SessionLocal()
    try:
        # Перевіряємо чи є дефолтний шаблон
        default_template = crud.get_default_template(session)
        if not default_template:
            # Перевіряємо чи існує файл commercial-offer.html в директорії uploads
            template_path = UPLOADS_DIR / "commercial-offer.html"
            if template_path.exists():
                template_data = schema.TemplateCreate(
                    name="Стандартний шаблон",
                    filename="commercial-offer.html",
                    description="Стандартний шаблон комерційної пропозиції",
                    is_default=True,
                )
                crud.create_template(session, template_data)
                print("Default template created successfully")
            else:
                print(f"Warning: Template file not found at {template_path}")
    except Exception as e:
        print(f"Error initializing default template: {e}")
    finally:
        session.close()


ENV = os.getenv("APP_ENV", "dev")

# Тимчасово дозволяємо всі origins для тесту
allowed = ["*"]
# if ENV == "dev":
#     allowed = ["*"]
# else:
#     # Production CORS - allow frontend from dzyga-catering.com.ua
#     allowed = [
#         "https://crm.dzyga-catering.com.ua",
#         "http://157.180.36.97",
#         "http://157.180.36.97:8000",
#         "http://157.180.36.97:8080",
#         "https://157.180.36.97:8443"
#     ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items_router)


"""
Ініціалізація директорій для статичних файлів
"""
# Основна директорія uploads та піддиректорії
photos_dir = UPLOADS_DIR / "photos"
photos_dir.mkdir(parents=True, exist_ok=True)

template_previews_dir = UPLOADS_DIR / "template-previews"
template_previews_dir.mkdir(parents=True, exist_ok=True)

branding_dir = UPLOADS_DIR / "branding"
branding_dir.mkdir(parents=True, exist_ok=True)

# Монтуємо статичні файли (віддаємо все, що лежить в uploads)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


# Ініціалізуємо дефолтний шаблон при старті
@app.on_event("startup")
async def startup_event():
    init_default_template()
