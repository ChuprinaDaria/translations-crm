#!/usr/bin/env python3
"""
Script to create admin user on the server.
Run inside Docker container:
  docker exec -it crm_translations_backend python create_admin.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from core.database import SessionLocal
from core.security import hash_password
from modules.auth.models import User, UserRole
import pyotp


def create_admin_user(
    email: str,
    password: str,
    first_name: str = None,
    last_name: str = None,
    role: str = "OWNER",
):
    db: Session = SessionLocal()
    try:
        # Check if user already exists
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"⚠️  User {email} already exists (id: {existing.id}, role: {existing.role})")
            # Update to admin if not already
            if not existing.is_admin or existing.role != role:
                existing.is_admin = True
                existing.role = role
                if password:
                    existing.hashed_password = hash_password(password)
                if first_name:
                    existing.first_name = first_name
                if last_name:
                    existing.last_name = last_name
                db.commit()
                print(f"✅ Updated user {email} to role={role}, is_admin=True")
            return existing
        
        # Create new user
        secret = pyotp.random_base32()
        hashed_pw = hash_password(password)
        
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            hashed_password=hashed_pw,
            totp_secret=secret,
            is_active=True,
            is_admin=True,
            role=role,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        print(f"✅ Created admin user:")
        print(f"   Email: {email}")
        print(f"   Role: {role}")
        print(f"   ID: {user.id}")
        print(f"   Password: {password}")
        
        return user
    finally:
        db.close()


if __name__ == "__main__":
    print("=" * 50)
    print("  CRM Admin User Creator")
    print("=" * 50)
    
    # Create main admin account
    create_admin_user(
        email="maksym.tarczewski@tlumaczeniamt.pl",
        password="Admin2026!MT",
        first_name="Maksym",
        last_name="Tarczewski",
        role="OWNER",
    )
    
    print()
    
    # Create second admin account
    create_admin_user(
        email="info@lazysoft.pl",
        password="Admin2026!LS",
        first_name="Admin",
        last_name="LazySoft",
        role="OWNER",
    )
    
    print()
    print("=" * 50)
    print("Done! Users can now login at the CRM.")
    print("=" * 50)

