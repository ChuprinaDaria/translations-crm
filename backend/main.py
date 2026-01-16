from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from core.db import Base, engine
from core.config import settings
from modules.auth.router import router as auth_router
from modules.auth.models import User
from modules.crm.router import router as crm_router
from modules.crm.models import Client, Order, InternalNote, TimelineStep, Translator, TranslatorLanguage, TranslationRequest, Office
from modules.finance.router import router as finance_router
from modules.finance.models import Transaction
from modules.communications.router import router as communications_router
from modules.communications.models import Conversation, Message
from modules.notifications.router import router as notifications_router
from modules.notifications.models import Notification, NotificationSettings
from modules.smart_paste.router import router as smart_paste_router
from modules.drag_upload.router import router as drag_upload_router
from modules.audio_notes.router import router as audio_notes_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="CRM System",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc)}
    )


app.include_router(auth_router, prefix="/auth")
app.include_router(crm_router, prefix="/api/v1/crm")
app.include_router(finance_router, prefix="/api/v1/finance")
app.include_router(communications_router, prefix="/api/v1/inbox")
app.include_router(notifications_router, prefix="/api/v1/notifications")
app.include_router(smart_paste_router, prefix="/api/v1")
app.include_router(drag_upload_router, prefix="/api/v1")
app.include_router(audio_notes_router, prefix="/api/v1")
