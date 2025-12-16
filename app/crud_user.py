from sqlalchemy.orm import Session
import pyotp
from datetime import datetime
import bcrypt
import models, schema

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


def get_user_by_id(db: Session, user_id: int):
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


def update_user(db: Session, user_id: int, user_in: schema.UserUpdate):
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

    secret = pyotp.random_base32()
    hashed_pw = (
        bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        if password
        else None
    )
    
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
    if not hashed_password:
        return False
    
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))


def hash_password(password: str) -> str:
    """Хешує пароль для зберігання в БД"""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def update_user_password(db: Session, user: models.User, new_password: str):
    """Оновлює пароль користувача"""
    user.hashed_password = hash_password(new_password)
    db.commit()
    db.refresh(user)
    return user
