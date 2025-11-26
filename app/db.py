# Database connection will be here

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv
import os 

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', '')

try:
    engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()

    import models
    
    Base.metadata.create_all(bind=engine)

    print("Database setup completed successfully.")

except Exception as e:
    print(f"Error setting up the database: {e}")
