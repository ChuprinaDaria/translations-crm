#!/usr/bin/env python3
"""
Script to run all database migrations from the database/ directory
"""
import os
import sys
from pathlib import Path
from sqlalchemy import create_engine, text, inspect

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Set DATABASE_URL if not set
if not os.getenv("DATABASE_URL"):
    os.environ["DATABASE_URL"] = "postgresql://translator:traslatorini2025@localhost:5434/crm_db"

from core.config import settings

def get_migration_files():
    """Get all SQL migration files in order"""
    base_dir = Path(__file__).parent.parent
    migrations_dir = base_dir / "database"
    
    # Get all SQL files
    sql_files = []
    
    # Files in root database directory
    for file in sorted(migrations_dir.glob("migrations_*.sql")):
        sql_files.append(file)
    
    # Files in migrations subdirectory
    migrations_subdir = migrations_dir / "migrations"
    if migrations_subdir.exists():
        for file in sorted(migrations_subdir.glob("*.sql")):
            sql_files.append(file)
    
    # Other SQL files
    for file in sorted(migrations_dir.glob("*.sql")):
        if file.name not in [f.name for f in sql_files]:
            sql_files.append(file)
    
    return sql_files

def run_migration_file(engine, file_path: Path):
    """Run a single migration file in its own transaction"""
    print(f"\n📄 Running: {file_path.name}")
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Split by semicolons but keep DO blocks together
        statements = []
        current_statement = ""
        in_do_block = False
        
        for line in sql_content.split('\n'):
            current_statement += line + '\n'
            
            # Check for DO $$ blocks
            if 'DO $$' in line:
                in_do_block = True
            if in_do_block and 'END $$;' in line:
                in_do_block = False
                statements.append(current_statement.strip())
                current_statement = ""
            elif not in_do_block and line.strip().endswith(';') and line.strip():
                if current_statement.strip():
                    statements.append(current_statement.strip())
                    current_statement = ""
        
        # Add remaining statement
        if current_statement.strip():
            statements.append(current_statement.strip())
        
        # Execute each statement in separate transaction
        for i, statement in enumerate(statements, 1):
            if statement.strip() and not statement.strip().startswith('--'):
                try:
                    with engine.begin() as conn:
                        conn.execute(text(statement))
                except Exception as e:
                    # Some errors are expected (e.g., column already exists)
                    error_msg = str(e)
                    if any(ignore in error_msg.lower() for ignore in [
                        'already exists', 'duplicate', 'does not exist', 
                        'relation already exists', 'column already exists',
                        'undefined table', 'undefined column'
                    ]):
                        print(f"  ⊙ Statement {i}: {error_msg[:80]}... (skipped)")
                    else:
                        print(f"  ✗ Statement {i} failed: {error_msg[:100]}")
                        # Continue with next statement even if this one failed
        
        print(f"  ✓ Completed: {file_path.name}")
        return True
        
    except Exception as e:
        print(f"  ✗ Error in {file_path.name}: {e}")
        return False

def run_all_migrations():
    """Run all migration files"""
    print("🚀 Starting database migrations...")
    
    # Create engine
    engine = create_engine(settings.DATABASE_URL)
    
    migration_files = get_migration_files()
    print(f"\n📋 Found {len(migration_files)} migration files:")
    for f in migration_files:
        print(f"  - {f.name}")
    
    if not migration_files:
        print("❌ No migration files found!")
        return
    
    success_count = 0
    failed_count = 0
    
    for migration_file in migration_files:
        if run_migration_file(engine, migration_file):
            success_count += 1
        else:
            failed_count += 1
    
    print(f"\n✅ Migrations completed!")
    print(f"   ✓ Successful: {success_count}")
    if failed_count > 0:
        print(f"   ✗ Failed: {failed_count}")

if __name__ == "__main__":
    run_all_migrations()

