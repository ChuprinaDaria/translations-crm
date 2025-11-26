import os

from fastapi import FastAPI
from routes import router as items_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

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
