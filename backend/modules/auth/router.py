"""
Auth routes - authentication endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from core.database import get_db
from core.security import create_access_token, get_current_user_payload, verify_password
from core.config import settings
import crud_user
import schema
from datetime import timedelta

router = APIRouter(tags=["auth"])


@router.post("/register", response_model=schema.UserOut)
def register(user_in: schema.UserCreate, db: Session = Depends(get_db)):
    """Register new user."""
    existing = crud_user.get_user_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    
    role = user_in.role or "user"
    user = crud_user.create_user(
        db,
        email=user_in.email,
        role=role,
        password=user_in.password,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
    )
    return user


@router.post("/login")
def login(payload: schema.LoginRequest, db: Session = Depends(get_db)):
    """Login user and return JWT token."""
    user = crud_user.get_user_by_email(db, payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.hashed_password:
        raise HTTPException(
            status_code=401,
            detail="User account has no password set. Please contact administrator."
        )
    
    try:
        if not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid email or password")
    except ValueError as e:
        # Handle bcrypt errors (e.g., password too long)
        print(f"Password verification error: {e}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User account is inactive")
    
    crud_user.update_last_login(db, user)
    
    to_encode = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
        "is_admin": user.is_admin,
    }
    token = create_access_token(to_encode)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/forgot-password")
def forgot_password(
    request: schema.ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    """Request password reset."""
    # TODO: Implement password reset logic
    return {"message": "Password reset requested"}


@router.get("/me", response_model=schema.UserOut)
def get_current_user_info(
    user_payload: dict = Depends(get_current_user_payload),
    db: Session = Depends(get_db),
):
    """Get current user information."""
    from uuid import UUID
    user_id_str = user_payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")
    try:
        user_id = UUID(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid user ID in token")
    
    user = crud_user.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

