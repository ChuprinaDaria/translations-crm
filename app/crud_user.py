from sqlalchemy.orm import Session
import pyotp
from datetime import datetime
import bcrypt
import models, schema

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()


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

def create_user(db: Session, email: str, role: str, password: str = None) -> models.User:

    secret = pyotp.random_base32()
    hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8') if password else None 
    
    db_user = models.User(
        email=email,
        totp_secret=secret,
        hashed_password=hashed_pw,
        is_active=True,
        role=role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password:
        return False
    
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
