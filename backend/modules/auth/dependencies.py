"""
Auth dependencies - helpers for getting current user from DB.
"""
from uuid import UUID
from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import get_current_user_payload
import crud_user
import models


def get_current_user_db(
    db: Session = Depends(get_db),
    user_payload: dict = Depends(get_current_user_payload),
) -> models.User:
    """
    Get current user from database.
    Returns User model instance.
    """
    user_id_str = user_payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Try UUID first, then int (for backward compatibility)
    # crud_user.get_user_by_id supports both UUID and int
    user = crud_user.get_user_by_id(db, user_id_str)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(
    user: models.User = Depends(get_current_user_db),
) -> models.User:
    """Require admin role."""
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

