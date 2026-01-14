from uuid import UUID, uuid4
from enum import Enum
from typing import TYPE_CHECKING
from sqlalchemy import Column, String, Boolean
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.orm import relationship
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
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    orders = relationship("Order", back_populates="manager", lazy="selectin")

