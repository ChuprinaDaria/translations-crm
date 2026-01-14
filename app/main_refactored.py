"""
Main application entry point - модульна версія.
Збирає роути з усіх модулів.
"""
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from core.config import settings
from core.database import init_db, check_migrations
from core.middleware import setup_cors

# Import routers from modules
from modules.auth.router import router as auth_router
from modules.communications.router import router as communications_router
from modules.crm.router import router as crm_router
from modules.finance.router import router as finance_router
from modules.analytics.router import router as analytics_router

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version="2.0.0",
    debug=settings.DEBUG,
)

# Setup CORS
setup_cors(app)

# Include routers from modules
app.include_router(auth_router)
app.include_router(communications_router)
app.include_router(crm_router)
app.include_router(finance_router)
app.include_router(analytics_router)

# Mount static files
uploads_dir = settings.UPLOADS_DIR
uploads_dir.mkdir(parents=True, exist_ok=True)

# Create subdirectories
(uploads_dir / "photos").mkdir(exist_ok=True)
(uploads_dir / "template-previews").mkdir(exist_ok=True)
(uploads_dir / "branding").mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    init_db()
    check_migrations()
    print(f"🚀 {settings.APP_NAME} started in {settings.APP_ENV} mode")


@app.get("/")
def root():
    """Root endpoint."""
    return {
        "app": settings.APP_NAME,
        "version": "2.0.0",
        "modules": [
            "auth",
            "communications",
            "crm",
            "finance",
            "analytics",
        ],
    }

