"""
Postal Services Schemas - Pydantic models for API requests/responses.
"""
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator
from enum import Enum


class DeliveryType(str, Enum):
    """Delivery type enumeration."""
    PARCEL_LOCKER = "parcel_locker"
    COURIER = "courier"
    POP = "pop"


class PackageSize(str, Enum):
    """Package size enumeration."""
    SMALL = "small"  # gabaryt A (8 x 38 x 64 cm)
    MEDIUM = "medium"  # gabaryt B (19 x 38 x 64 cm)
    LARGE = "large"  # gabaryt C (41 x 38 x 64 cm)


class ShipmentStatus(str, Enum):
    """Shipment status enumeration."""
    CREATED = "created"
    CONFIRMED = "confirmed"
    DISPATCHED_BY_SENDER = "dispatched_by_sender"
    COLLECTED_FROM_SENDER = "collected_from_sender"
    TAKEN_BY_COURIER = "taken_by_courier"
    ADOPTED_AT_SOURCE_BRANCH = "adopted_at_source_branch"
    SENT_FROM_SOURCE_BRANCH = "sent_from_source_branch"
    READY_TO_PICKUP = "ready_to_pickup"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    PICKUP_REMINDER_SENT = "pickup_reminder_sent"
    RETURNED_TO_SENDER = "returned_to_sender"
    AVIZO = "avizo"
    CANCELED = "canceled"
    ERROR = "error"


# Request Schemas
class ReceiverInfo(BaseModel):
    """Receiver information."""
    email: EmailStr
    phone: str = Field(..., pattern=r"^\+?[0-9]{9,15}$")
    name: Optional[str] = None


class SenderInfo(BaseModel):
    """Sender information."""
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{9,15}$")
    name: Optional[str] = None


class AddressInfo(BaseModel):
    """Address information for courier delivery."""
    street: str
    building_number: str
    flat_number: Optional[str] = None
    city: str
    post_code: str = Field(..., pattern=r"^\d{2}-\d{3}$")
    country: str = Field(default="PL", pattern=r"^[A-Z]{2}$")


class CreateShipmentRequest(BaseModel):
    """Request to create a new shipment."""
    order_id: UUID
    delivery_type: DeliveryType
    
    # For parcel locker
    parcel_locker_code: Optional[str] = Field(
        None,
        pattern=r"^[A-Z]{3}[0-9]{2,4}[A-Z]?$",
        description="Parcel locker code (e.g., KRA010)"
    )
    
    # For courier
    courier_address: Optional[AddressInfo] = None
    
    # Receiver
    receiver: ReceiverInfo
    
    # Sender (optional, will use defaults from settings)
    sender: Optional[SenderInfo] = None
    
    # Package info
    package_size: PackageSize = PackageSize.SMALL
    package_weight: Optional[float] = Field(None, gt=0, le=30, description="Weight in kg")
    
    # Additional options
    insurance_amount: Optional[float] = Field(None, ge=0, description="Insurance in PLN")
    cod_amount: Optional[float] = Field(None, ge=0, description="Cash on delivery in PLN")
    
    # Reference
    reference: Optional[str] = Field(None, max_length=100, description="Internal reference")
    
    @field_validator("parcel_locker_code")
    @classmethod
    def validate_parcel_locker(cls, v, info):
        """Validate parcel locker code if delivery type is parcel_locker."""
        if info.data.get("delivery_type") == DeliveryType.PARCEL_LOCKER and not v:
            raise ValueError("Parcel locker code is required for parcel_locker delivery type")
        return v
    
    @field_validator("courier_address")
    @classmethod
    def validate_courier_address(cls, v, info):
        """Validate courier address if delivery type is courier."""
        if info.data.get("delivery_type") == DeliveryType.COURIER and not v:
            raise ValueError("Courier address is required for courier delivery type")
        return v


class UpdateShipmentRequest(BaseModel):
    """Request to update shipment information."""
    receiver_email: Optional[EmailStr] = None
    receiver_phone: Optional[str] = None
    receiver_name: Optional[str] = None
    
    parcel_locker_code: Optional[str] = None
    courier_address: Optional[AddressInfo] = None


class CancelShipmentRequest(BaseModel):
    """Request to cancel a shipment."""
    reason: Optional[str] = None


# Response Schemas
class ShipmentResponse(BaseModel):
    """Shipment response."""
    id: UUID
    order_id: Optional[UUID]
    shipment_id: Optional[str]
    tracking_number: Optional[str]
    tracking_url: Optional[str]
    label_url: Optional[str]
    
    delivery_type: str
    parcel_locker_code: Optional[str]
    courier_address: Optional[str]
    
    receiver_email: Optional[str]
    receiver_phone: Optional[str]
    receiver_name: Optional[str]
    
    package_size: Optional[str]
    package_weight: Optional[float]
    
    status: str
    status_description: Optional[str]
    
    cost: Optional[float]
    
    created_at: datetime
    updated_at: datetime
    dispatched_at: Optional[datetime]
    delivered_at: Optional[datetime]
    
    error_message: Optional[str]
    
    class Config:
        from_attributes = True


class ShipmentStatusResponse(BaseModel):
    """Shipment status response."""
    shipment_id: UUID
    tracking_number: Optional[str]
    status: str
    status_description: Optional[str]
    tracking_url: Optional[str]
    updated_at: datetime
    status_history: Optional[List[Dict[str, Any]]] = None


class TrackingInfoResponse(BaseModel):
    """Tracking information response."""
    tracking_number: Optional[str]
    tracking_url: Optional[str]
    status: str
    status_description: Optional[str]
    last_update: datetime
    events: Optional[List[Dict[str, Any]]] = None


class InPostSettingsResponse(BaseModel):
    """InPost settings response."""
    id: int
    api_key: Optional[str] = Field(None, description="Masked JWT Organization Token for API authentication")
    organization_id: Optional[str] = Field(None, description="Organization ID (numeric ID used in API URLs)")
    api_url: str
    sandbox_mode: bool
    webhook_url: Optional[str]
    default_sender_email: Optional[str]
    default_sender_phone: Optional[str]
    default_sender_name: Optional[str]
    is_enabled: bool
    
    class Config:
        from_attributes = True


class InPostSettingsUpdate(BaseModel):
    """Update InPost settings."""
    api_key: Optional[str] = Field(None, description="JWT Organization Token for API authentication")
    organization_id: Optional[str] = Field(None, description="Organization ID (numeric ID)")
    sandbox_mode: Optional[bool] = None
    sandbox_api_key: Optional[str] = Field(None, description="Sandbox JWT token")
    webhook_url: Optional[str] = None
    webhook_secret: Optional[str] = Field(None, description="Secret for webhook verification (NOT for API auth)")
    default_sender_email: Optional[EmailStr] = None
    default_sender_phone: Optional[str] = None
    default_sender_name: Optional[str] = None
    is_enabled: Optional[bool] = None


class ParcelLockerSearchResponse(BaseModel):
    """Parcel locker search response."""
    name: str
    address: Dict[str, Any]
    location: Dict[str, float]
    location_description: Optional[str]
    opening_hours: Optional[str]
    functions: List[str]
    payment_available: bool
    parcel_locker_available: bool


class WebhookEvent(BaseModel):
    """InPost webhook event."""
    event_type: str
    shipment_id: str
    status: str
    tracking_number: Optional[str]
    occurred_at: datetime
    data: Optional[Dict[str, Any]] = None

