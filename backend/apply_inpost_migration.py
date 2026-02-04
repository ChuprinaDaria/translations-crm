#!/usr/bin/env python3
"""
Apply InPost tables migration
Run: python backend/apply_inpost_migration.py
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import text
from db import engine


def apply_migration():
    """Apply InPost tables migration."""
    migration_file = Path(__file__).parent.parent / "database" / "migrations" / "create_inpost_tables.sql"
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    print(f"📄 Reading migration from: {migration_file}")
    
    try:
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        print("🔄 Applying migration...")
        
        with engine.begin() as conn:
            # Execute the SQL
            conn.execute(text(sql))
        
        print("✅ InPost tables migration applied successfully!")
        print("\nCreated tables:")
        print("  - inpost_settings")
        print("  - inpost_shipments")
        print("\nCreated indexes and triggers")
        print("\nInserted default settings row")
        
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("InPost Tables Migration")
    print("=" * 60)
    print()
    
    success = apply_migration()
    
    print()
    print("=" * 60)
    
    if success:
        print("✅ Migration completed successfully")
        print("\nNext steps:")
        print("1. Configure InPost API key in Settings → InPost")
        print("2. Set up webhook URL in InPost Organization panel")
        print("3. Configure default sender information")
        print("4. Enable InPost integration")
        sys.exit(0)
    else:
        print("❌ Migration failed")
        sys.exit(1)

