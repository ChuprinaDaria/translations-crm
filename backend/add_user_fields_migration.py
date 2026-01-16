#!/usr/bin/env python3
"""
Migration script to add missing fields to users table
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from sqlalchemy import create_engine, text, inspect

def run_migration():
    """Add missing columns to users table"""
    from core.config import settings
    
    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check existing columns
        inspector = inspect(engine)
        if "users" not in inspector.get_table_names():
            print("❌ Table 'users' does not exist!")
            return
        
        existing_columns = {col["name"] for col in inspector.get_columns("users")}
        print(f"📋 Existing columns: {sorted(existing_columns)}")
        
        # Columns to add
        columns_to_add = {
            "first_name": "ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR",
            "last_name": "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR",
            "phone": "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR",
            "role": "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR DEFAULT 'user'",
            "department": "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR",
            "totp_secret": "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR",
            "is_admin": "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
            "created_at": "ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP",
            "last_login": "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE",
        }
        
        print("\n🔧 Adding missing columns...")
        for col_name, sql in columns_to_add.items():
            if col_name not in existing_columns:
                try:
                    conn.execute(text(sql))
                    conn.commit()
                    print(f"  ✓ Added column: {col_name}")
                except Exception as e:
                    print(f"  ✗ Error adding {col_name}: {e}")
            else:
                print(f"  ⊙ Column {col_name} already exists")
        
        print("\n✅ Migration completed!")
        
        # Verify
        inspector = inspect(engine)
        final_columns = {col["name"] for col in inspector.get_columns("users")}
        print(f"\n📋 Final columns: {sorted(final_columns)}")

if __name__ == "__main__":
    run_migration()

