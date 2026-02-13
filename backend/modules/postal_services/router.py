"""
Postal Services Router - InPost API endpoints.
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
import logging

from core.database import get_db  # Використовуємо синхронну версію для InPostService
from modules.auth.dependencies import get_current_user_db
from modules.auth import models as auth_models
from modules.postal_services.service import InPostService
from modules.postal_services import schemas
from modules.postal_services.models import InPostSettings, InPostShipment
from backend import crud

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/postal-services", tags=["Postal Services"])


def get_inpost_service(db: Session = Depends(get_db)) -> InPostService:
    """Get InPost service instance."""
    return InPostService(db)


# Shipment endpoints
@router.post("/inpost/shipments", response_model=schemas.ShipmentResponse)
async def create_shipment(
    request: schemas.CreateShipmentRequest,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Create a new InPost shipment."""
    try:
        shipment = await service.create_shipment(request)
        return shipment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating shipment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/inpost/shipments", response_model=schemas.ShipmentListResponse)
async def list_organization_shipments(
    page: int = 1,
    per_page: int = 100,
    sort_by: str = "id",
    sort_order: str = "desc",
    owner_id: Optional[int] = None,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get list of shipments for the organization."""
    try:
        shipments = await service.get_organization_shipments(
            page=page,
            per_page=per_page,
            sort_by=sort_by,
            sort_order=sort_order,
            owner_id=owner_id,
        )
        return shipments
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting shipments list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/inpost/shipments/{shipment_id}", response_model=schemas.ShipmentResponse)
async def get_shipment(
    shipment_id: UUID,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get shipment by ID."""
    shipment = await service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return shipment


@router.get("/inpost/shipments/by-order/{order_id}", response_model=schemas.ShipmentResponse)
async def get_shipment_by_order(
    order_id: UUID,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get shipment by order ID."""
    shipment = await service.get_shipment_by_order(order_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found for this order")
    return shipment


@router.get("/inpost/shipments/{shipment_id}/status", response_model=schemas.ShipmentStatusResponse)
async def get_shipment_status(
    shipment_id: UUID,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get current shipment status."""
    shipment = await service.get_shipment(shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    
    return schemas.ShipmentStatusResponse(
        shipment_id=shipment.id,
        tracking_number=shipment.tracking_number,
        status=shipment.status.value,
        status_description=shipment.status_description,
        tracking_url=shipment.tracking_url,
        updated_at=shipment.updated_at,
        status_history=shipment.status_history,
    )


@router.post("/inpost/shipments/{shipment_id}/refresh", response_model=schemas.ShipmentResponse)
async def refresh_shipment_status(
    shipment_id: UUID,
    background_tasks: BackgroundTasks,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Refresh shipment status from InPost API."""
    try:
        shipment = await service.update_shipment_status(shipment_id)
        return shipment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error refreshing shipment status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/inpost/shipments/{shipment_id}", response_model=schemas.ShipmentResponse)
async def cancel_shipment(
    shipment_id: UUID,
    request: Optional[schemas.CancelShipmentRequest] = None,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Cancel a shipment."""
    try:
        reason = request.reason if request else None
        shipment = await service.cancel_shipment(shipment_id, reason)
        return shipment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling shipment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Tracking endpoints
@router.get("/inpost/tracking/{tracking_number}", response_model=schemas.TrackingInfoResponse)
async def get_tracking_info(
    tracking_number: str,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get tracking information by tracking number."""
    try:
        tracking_info = await service.get_tracking_info(tracking_number)
        return tracking_info
    except Exception as e:
        logger.error(f"Error getting tracking info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Status endpoints
@router.get("/inpost/statuses", response_model=schemas.StatusListResponse)
async def get_statuses(
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get list of all available InPost shipment statuses."""
    try:
        statuses = await service.get_statuses()
        return statuses
    except Exception as e:
        logger.error(f"Error getting statuses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Parcel locker search
@router.get("/inpost/parcel-lockers", response_model=List[schemas.ParcelLockerSearchResponse])
async def search_parcel_lockers(
    city: Optional[str] = None,
    post_code: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    radius: int = 5000,
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """
    Search for parcel lockers.
    
    Provide either:
    - city and/or post_code
    - latitude and longitude (with optional radius)
    """
    if not any([city, post_code, (latitude and longitude)]):
        raise HTTPException(
            status_code=400,
            detail="Provide either city/post_code or latitude/longitude"
        )
    
    try:
        lockers = await service.search_parcel_lockers(
            city=city,
            post_code=post_code,
            latitude=latitude,
            longitude=longitude,
            radius=radius,
        )
        return lockers
    except Exception as e:
        logger.error(f"Error searching parcel lockers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Settings endpoints
@router.get("/inpost/settings", response_model=schemas.InPostSettingsResponse)
async def get_inpost_settings(
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Get InPost settings."""
    settings = service.settings
    
    # Mask API key for security
    masked_key = None
    if settings.api_key:
        masked_key = settings.api_key[:4] + "*" * (len(settings.api_key) - 8) + settings.api_key[-4:]
    
    return schemas.InPostSettingsResponse(
        id=settings.id,
        api_key=masked_key,
        organization_id=settings.organization_id,
        api_url=settings.api_url,
        sandbox_mode=settings.sandbox_mode,
        webhook_url=settings.webhook_url,
        default_sender_email=settings.default_sender_email,
        default_sender_phone=settings.default_sender_phone,
        default_sender_name=settings.default_sender_name,
        is_enabled=settings.is_enabled,
    )


@router.put("/inpost/settings", response_model=schemas.InPostSettingsResponse)
async def update_inpost_settings(
    update: schemas.InPostSettingsUpdate,
    db: Session = Depends(get_db),
    service: InPostService = Depends(get_inpost_service),
    user: auth_models.User = Depends(get_current_user_db),
):
    """Update InPost settings."""
    settings = service.settings
    
    # Update fields
    if update.api_key is not None:
        settings.api_key = update.api_key
        # Sync to AppSetting (new system) for consistency
        crud.set_setting(db, "inpost_token", update.api_key)
    if update.organization_id is not None:
        settings.organization_id = update.organization_id
        # Sync to AppSetting
        crud.set_setting(db, "inpost_organization_id", update.organization_id)
    if update.sandbox_mode is not None:
        settings.sandbox_mode = update.sandbox_mode
        # Sync to AppSetting
        crud.set_setting(db, "inpost_sandbox_mode", str(update.sandbox_mode).lower())
    if update.sandbox_api_key is not None:
        settings.sandbox_api_key = update.sandbox_api_key
    if update.webhook_url is not None:
        settings.webhook_url = update.webhook_url
    if update.webhook_secret is not None:
        settings.webhook_secret = update.webhook_secret
    if update.default_sender_email is not None:
        settings.default_sender_email = update.default_sender_email
    if update.default_sender_phone is not None:
        settings.default_sender_phone = update.default_sender_phone
    if update.default_sender_name is not None:
        settings.default_sender_name = update.default_sender_name
    if update.is_enabled is not None:
        settings.is_enabled = update.is_enabled
    
    db.commit()
    db.refresh(settings)
    
    # Mask API key for security
    masked_key = None
    if settings.api_key:
        masked_key = settings.api_key[:4] + "*" * (len(settings.api_key) - 8) + settings.api_key[-4:]
    
    return schemas.InPostSettingsResponse(
        id=settings.id,
        api_key=masked_key,
        organization_id=settings.organization_id,
        api_url=settings.api_url,
        sandbox_mode=settings.sandbox_mode,
        webhook_url=settings.webhook_url,
        default_sender_email=settings.default_sender_email,
        default_sender_phone=settings.default_sender_phone,
        default_sender_name=settings.default_sender_name,
        is_enabled=settings.is_enabled,
    )


# Webhook endpoint
@router.post("/inpost/webhook")
async def inpost_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    InPost webhook endpoint for real-time status updates.
    
    This endpoint does not require authentication as it's called by InPost.
    Instead, it should verify the webhook secret.
    """
    try:
        # Get webhook secret from settings
        settings = db.query(InPostSettings).first()
        if not settings:
            raise HTTPException(status_code=500, detail="InPost settings not configured")
        
        # Verify webhook secret if configured
        if settings.webhook_secret:
            webhook_secret = request.headers.get("X-Webhook-Secret")
            if webhook_secret != settings.webhook_secret:
                raise HTTPException(status_code=401, detail="Invalid webhook secret")
        
        # Parse webhook data
        event_data = await request.json()
        
        logger.info(f"Received InPost webhook: {event_data.get('event')}")
        
        # Process webhook in background
        service = InPostService(db)
        background_tasks.add_task(service.handle_webhook, event_data)
        
        return {"status": "accepted"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

