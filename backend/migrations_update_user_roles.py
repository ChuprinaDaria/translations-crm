"""
Migration script to update user roles to new RBAC system.
Converts old roles to new UserRole enum: OWNER, ACCOUNTANT, MANAGER
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import SessionLocal
from sqlalchemy import text

def migrate_user_roles():
    """Update user roles to new RBAC system."""
    db = SessionLocal()
    try:
        # Map old roles to new roles
        # admin -> OWNER
        # accountant -> ACCOUNTANT  
        # manager, sales-manager, service-manager, kp-manager -> MANAGER
        # user -> MANAGER (default)
        
        updates = [
            ("UPDATE users SET role = 'OWNER' WHERE role = 'admin' OR is_admin = true", "admin -> OWNER"),
            ("UPDATE users SET role = 'ACCOUNTANT' WHERE role = 'accountant'", "accountant -> ACCOUNTANT"),
            ("UPDATE users SET role = 'MANAGER' WHERE role IN ('manager', 'sales-manager', 'service-manager', 'kp-manager', 'user') OR role IS NULL", "managers -> MANAGER"),
        ]
        
        for sql, description in updates:
            print(f"Executing: {description}")
            db.execute(text(sql))
            db.commit()
            print(f"✓ {description} completed")
        
        # Set default for any remaining NULL roles
        db.execute(text("UPDATE users SET role = 'MANAGER' WHERE role IS NULL OR role = ''"))
        db.commit()
        
        print("\n✅ User roles migration completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate_user_roles()

