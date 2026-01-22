#!/usr/bin/env python3
"""
Script to run the languages system migration
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from core.config import settings

def run_migration():
    """Run the languages system migration"""
    print("🚀 Running languages system migration...")
    
    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    
    # Read migration file
    base_dir = Path(__file__).parent.parent
    migration_file = base_dir / "database" / "migrations" / "add_languages_system.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    print(f"📄 Reading: {migration_file.name}")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Execute migration
        with engine.begin() as conn:
            conn.execute(text(sql_content))
        
        print("✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        error_msg = str(e)
        # Some errors are expected (e.g., table already exists)
        if any(ignore in error_msg.lower() for ignore in [
            'already exists', 'duplicate', 'does not exist',
            'relation already exists', 'column already exists',
            'undefined table', 'undefined column'
        ]):
            print(f"⚠️  Warning: {error_msg[:100]}... (may already be applied)")
            return True
        else:
            print(f"❌ Error: {error_msg}")
            return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)

