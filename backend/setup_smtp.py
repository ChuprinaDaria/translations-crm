#!/usr/bin/env python3
"""
Script to configure SMTP settings in the database
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from core.database import SessionLocal, engine
from sqlalchemy import text
import models
import crud

# SMTP Configuration
SMTP_CONFIG = {
    "smtp_host": "serwer2555348.home.pl",
    "smtp_port": "587",
    "smtp_user": "info@lazysoft.pl",
    "smtp_password": "Severussnape1987?",
    "smtp_from_email": "info@lazysoft.pl",
    "smtp_from_name": "TEST",
}

def create_app_settings_table():
    """Create app_settings table if it doesn't exist"""
    with engine.connect() as conn:
        # Check if table exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'app_settings'
            );
        """))
        exists = result.scalar()
        
        if not exists:
            print("📋 Creating app_settings table...")
            conn.execute(text("""
                CREATE TABLE app_settings (
                    key VARCHAR PRIMARY KEY,
                    value TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE
                );
            """))
            conn.commit()
            print("  ✓ Table created")
        else:
            print("  ✓ Table already exists")

def setup_smtp():
    """Configure SMTP settings in the database"""
    # Create table if needed
    create_app_settings_table()
    
    db = SessionLocal()
    try:
        print("\n🔧 Configuring SMTP settings...")
        
        for key, value in SMTP_CONFIG.items():
            crud.set_setting(db, key, value)
            print(f"  ✓ {key} = {value}")
        
        db.commit()
        print("\n✅ SMTP settings configured successfully!")
        
        # Verify settings
        print("\n📋 Verifying settings...")
        settings = crud.get_smtp_settings(db)
        for key in SMTP_CONFIG.keys():
            value = settings.get(key, "NOT SET")
            # Mask password
            if "password" in key:
                value = "***" if value else "NOT SET"
            print(f"  {key}: {value}")
            
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error configuring SMTP: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    setup_smtp()

