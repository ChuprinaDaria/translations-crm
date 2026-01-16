# Database connection will be here

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os 

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', '')

# Initialize Base first
Base = declarative_base()

# Create engine and session
if DATABASE_URL:
    try:
        engine = create_engine(DATABASE_URL)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

        import models
        
        Base.metadata.create_all(bind=engine)

        # --- Lightweight auto-migrations (safe add-column) ---
        # Ми не використовуємо Alembic, тому робимо мінімальні міграції для критичних полів.
        try:
            insp = inspect(engine)
            if "recipes" in insp.get_table_names():
                cols = {c["name"] for c in insp.get_columns("recipes")}
                if "notes" not in cols:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE recipes ADD COLUMN notes TEXT"))
        except Exception as e:
            # Не блокуємо старт, якщо міграція не вдалась (може бути керована вручну).
            print(f"Warning: auto-migration skipped/failed: {e}")

        print("Database setup completed successfully.")
    except Exception as e:
        print(f"Error setting up the database: {e}")
        # Create a dummy engine if connection fails (for development)
        engine = create_engine("sqlite:///./temp.db")
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        try:
            import models
            Base.metadata.create_all(bind=engine)
            insp = inspect(engine)
            if "recipes" in insp.get_table_names():
                cols = {c["name"] for c in insp.get_columns("recipes")}
                if "notes" not in cols:
                    with engine.begin() as conn:
                        conn.execute(text("ALTER TABLE recipes ADD COLUMN notes TEXT"))
        except Exception as e2:
            print(f"Warning: fallback DB auto-migration skipped/failed: {e2}")
else:
    # Fallback for development
    engine = create_engine("sqlite:///./temp.db")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    print("Warning: DATABASE_URL not set, using SQLite fallback")
    try:
        import models
        Base.metadata.create_all(bind=engine)
        insp = inspect(engine)
        if "recipes" in insp.get_table_names():
            cols = {c["name"] for c in insp.get_columns("recipes")}
            if "notes" not in cols:
                with engine.begin() as conn:
                    conn.execute(text("ALTER TABLE recipes ADD COLUMN notes TEXT"))
    except Exception as e:
        print(f"Warning: fallback DB auto-migration skipped/failed: {e}")
