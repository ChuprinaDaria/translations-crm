# Database connection will be here

from sqlalchemy import create_engine
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

        print("Database setup completed successfully.")
    except Exception as e:
        print(f"Error setting up the database: {e}")
        # Create a dummy engine if connection fails (for development)
        engine = create_engine("sqlite:///./temp.db")
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    # Fallback for development
    engine = create_engine("sqlite:///./temp.db")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    print("Warning: DATABASE_URL not set, using SQLite fallback")
