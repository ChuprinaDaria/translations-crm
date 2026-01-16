from sqlalchemy.orm import Session
from uuid import UUID
from typing import Union
import pyotp
from datetime import datetime
import models, schema

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: Union[UUID, int, str]):
    """Get user by ID. Accepts UUID, int, or string."""
    # Convert string to UUID if needed
    if isinstance(user_id, str):
        try:
            user_id = UUID(user_id)
        except ValueError:
            # Try int as fallback
            try:
                user_id = int(user_id)
            except ValueError:
                return None
    return db.query(models.User).filter(models.User.id == user_id).first()


def verify_totp(db: Session, email: str, code: str) -> bool:
    user = get_user_by_email(db, email)
    if not user:
        return False
    totp = pyotp.TOTP(user.totp_secret)
    return totp.verify(code, valid_window=1)  # a bit more time

def update_last_login(db: Session, user: models.User):
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    return user


def get_users(db: Session):
    return db.query(models.User).all()


def update_user(db: Session, user_id: Union[UUID, int, str], user_in: schema.UserUpdate):
    """Update user. Accepts UUID, int, or string."""
    user = get_user_by_id(db, user_id)
    if not user:
        return None

    update_data = user_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

def create_user(
    db: Session,
    email: str,
    role: str,
    password: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> models.User:
    """
    Створює користувача з email, паролем, роллю та іменем/прізвищем.
    """

    from core.security import hash_password
    
    secret = pyotp.random_base32()
    hashed_pw = hash_password(password) if password else None
    
    db_user = models.User(
        email=email,
        first_name=first_name,
        last_name=last_name,
        totp_secret=secret,
        hashed_password=hashed_pw,
        is_active=True,
        role=role,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password using core.security"""
    from core.security import verify_password as core_verify_password
    return core_verify_password(plain_password, hashed_password)


def hash_password(password: str) -> str:
    """Хешує пароль для зберігання в БД"""
    from core.security import hash_password as core_hash_password
    return core_hash_password(password)


def update_user_password(db: Session, user: models.User, new_password: str):
    """Оновлює пароль користувача"""
    user.hashed_password = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user
