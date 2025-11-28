import os
import db
from fastapi import FastAPI
from routes import router as items_router
from fastapi.middleware.cors import CORSMiddleware
from db import SessionLocal
import crud
import schema

app = FastAPI()

def init_default_template():
    """Ініціалізує дефолтний шаблон якщо він не існує"""
    db = SessionLocal()
    try:
        # Перевіряємо чи є дефолтний шаблон
        default_template = crud.get_default_template(db)
        if not default_template:
            # Перевіряємо чи існує файл commercial-offer.html
            template_path = "app/uploads/commercial-offer.html"
            if os.path.exists(template_path):
                template_data = schema.TemplateCreate(
                    name="Стандартний шаблон",
                    filename="commercial-offer.html",
                    description="Стандартний шаблон комерційної пропозиції",
                    is_default=True
                )
                crud.create_template(db, template_data)
                print("Default template created successfully")
            else:
                print(f"Warning: Template file not found at {template_path}")
    except Exception as e:
        print(f"Error initializing default template: {e}")
    finally:
        db.close()

ENV = os.getenv('APP_ENV', 'dev')

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

# Монтуємо статичні файли для фото
from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Створюємо директорії для фото та прев'ю якщо не існують
photos_dir = Path("app/uploads/photos")
photos_dir.mkdir(parents=True, exist_ok=True)

template_previews_dir = Path("app/uploads/template-previews")
template_previews_dir.mkdir(parents=True, exist_ok=True)

# Монтуємо статичні файли
app.mount("/uploads", StaticFiles(directory="app/uploads"), name="uploads")

# Ініціалізуємо дефолтний шаблон при старті
@app.on_event("startup")
async def startup_event():
    init_default_template()
