"""
Database connection and session management.
"""
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from core.config import settings

# Initialize Base
Base = declarative_base()

# Create engine
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=20,
    max_overflow=40,
    pool_recycle=3600,
    echo=False,
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency for getting database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create tables."""
    # Import all models to register them with Base
    import models  # noqa: F401
    
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")


def check_migrations():
    """Check and apply lightweight migrations if needed."""
    try:
        insp = inspect(engine)
        # Add any lightweight migrations here if needed
        # Example: check if column exists, add if not
        pass
    except Exception as e:
        print(f"Warning: migration check failed: {e}")

