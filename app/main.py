import os

from fastapi import FastAPI
from routes import router as items_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

ENV = os.getenv('APP_ENV', 'dev')

if ENV == "dev":
    allowed = ["*"]
else:
    allowed = ["https://crm.dzyga-catering.com.ua"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(items_router)
