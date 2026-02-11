"""
InPost ShipX API service for creating shipments.
"""
import httpx
import os
import logging
import re
from typing import Optional, Dict, Any, Tuple
from pydantic import BaseModel
from decimal import Decimal

logger = logging.getLogger(__name__)


class Address(BaseModel):
    street: str
    building_number: str
    city: str
    post_code: str
    country_code: str = "PL"
    flat_number: Optional[str] = None


class Receiver(BaseModel):
    company_name: Optional[str] = None
    first_name: str
    last_name: str
    email: str
    phone: str
    address: Optional[Address] = None


class ParcelDimensions(BaseModel):
    length: int
    width: int
    height: int
    unit: str = "mm"


class ParcelWeight(BaseModel):
    amount: float
    unit: str = "kg"


class Parcel(BaseModel):
    id: Optional[str] = None
    dimensions: Optional[ParcelDimensions] = None
    weight: Optional[ParcelWeight] = None
    template: Optional[str] = None
    is_non_standard: bool = False


class ShipmentRequest(BaseModel):
    receiver: Receiver
    parcels: list[Parcel]
    service: str
    custom_attributes: Optional[Dict[str, Any]] = None
    reference: Optional[str] = None
    insurance: Optional[Dict[str, Any]] = None


class InPostShipXService:
    """Service for interacting with InPost ShipX API."""
    
    def __init__(self, api_key: Optional[str] = None, organization_id: Optional[str] = None):
        self.api_key = api_key or os.getenv("INPOST_API_KEY", "")
        self.organization_id = organization_id or os.getenv("INPOST_ORGANIZATION_ID", "")
        self.base_url = os.getenv("INPOST_API_URL", "https://api-shipx-pl.easypack24.net/v1")
        
    def _get_headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise ValueError("InPost API key not configured")
        
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
    
    def parse_address_from_description(self, description: Optional[str]) -> Tuple[Optional[str], Optional[str], bool]:
        if not description:
            return None, None, False
        
        paczkomat_pattern = r'(?:InPost\s+)?(?:пачкомат|paczkomat)\s+([A-Z0-9]{6,10})'
        paczkomat_match = re.search(paczkomat_pattern, description, re.IGNORECASE)
        
        is_paczkomat = paczkomat_match is not None
        paczkomat_code = paczkomat_match.group(1) if paczkomat_match else None
        
        address_patterns = [
            r'Адреса:\s*(.+?)(?:\n|$)',
            r'address:\s*(.+?)(?:\n|$)',
            r'Доставка:\s*(.+?)(?:\n|$)',
        ]
        
        address = None
        for pattern in address_patterns:
            match = re.search(pattern, description, re.IGNORECASE | re.MULTILINE)
            if match:
                address = match.group(1).strip()
                break
        
        if not address and description:
            cleaned = re.sub(paczkomat_pattern, '', description, flags=re.IGNORECASE)
            cleaned = re.sub(r'Доставка:.*?\n', '', cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r'Вартість доставки:.*?\n', '', cleaned, flags=re.IGNORECASE)
            address = cleaned.strip() if cleaned.strip() else None
        
        return address, paczkomat_code, is_paczkomat
    
    def parse_address_components(self, address_str: str) -> Address:
        parts = [p.strip() for p in address_str.split(',')]
        
        if len(parts) >= 3:
            street_building = parts[0]
            city = parts[-2] if len(parts) > 2 else parts[-1]
            post_code = parts[-1] if len(parts) > 2 else "00-000"
        elif len(parts) == 2:
            street_building = parts[0]
            city = parts[1]
            post_code = "00-000"
        else:
            street_building = address_str
            city = "Warszawa"
            post_code = "00-000"
        
        street_match = re.match(r'(.+?)\s+(\d+[A-Za-z]?)(?:\s*/\s*(\d+))?', street_building)
        if street_match:
            street = street_match.group(1).strip()
            building = street_match.group(2)
            flat = street_match.group(3) if street_match.group(3) else None
        else:
            street = street_building
            building = "1"
            flat = None
        
        post_code = re.sub(r'[^\d-]', '', post_code)
        if not re.match(r'\d{2}-\d{3}', post_code):
            post_code = "00-000"
        
        return Address(
            street=street,
            building_number=building,
            city=city,
            post_code=post_code,
            country_code="PL",
            flat_number=flat
        )
    
    async def create_shipment(
        self,
        receiver_name: str,
        receiver_surname: str,
        receiver_phone: str,
        receiver_email: str,
        delivery_address: Optional[str] = None,
        paczkomat_code: Optional[str] = None,
        is_paczkomat: bool = False,
        reference: Optional[str] = None,
        parcel_template: str = "medium",
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("InPost API key not configured")
        
        if not self.organization_id:
            raise ValueError("InPost organization ID not configured")
        
        phone = receiver_phone
        if not phone.startswith('+'):
            if phone.startswith('48'):
                phone = '+' + phone
            elif phone.startswith('0'):
                phone = '+48' + phone[1:]
            else:
                phone = '+48' + phone
        
        service = "inpost_locker_standard" if is_paczkomat else "inpost_courier_standard"
        
        receiver_data = {
            "first_name": receiver_name,
            "last_name": receiver_surname,
            "email": receiver_email,
            "phone": phone.replace('+48', ''),
        }
        
        custom_attributes = {}
        
        if is_paczkomat:
            if not paczkomat_code:
                raise ValueError("Paczkomat code is required for locker delivery")
            custom_attributes["target_point"] = paczkomat_code
        else:
            if not delivery_address:
                raise ValueError("Delivery address is required for courier delivery")
            
            address = self.parse_address_components(delivery_address)
            receiver_data["address"] = {
                "street": address.street,
                "building_number": address.building_number,
                "city": address.city,
                "post_code": address.post_code,
                "country_code": address.country_code,
            }
            if address.flat_number:
                receiver_data["address"]["flat_number"] = address.flat_number
        
        parcel = Parcel(template=parcel_template)
        
        request_data = ShipmentRequest(
            receiver=Receiver(**receiver_data),
            parcels=[parcel],
            service=service,
            custom_attributes=custom_attributes if custom_attributes else None,
            reference=reference,
        )
        
        logger.info(f"Creating InPost ShipX shipment: service={service}, reference={reference}")
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/organizations/{self.organization_id}/shipments",
                headers=self._get_headers(),
                json=request_data.model_dump(exclude_none=True),
            )
            
            if response.status_code == 400:
                error_data = response.json()
                error_msg = error_data.get("message", "Validation failed")
                logger.error(f"InPost ShipX validation error: {error_msg}")
                raise ValueError(f"Validation failed: {error_msg}")
            
            if response.status_code == 404:
                logger.error(f"InPost ShipX resource not found: {response.text}")
                raise ValueError("Resource not found")
            
            if response.status_code not in [200, 201]:
                error_text = response.text
                logger.error(f"InPost ShipX API error: {response.status_code} - {error_text}")
                raise Exception(f"InPost ShipX API error: {response.status_code} - {error_text}")
            
            data = response.json()
            
            shipment_id = data.get("id")
            href = data.get("href")
            tracking_number = data.get("tracking_number") or data.get("number")
            
            logger.info(f"InPost ShipX shipment created: id={shipment_id}, tracking={tracking_number}")
            
            return {
                "id": shipment_id,
                "href": href,
                "tracking_number": tracking_number,
                "full_response": data,
            }

