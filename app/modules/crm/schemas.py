from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from modules.crm.models import OrderStatus, ClientSource


class ClientCreate(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: str
    source: Optional[ClientSource] = ClientSource.MANUAL


class ClientRead(BaseModel):
    id: UUID
    full_name: str
    email: Optional[str] = None
    phone: str
    source: ClientSource
    created_at: datetime
    orders: list["OrderRead"] = []
    
    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    client_id: UUID
    manager_id: UUID
    order_number: str
    description: Optional[str] = None
    status: Optional[OrderStatus] = OrderStatus.DO_WYKONANIA
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None


class OrderUpdate(BaseModel):
    client_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    order_number: Optional[str] = None
    description: Optional[str] = None
    status: Optional[OrderStatus] = None
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None


class OrderRead(BaseModel):
    id: UUID
    client_id: UUID
    manager_id: UUID
    order_number: str
    description: Optional[str] = None
    status: OrderStatus
    deadline: Optional[datetime] = None
    file_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    client: Optional[ClientRead] = None
    
    class Config:
        from_attributes = True


ClientRead.model_rebuild()

