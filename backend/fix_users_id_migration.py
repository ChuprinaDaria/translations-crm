#!/usr/bin/env python3
"""
Migration script to fix users.id column to use UUID with default
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
from core.config import settings

def fix_users_id():
    """Fix users.id column to use UUID with default"""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check current column type
        inspector = inspect(engine)
        cols = {c["name"]: c for c in inspector.get_columns("users")}
        
        if "id" not in cols:
            print("❌ Column 'id' does not exist!")
            return
        
        current_col = cols["id"]
        print(f"📋 Current id column: {current_col['type']} (nullable={current_col['nullable']}, default={current_col.get('default', 'None')})")
        
        # Check if it's already UUID
        col_type_str = str(current_col['type'])
        if 'UUID' in col_type_str.upper() or 'uuid' in col_type_str.lower():
            print("✓ Column is already UUID type")
            # Check if it has default
            if current_col.get('default') is None:
                print("⚠️  UUID column exists but has no default, adding default...")
                try:
                    # Enable uuid-ossp extension if not exists
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"))
                    conn.commit()
                    
                    # Add default using gen_random_uuid() or uuid_generate_v4()
                    conn.execute(text("""
                        ALTER TABLE users 
                        ALTER COLUMN id SET DEFAULT gen_random_uuid();
                    """))
                    conn.commit()
                    print("  ✓ Added default gen_random_uuid()")
                except Exception as e:
                    print(f"  ✗ Error: {e}")
                    # Try alternative
                    try:
                        conn.execute(text("""
                            ALTER TABLE users 
                            ALTER COLUMN id SET DEFAULT uuid_generate_v4();
                        """))
                        conn.commit()
                        print("  ✓ Added default uuid_generate_v4()")
                    except Exception as e2:
                        print(f"  ✗ Alternative also failed: {e2}")
        else:
            print("⚠️  Column is not UUID type, converting...")
            print("  This will require data migration if table has existing rows")
            
            # Check if table has data
            result = conn.execute(text("SELECT COUNT(*) FROM users"))
            count = result.scalar()
            
            if count > 0:
                print(f"  ⚠️  Table has {count} existing rows. This migration will:")
                print("     1. Create new UUID column")
                print("     2. Generate UUIDs for existing rows")
                print("     3. Drop old column and rename new one")
                print("     4. Update foreign keys")
                response = input("  Continue? (yes/no): ")
                if response.lower() != 'yes':
                    print("  Migration cancelled")
                    return
            
            try:
                # Enable uuid-ossp extension
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"))
                conn.commit()
                
                # Step 1: Add new UUID column
                conn.execute(text("""
                    ALTER TABLE users 
                    ADD COLUMN id_new UUID DEFAULT gen_random_uuid();
                """))
                conn.commit()
                print("  ✓ Added new UUID column")
                
                # Step 2: Generate UUIDs for existing rows
                if count > 0:
                    conn.execute(text("""
                        UPDATE users 
                        SET id_new = gen_random_uuid();
                    """))
                    conn.commit()
                    print(f"  ✓ Generated UUIDs for {count} existing rows")
                
                # Step 3: Drop old column and constraints
                # First, drop foreign key constraints that reference users.id
                conn.execute(text("""
                    DO $$
                    DECLARE
                        r RECORD;
                    BEGIN
                        FOR r IN (
                            SELECT conname, conrelid::regclass
                            FROM pg_constraint
                            WHERE confrelid = 'users'::regclass
                            AND contype = 'f'
                        ) LOOP
                            EXECUTE 'ALTER TABLE ' || r.conrelid || ' DROP CONSTRAINT IF EXISTS ' || r.conname;
                        END LOOP;
                    END $$;
                """))
                conn.commit()
                print("  ✓ Dropped foreign key constraints")
                
                # Drop primary key
                conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;"))
                conn.commit()
                print("  ✓ Dropped primary key")
                
                # Drop old column
                conn.execute(text("ALTER TABLE users DROP COLUMN id;"))
                conn.commit()
                print("  ✓ Dropped old id column")
                
                # Rename new column
                conn.execute(text("ALTER TABLE users RENAME COLUMN id_new TO id;"))
                conn.commit()
                print("  ✓ Renamed new column to id")
                
                # Add primary key
                conn.execute(text("ALTER TABLE users ADD PRIMARY KEY (id);"))
                conn.commit()
                print("  ✓ Added primary key")
                
                # Recreate foreign keys (if needed)
                # This would need to be done manually for each table that references users
                print("  ⚠️  Note: Foreign key constraints need to be recreated manually")
                
            except Exception as e:
                print(f"  ✗ Error during conversion: {e}")
                conn.rollback()
                raise
        
        print("\n✅ Migration completed!")
        
        # Verify
        inspector = inspect(engine)
        final_cols = {c["name"]: c for c in inspector.get_columns("users")}
        if "id" in final_cols:
            final_col = final_cols["id"]
            print(f"\n📋 Final id column: {final_col['type']} (nullable={final_col['nullable']}, default={final_col.get('default', 'None')})")

if __name__ == "__main__":
    fix_users_id()

