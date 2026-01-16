from uuid import UUID, uuid4
from enum import Enum
from typing import TYPE_CHECKING, Optional
from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.db import Base

if TYPE_CHECKING:
    from modules.crm.models import Order


class Role(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    ACCOUNTANT = "accountant"


class User(Base):
    __tablename__ = "users"
    
    id = Column(PostgresUUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # User profile fields
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    role = Column(String, default='user')
    department = Column(String, nullable=True)
    
    # 2FA
    totp_secret = Column(String, nullable=True)
    
    # Admin flag
    is_admin = Column(Boolean, default=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    orders = relationship("Order", back_populates="manager", lazy="selectin")
    notifications = relationship("Notification", back_populates="user", lazy="selectin")
    notification_settings = relationship("NotificationSettings", back_populates="user", uselist=False, lazy="selectin")

