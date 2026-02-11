#!/usr/bin/env python3
"""
Script to apply organization_id migration for InPost settings
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text

sys.path.insert(0, str(Path(__file__).parent))

from core.config import settings

def apply_migration():
    """Apply organization_id migration"""
    print("🚀 Applying organization_id migration for InPost settings...")
    
    engine = create_engine(settings.DATABASE_URL)
    
    migration_file = Path(__file__).parent.parent / "database" / "migrations" / "add_organization_id_to_inpost_settings.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    print(f"📄 Reading: {migration_file.name}")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        with engine.begin() as conn:
            conn.execute(text(sql_content))
        
        print("✅ Migration completed successfully!")
        return True
        
    except Exception as e:
        error_msg = str(e)
        if any(ignore in error_msg.lower() for ignore in [
            'already exists', 'duplicate', 'column already exists'
        ]):
            print(f"⚠️  Warning: {error_msg[:100]}... (column may already exist)")
            return True
        else:
            print(f"❌ Error: {error_msg}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    success = apply_migration()
    sys.exit(0 if success else 1)

