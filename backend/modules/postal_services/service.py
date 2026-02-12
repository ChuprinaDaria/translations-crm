"""
InPost Service - handles all InPost API interactions.
"""
import httpx
import logging
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import or_

from modules.postal_services.models import (
    InPostShipment,
    InPostSettings,
    ShipmentStatus,
    DeliveryType,
)
from modules.postal_services.schemas import (
    CreateShipmentRequest,
    UpdateShipmentRequest,
    ShipmentResponse,
    TrackingInfoResponse,
    ParcelLockerSearchResponse,
)

logger = logging.getLogger(__name__)


class InPostService:
    """InPost API service."""
    
    def __init__(self, db: Session):
        """Initialize InPost service."""
        self.db = db
        self._organization_id: Optional[str] = None
    
    @property
    def settings(self) -> InPostSettings:
        """Get InPost settings from database."""
        settings = self.db.query(InPostSettings).first()
        if not settings:
            settings = InPostSettings(
                api_url="https://api-shipx-pl.easypack24.net/v1",
                sandbox_api_url="https://sandbox-api-shipx-pl.easypack24.net/v1",
                is_enabled=False,
            )
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        
        # Log settings for debugging
        logger.info(f"InPost settings from DB:")
        logger.info(f"  id: {settings.id}")
        logger.info(f"  api_key: '{settings.api_key}' (type: {type(settings.api_key).__name__}, is None: {settings.api_key is None})")
        logger.info(f"  organization_id: '{settings.organization_id}' (type: {type(settings.organization_id).__name__}, is None: {settings.organization_id is None})")
        logger.info(f"  sandbox_mode: {settings.sandbox_mode}")
        logger.info(f"  sandbox_api_key: '{settings.sandbox_api_key}' (type: {type(settings.sandbox_api_key).__name__})")
        logger.info(f"  is_enabled: {settings.is_enabled}")
        print(f"[InPost] Settings from DB:")
        print(f"  id={settings.id}")
        print(f"  api_key='{settings.api_key}' (type: {type(settings.api_key).__name__}, is None: {settings.api_key is None})")
        print(f"  organization_id='{settings.organization_id}' (type: {type(settings.organization_id).__name__}, is None: {settings.organization_id is None})")
        print(f"  sandbox_mode={settings.sandbox_mode}")
        print(f"  sandbox_api_key='{settings.sandbox_api_key}'")
        print(f"  is_enabled={settings.is_enabled}")
        
        return settings
    
    def get_api_url(self) -> str:
        """Get API URL based on sandbox mode."""
        if self.settings.sandbox_mode:
            return self.settings.sandbox_api_url
        return self.settings.api_url
    
    def get_api_key(self) -> str:
        """Get API key based on sandbox mode."""
        if self.settings.sandbox_mode:
            api_key = self.settings.sandbox_api_key or ""
        else:
            api_key = self.settings.api_key or ""
        
        # Convert to string if it's a number (numeric IDs are valid)
        api_key_str = str(api_key).strip() if api_key else ""
        
        # Log for debugging
        logger.info(f"InPost get_api_key: sandbox_mode={self.settings.sandbox_mode}, api_key={api_key_str}")
        print(f"[InPost] get_api_key: sandbox_mode={self.settings.sandbox_mode}")
        print(f"[InPost] get_api_key: api_key from DB = '{api_key}' (type: {type(api_key).__name__})")
        print(f"[InPost] get_api_key: api_key_str = '{api_key_str}'")
        
        return api_key_str
    
    def _get_headers(self) -> Dict[str, str]:
        """Get HTTP headers for API requests."""
        api_key = self.get_api_key()
        
        # Detailed validation and logging
        logger.info(f"InPost _get_headers: api_key = '{api_key}' (type: {type(api_key).__name__}, len: {len(api_key) if api_key else 0})")
        print(f"[InPost] _get_headers: api_key = '{api_key}' (type: {type(api_key).__name__}, len: {len(api_key) if api_key else 0})")
        
        if not api_key:
            error_msg = "InPost API key is not configured or is empty"
            logger.error(error_msg)
            print(f"[InPost] ERROR: {error_msg}")
            raise ValueError(error_msg)
        
        if api_key.strip() == "":
            error_msg = "InPost API key is empty after stripping whitespace"
            logger.error(error_msg)
            print(f"[InPost] ERROR: {error_msg}")
            raise ValueError(error_msg)
        
        # InPost ShipX API uses Bearer token format: Authorization: Bearer TOKEN
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        
        # Log everything for debugging
        logger.info(f"InPost API request headers:")
        logger.info(f"  Authorization: Bearer {api_key}")
        logger.info(f"  Content-Type: application/json")
        print(f"[InPost] Authorization header: Bearer {api_key}")
        print(f"[InPost] Full headers: {headers}")
        
        return headers
    
    async def create_shipment(
        self,
        request: CreateShipmentRequest,
    ) -> InPostShipment:
        """
        Create a new InPost shipment.
        
        Args:
            request: Shipment creation request
            
        Returns:
            Created shipment object
        """
        if not self.settings.is_enabled:
            raise ValueError("InPost integration is not enabled")
        
        # Create shipment record
        shipment = InPostShipment(
            order_id=request.order_id,
            delivery_type=request.delivery_type.value,
            parcel_locker_code=request.parcel_locker_code,
            receiver_email=request.receiver.email,
            receiver_phone=request.receiver.phone,
            receiver_name=request.receiver.name,
            package_size=request.package_size.value,
            package_weight=request.package_weight,
            insurance_amount=request.insurance_amount,
            cod_amount=request.cod_amount,
            status=ShipmentStatus.CREATED,
        )
        
        # Set courier address if provided
        if request.courier_address:
            shipment.courier_street = request.courier_address.street
            shipment.courier_building_number = request.courier_address.building_number
            shipment.courier_flat_number = request.courier_address.flat_number
            shipment.courier_city = request.courier_address.city
            shipment.courier_post_code = request.courier_address.post_code
            shipment.courier_country = request.courier_address.country
            
            # Full address string
            address_parts = [
                f"{request.courier_address.street} {request.courier_address.building_number}",
            ]
            if request.courier_address.flat_number:
                address_parts[0] += f"/{request.courier_address.flat_number}"
            address_parts.append(f"{request.courier_address.post_code} {request.courier_address.city}")
            shipment.courier_address = ", ".join(address_parts)
        
        # Set sender info (use defaults if not provided)
        if request.sender:
            shipment.sender_email = request.sender.email
            shipment.sender_phone = request.sender.phone
            shipment.sender_name = request.sender.name
        else:
            shipment.sender_email = self.settings.default_sender_email
            shipment.sender_phone = self.settings.default_sender_phone
            shipment.sender_name = self.settings.default_sender_name
        
        # Save to database
        self.db.add(shipment)
        self.db.commit()
        self.db.refresh(shipment)
        
        # Create shipment in InPost API
        try:
            await self._create_shipment_in_inpost(shipment)
        except Exception as e:
            logger.error(f"Failed to create shipment in InPost: {e}")
            shipment.status = ShipmentStatus.ERROR
            shipment.error_message = str(e)
            self.db.commit()
            raise
        
        return shipment
    
    async def _create_shipment_in_inpost(self, shipment: InPostShipment) -> None:
        """Create shipment in InPost API."""
        api_url = self.get_api_url()
        
        # Build request payload according to InPost API documentation
        # Use template for parcels (small, medium, large) instead of manual dimensions
        parcel_template = shipment.package_size or "small"
        
        payload: Dict[str, Any] = {
            "receiver": {
                "email": shipment.receiver_email,
                "phone": shipment.receiver_phone,
            },
            "parcels": [
                {
                    "template": parcel_template,
                    "is_non_standard": False,
                }
            ],
            "service": "inpost_locker_standard",
            "reference": str(shipment.id),
        }
        
        # Add weight if specified (will override template default)
        if shipment.package_weight:
            payload["parcels"][0]["weight"] = {
                "amount": shipment.package_weight,
                "unit": "kg",
            }
        
        # Add receiver name if provided
        if shipment.receiver_name:
            payload["receiver"]["name"] = shipment.receiver_name
        
        # Add sender info
        if shipment.sender_email or shipment.sender_phone:
            payload["sender"] = {}
            if shipment.sender_email:
                payload["sender"]["email"] = shipment.sender_email
            if shipment.sender_phone:
                payload["sender"]["phone"] = shipment.sender_phone
            if shipment.sender_name:
                payload["sender"]["name"] = shipment.sender_name
        
        # Set delivery point based on type
        if shipment.delivery_type == DeliveryType.PARCEL_LOCKER.value:
            payload["custom_attributes"] = {
                "target_point": shipment.parcel_locker_code,
            }
        elif shipment.delivery_type == DeliveryType.COURIER.value:
            payload["service"] = "inpost_courier_standard"
            payload["custom_attributes"] = {
                "dropoff_point": shipment.parcel_locker_code if shipment.parcel_locker_code else None,
            }
            payload["receiver"]["address"] = {
                "street": shipment.courier_street,
                "building_number": shipment.courier_building_number,
                "city": shipment.courier_city,
                "post_code": shipment.courier_post_code,
                "country_code": shipment.courier_country or "PL",
            }
            if shipment.courier_flat_number:
                payload["receiver"]["address"]["flat_number"] = shipment.courier_flat_number
        
        # Add insurance if specified
        if shipment.insurance_amount:
            payload["insurance"] = {
                "amount": shipment.insurance_amount,
                "currency": "PLN",
            }
        
        # Add COD if specified
        if shipment.cod_amount:
            payload["cod"] = {
                "amount": shipment.cod_amount,
                "currency": "PLN",
            }
        
        # Make API request
        organization_id = await self._get_organization_id()
        headers = self._get_headers()
        request_url = f"{api_url}/organizations/{organization_id}/shipments"
        
        logger.info(f"InPost API request:")
        logger.info(f"  URL: {request_url}")
        logger.info(f"  Method: POST")
        logger.info(f"  Organization ID: {organization_id}")
        print(f"[InPost] Request URL: {request_url}")
        print(f"[InPost] Organization ID: {organization_id}")
        print(f"[InPost] Payload keys: {list(payload.keys())}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                request_url,
                json=payload,
                headers=headers,
            )
            
            logger.info(f"InPost API response:")
            logger.info(f"  Status: {response.status_code}")
            logger.info(f"  Response text: {response.text[:500]}")
            print(f"[InPost] Response status: {response.status_code}")
            print(f"[InPost] Response text: {response.text[:200]}")
            
            if response.status_code not in [200, 201]:
                error_data = response.json() if response.text else {}
                error_message = error_data.get("message", error_data.get("detail", response.text))
                logger.error(f"InPost API error: {error_message}")
                logger.error(f"Full response: {response.text}")
                raise Exception(f"InPost API error: {error_message}")
            
            data = response.json()
            
            # Update shipment with InPost data
            shipment.shipment_id = data.get("id")
            shipment.tracking_number = data.get("tracking_number")
            shipment.status = ShipmentStatus.CONFIRMED
            shipment.inpost_response = data
            
            # Set tracking URL
            if shipment.tracking_number:
                shipment.tracking_url = f"https://inpost.pl/sledzenie-przesylek?number={shipment.tracking_number}"
            
            # Get label URL if available
            if "href" in data.get("_links", {}).get("label", {}):
                shipment.label_url = data["_links"]["label"]["href"]
            
            # Add to status history
            status_entry = {
                "status": shipment.status.value,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "description": "Shipment confirmed in InPost",
            }
            if not shipment.status_history:
                shipment.status_history = []
            shipment.status_history.append(status_entry)
            
            self.db.commit()
            self.db.refresh(shipment)
    
    async def _get_organization_id(self) -> str:
        """Get organization ID from database or use api_key as fallback."""
        if self._organization_id:
            logger.info(f"InPost organization_id (cached): {self._organization_id}")
            print(f"[InPost] organization_id (cached): {self._organization_id}")
            return self._organization_id
        
        # First, try to get from database settings
        settings = self.settings
        organization_id = settings.organization_id
        
        logger.info(f"InPost _get_organization_id: organization_id from DB = '{organization_id}' (type: {type(organization_id).__name__}, is None: {organization_id is None})")
        print(f"[InPost] organization_id from DB: '{organization_id}' (type: {type(organization_id).__name__}, is None: {organization_id is None})")
        
        # If organization_id is not set, use api_key (they can be the same numeric ID)
        if not organization_id:
            api_key = self.get_api_key()
            if api_key:
                organization_id = api_key
                logger.info(f"InPost organization_id not in DB, using api_key: {organization_id}")
                print(f"[InPost] organization_id not in DB, using api_key: {organization_id}")
            else:
                raise ValueError("InPost organization ID and API key are not configured")
        
        # Convert to string and ensure it's not empty
        organization_id = str(organization_id).strip()
        if not organization_id:
            raise ValueError("InPost organization ID is empty")
        
        # Cache it
        self._organization_id = organization_id
        
        logger.info(f"InPost organization_id (final): {organization_id}")
        print(f"[InPost] organization_id (final): {organization_id}")
        return organization_id
    
    async def get_shipment(self, shipment_id: UUID) -> Optional[InPostShipment]:
        """Get shipment by ID."""
        return self.db.query(InPostShipment).filter(
            InPostShipment.id == shipment_id
        ).first()
    
    async def get_shipment_by_order(self, order_id: UUID) -> Optional[InPostShipment]:
        """Get shipment by order ID."""
        return self.db.query(InPostShipment).filter(
            InPostShipment.order_id == order_id
        ).order_by(InPostShipment.created_at.desc()).first()
    
    async def get_tracking_info(
        self,
        tracking_number: str,
    ) -> TrackingInfoResponse:
        """
        Get tracking information from InPost.
        
        Args:
            tracking_number: Tracking number
            
        Returns:
            Tracking information
        """
        api_url = self.get_api_url()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{api_url}/tracking/{tracking_number}",
                headers=self._get_headers(),
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get tracking info: {response.text}")
            
            data = response.json()
            
            # Parse tracking events
            events = []
            for event in data.get("tracking_details", []):
                events.append({
                    "status": event.get("status"),
                    "description": event.get("description"),
                    "timestamp": event.get("timestamp"),
                    "location": event.get("origin_location"),
                })
            
            return TrackingInfoResponse(
                tracking_number=tracking_number,
                tracking_url=f"https://inpost.pl/sledzenie-przesylek?number={tracking_number}",
                status=data.get("status", "unknown"),
                status_description=data.get("status_description"),
                last_update=datetime.fromisoformat(data.get("updated_at", datetime.now(timezone.utc).isoformat())),
                events=events,
            )
    
    async def update_shipment_status(
        self,
        shipment_id: UUID,
    ) -> InPostShipment:
        """
        Update shipment status from InPost API.
        
        Args:
            shipment_id: Shipment ID
            
        Returns:
            Updated shipment
        """
        shipment = await self.get_shipment(shipment_id)
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")
        
        if not shipment.shipment_id:
            raise ValueError("Shipment not yet created in InPost")
        
        api_url = self.get_api_url()
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{api_url}/organizations/{await self._get_organization_id()}/shipments/{shipment.shipment_id}",
                headers=self._get_headers(),
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to get shipment status: {response.text}")
            
            data = response.json()
            
            old_status = shipment.status
            new_status = self._map_inpost_status(data.get("status"))
            
            if new_status != old_status:
                shipment.status = new_status
                shipment.status_description = data.get("status_description")
                
                status_entry = {
                    "status": new_status.value,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "description": data.get("status_description"),
                }
                if not shipment.status_history:
                    shipment.status_history = []
                shipment.status_history.append(status_entry)
                
                if new_status == ShipmentStatus.DELIVERED and not shipment.delivered_at:
                    shipment.delivered_at = datetime.now(timezone.utc)
                elif new_status == ShipmentStatus.DISPATCHED_BY_SENDER and not shipment.dispatched_at:
                    shipment.dispatched_at = datetime.now(timezone.utc)
            
            if data.get("tracking_number") and data.get("tracking_number") != shipment.tracking_number:
                shipment.tracking_number = data.get("tracking_number")
                shipment.tracking_url = f"https://inpost.pl/sledzenie-przesylek?number={shipment.tracking_number}"
            
            if data.get("cost") is not None:
                shipment.cost = data.get("cost")
            
            if "href" in data.get("_links", {}).get("label", {}):
                shipment.label_url = data["_links"]["label"]["href"]
            
            shipment.inpost_response = data
            self.db.commit()
            self.db.refresh(shipment)
        
        return shipment
    
    def _map_inpost_status(self, inpost_status: str) -> ShipmentStatus:
        """Map InPost status to internal status."""
        status_map = {
            "created": ShipmentStatus.CREATED,
            "confirmed": ShipmentStatus.CONFIRMED,
            "dispatched_by_sender": ShipmentStatus.DISPATCHED_BY_SENDER,
            "collected_from_sender": ShipmentStatus.COLLECTED_FROM_SENDER,
            "taken_by_courier": ShipmentStatus.TAKEN_BY_COURIER,
            "adopted_at_source_branch": ShipmentStatus.ADOPTED_AT_SOURCE_BRANCH,
            "sent_from_source_branch": ShipmentStatus.SENT_FROM_SOURCE_BRANCH,
            "ready_to_pickup": ShipmentStatus.READY_TO_PICKUP,
            "out_for_delivery": ShipmentStatus.OUT_FOR_DELIVERY,
            "delivered": ShipmentStatus.DELIVERED,
            "pickup_reminder_sent": ShipmentStatus.PICKUP_REMINDER_SENT,
            "returned_to_sender": ShipmentStatus.RETURNED_TO_SENDER,
            "avizo": ShipmentStatus.AVIZO,
            "canceled": ShipmentStatus.CANCELED,
        }
        return status_map.get(inpost_status, ShipmentStatus.CREATED)
    
    async def cancel_shipment(
        self,
        shipment_id: UUID,
        reason: Optional[str] = None,
    ) -> InPostShipment:
        """
        Cancel a shipment.
        
        Args:
            shipment_id: Shipment ID
            reason: Cancellation reason
            
        Returns:
            Cancelled shipment
        """
        shipment = await self.get_shipment(shipment_id)
        if not shipment:
            raise ValueError(f"Shipment {shipment_id} not found")
        
        if shipment.status in [ShipmentStatus.DELIVERED, ShipmentStatus.CANCELED]:
            raise ValueError(f"Cannot cancel shipment in status {shipment.status}")
        
        if shipment.shipment_id:
            # Cancel in InPost API
            api_url = self.get_api_url()
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.delete(
                    f"{api_url}/organizations/{await self._get_organization_id()}/shipments/{shipment.shipment_id}",
                    headers=self._get_headers(),
                )
                
                if response.status_code not in [200, 204]:
                    raise Exception(f"Failed to cancel shipment: {response.text}")
        
        # Update status
        shipment.status = ShipmentStatus.CANCELED
        shipment.status_description = reason or "Cancelled by user"
        
        # Add to status history
        status_entry = {
            "status": ShipmentStatus.CANCELED.value,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "description": reason or "Cancelled by user",
        }
        if not shipment.status_history:
            shipment.status_history = []
        shipment.status_history.append(status_entry)
        
        self.db.commit()
        self.db.refresh(shipment)
        
        return shipment
    
    async def search_parcel_lockers(
        self,
        city: Optional[str] = None,
        post_code: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        radius: int = 5000,  # meters
    ) -> List[ParcelLockerSearchResponse]:
        """
        Search for parcel lockers.
        
        Args:
            city: City name
            post_code: Postal code
            latitude: Latitude
            longitude: Longitude
            radius: Search radius in meters
            
        Returns:
            List of parcel lockers
        """
        api_url = self.get_api_url()
        
        params: Dict[str, Any] = {}
        if city:
            params["city"] = city
        if post_code:
            params["post_code"] = post_code
        if latitude and longitude:
            params["latitude"] = latitude
            params["longitude"] = longitude
            params["radius"] = radius
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{api_url}/points",
                params=params,
                headers={"Accept": "application/json"},
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to search parcel lockers: {response.text}")
            
            data = response.json()
            
            lockers = []
            for item in data.get("items", []):
                lockers.append(ParcelLockerSearchResponse(
                    name=item.get("name"),
                    address=item.get("address", {}),
                    location=item.get("location", {}),
                    location_description=item.get("location_description"),
                    opening_hours=item.get("opening_hours"),
                    functions=item.get("functions", []),
                    payment_available=item.get("payment_available", False),
                    parcel_locker_available=item.get("type") == "parcel_locker",
                ))
            
            return lockers
    
    async def handle_webhook(self, event_data: Dict[str, Any]) -> None:
        """
        Handle InPost webhook event.
        
        Args:
            event_data: Webhook event data
        """
        try:
            event_type = event_data.get("event")
            shipment_data = event_data.get("data", {})
            
            # Find shipment by InPost shipment ID or tracking number
            shipment_id = shipment_data.get("id")
            tracking_number = shipment_data.get("tracking_number")
            
            shipment = self.db.query(InPostShipment).filter(
                or_(
                    InPostShipment.shipment_id == shipment_id,
                    InPostShipment.tracking_number == tracking_number,
                )
            ).first()
            
            if not shipment:
                logger.warning(f"Shipment not found for webhook event: {event_type}")
                return
            
            if event_type in ["status.updated", "shipment.updated"]:
                new_status = self._map_inpost_status(shipment_data.get("status", ""))
                
                updated = False
                
                if new_status != shipment.status:
                    shipment.status = new_status
                    shipment.status_description = shipment_data.get("status_description")
                    updated = True
                    
                    status_entry = {
                        "status": new_status.value,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "description": shipment_data.get("status_description"),
                        "event_type": event_type,
                    }
                    if not shipment.status_history:
                        shipment.status_history = []
                    shipment.status_history.append(status_entry)
                    
                    if new_status == ShipmentStatus.DELIVERED and not shipment.delivered_at:
                        shipment.delivered_at = datetime.now(timezone.utc)
                    elif new_status == ShipmentStatus.DISPATCHED_BY_SENDER and not shipment.dispatched_at:
                        shipment.dispatched_at = datetime.now(timezone.utc)
                
                if shipment_data.get("tracking_number") and shipment_data.get("tracking_number") != shipment.tracking_number:
                    shipment.tracking_number = shipment_data.get("tracking_number")
                    shipment.tracking_url = f"https://inpost.pl/sledzenie-przesylek?number={shipment.tracking_number}"
                    updated = True
                
                if shipment_data.get("cost") is not None and shipment_data.get("cost") != shipment.cost:
                    shipment.cost = shipment_data.get("cost")
                    updated = True
                
                if "label" in shipment_data.get("_links", {}):
                    label_url = shipment_data["_links"]["label"].get("href")
                    if label_url and label_url != shipment.label_url:
                        shipment.label_url = label_url
                        updated = True
                
                if shipment_data.get("inpost_response"):
                    shipment.inpost_response = shipment_data
                    updated = True
                
                if updated:
                    self.db.commit()
                    logger.info(f"Updated shipment {shipment.id} status to {new_status}")
        
        except Exception as e:
            logger.error(f"Error handling webhook: {e}")
            raise

