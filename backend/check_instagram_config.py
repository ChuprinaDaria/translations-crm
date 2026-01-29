#!/usr/bin/env python3
"""
Скрипт для перевірки Instagram налаштувань з бази даних.
"""
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

from sqlalchemy.orm import Session
from core.database import SessionLocal
import crud

def check_instagram_config():
    """Перевірити Instagram налаштування з БД."""
    db: Session = SessionLocal()
    
    try:
        settings = crud.get_instagram_settings(db)
        
        print("=" * 60)
        print("Instagram Configuration from Database:")
        print("=" * 60)
        
        app_id = settings.get("instagram_app_id") or ""
        access_token = settings.get("instagram_access_token") or ""
        app_secret = settings.get("instagram_app_secret") or ""
        verify_token = settings.get("instagram_verify_token") or ""
        page_id = settings.get("instagram_page_id") or ""
        
        print(f"App ID:        {app_id[:20] + '...' if app_id and len(app_id) > 20 else app_id or '(empty)'}")
        print(f"Access Token:  {'***' + access_token[-10:] if access_token and len(access_token) > 10 else '(empty)'} (length: {len(access_token)})")
        print(f"App Secret:    {'***' + app_secret[-10:] if app_secret and len(app_secret) > 10 else '(empty)'} (length: {len(app_secret)})")
        print(f"Verify Token:  {verify_token[:20] + '...' if verify_token and len(verify_token) > 20 else verify_token or '(empty)'} (length: {len(verify_token)})")
        print(f"Page ID:       {page_id[:20] + '...' if page_id and len(page_id) > 20 else page_id or '(empty)'} (length: {len(page_id)})")
        print("=" * 60)
        
        # Перевірка чи всі обов'язкові поля заповнені
        required_fields = {
            "App ID": bool(app_id),
            "Access Token": bool(access_token),
            "Page ID": bool(page_id),
        }
        
        missing = [name for name, present in required_fields.items() if not present]
        
        if missing:
            print(f"⚠️  Missing required fields: {', '.join(missing)}")
        else:
            print("✅ All required fields are present!")
        
        print("=" * 60)
        
        return {
            "app_id": app_id,
            "access_token": access_token,
            "app_secret": app_secret,
            "verify_token": verify_token,
            "page_id": page_id,
        }
    
    except Exception as e:
        print(f"❌ Error loading Instagram settings: {e}")
        import traceback
        traceback.print_exc()
        return None
    
    finally:
        db.close()

if __name__ == "__main__":
    check_instagram_config()

