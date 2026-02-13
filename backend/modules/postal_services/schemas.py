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
# InPost API Shipment schemas (full structure from API documentation)
class MoneyData(BaseModel):
    """Money data structure."""
    amount: Optional[float] = None
    currency: Optional[str] = None


class Address(BaseModel):
    """Address structure."""
    id: Optional[str] = None
    line1: Optional[str] = None
    line2: Optional[str] = None
    street: Optional[str] = None
    building_number: Optional[str] = None
    city: Optional[str] = None
    post_code: Optional[str] = None
    country_code: Optional[str] = None


class Peer(BaseModel):
    """Peer (sender/receiver) structure."""
    id: Optional[str] = None
    name: Optional[str] = None
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[Address] = None


class Service(BaseModel):
    """Service structure."""
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None


class Carrier(BaseModel):
    """Carrier structure."""
    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None


class Offer(BaseModel):
    """Offer structure."""
    id: Optional[int] = None
    status: Optional[str] = None
    expires_at: Optional[str] = None
    rate: Optional[float] = None
    currency: Optional[str] = None
    additional_services: Optional[List[str]] = []
    service: Optional[Service] = None
    carrier: Optional[Carrier] = None
    unavailability_reasons: Optional[List[Any]] = None


class Transaction(BaseModel):
    """Transaction structure."""
    id: Optional[str] = None
    status: Optional[str] = None
    offer_id: Optional[int] = None
    details: Optional[Dict[str, Any]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ParcelDimensions(BaseModel):
    """Parcel dimensions."""
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    unit: Optional[str] = None


class ParcelWeight(BaseModel):
    """Parcel weight."""
    amount: Optional[float] = None
    unit: Optional[str] = None


class Parcel(BaseModel):
    """Parcel structure."""
    id: Optional[str] = None
    identify_number: Optional[str] = None
    tracking_number: Optional[str] = None
    is_non_standard: Optional[bool] = False
    template: Optional[str] = None
    dimensions: Optional[ParcelDimensions] = None
    weight: Optional[ParcelWeight] = None


class ShipmentCustomAttributes(BaseModel):
    """Custom attributes for shipment."""
    target_point: Optional[str] = None
    sending_method: Optional[str] = None
    dropoff_point: Optional[str] = None
    dispatch_order_id: Optional[int] = None


class InPostShipmentFull(BaseModel):
    """Full InPost shipment structure from API."""
    href: Optional[str] = None
    id: Optional[int] = None
    status: Optional[str] = None
    tracking_number: Optional[str] = None
    return_tracking_number: Optional[str] = None
    service: Optional[str] = None
    reference: Optional[str] = None
    is_return: Optional[bool] = False
    application_id: Optional[int] = None
    created_by_id: Optional[int] = None
    external_customer_id: Optional[str] = None
    sending_method: Optional[str] = None
    end_of_week_collection: Optional[bool] = False
    comments: Optional[str] = None
    mpk: Optional[str] = None
    additional_services: Optional[List[str]] = []
    custom_attributes: Optional[ShipmentCustomAttributes] = None
    cod: Optional[MoneyData] = None
    insurance: Optional[MoneyData] = None
    sender: Optional[Peer] = None
    receiver: Optional[Peer] = None
    selected_offer: Optional[Offer] = None
    offers: Optional[List[Offer]] = []
    transactions: Optional[List[Transaction]] = []
    parcels: Optional[List[Parcel]] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class ShipmentListResponse(BaseModel):
    """Response with list of shipments."""
    href: Optional[str] = None
    count: Optional[int] = None
    page: Optional[int] = None
    per_page: Optional[int] = None
    items: List[InPostShipmentFull] = []


class ShipmentResponse(BaseModel):
    """Shipment response (simplified for internal use)."""
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


class TrackingDetail(BaseModel):
    """Single tracking detail entry."""
    status: str
    origin_status: Optional[str] = None
    agency: Optional[str] = None
    location: Optional[str] = None
    datetime: str


class CustomAttributes(BaseModel):
    """Custom attributes for Paczkomat shipments."""
    size: Optional[str] = None
    target_machine_id: Optional[str] = None
    target_machine_detail: Optional[Dict[str, Any]] = None
    dropoff_machine_id: Optional[str] = None
    dropoff_machine_detail: Optional[Dict[str, Any]] = None
    end_of_week_collection: Optional[bool] = None


class TrackingInfoResponse(BaseModel):
    """Tracking information response from InPost API."""
    tracking_number: str
    service: Optional[str] = None
    type: Optional[str] = None
    status: str
    custom_attributes: Optional[CustomAttributes] = None
    tracking_details: List[TrackingDetail] = []
    expected_flow: List[str] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    # Computed fields
    tracking_url: Optional[str] = None
    status_description: Optional[str] = None
    last_update: Optional[datetime] = None
    events: Optional[List[Dict[str, Any]]] = None  # Legacy field for backward compatibility


class StatusItem(BaseModel):
    """Single status item from InPost API."""
    name: str
    title: str
    description: str


class StatusListResponse(BaseModel):
    """Response with list of InPost statuses."""
    href: str
    items: List[StatusItem]


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

