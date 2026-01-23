"""
Notifications Router - HTTP and WebSocket endpoints
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from uuid import UUID
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.security import get_current_user_payload
from modules.notifications.websocket import manager
from modules.notifications.service import NotificationService
from modules.notifications import schemas
import logging

logger = logging.getLogger(__name__)
router = APIRouter(tags=["notifications"])


def get_user_id_from_payload(
    user_payload: dict = Depends(get_current_user_payload),
    db: AsyncSession = Depends(get_db)
) -> UUID:
    """Extract user_id from JWT payload"""
    user_id_str = user_payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    try:
        # Try UUID first (model uses UUID)
        return UUID(user_id_str)
    except (ValueError, TypeError):
        # If UUID fails, try to get user by string/int and return their UUID
        # This handles backward compatibility with old tokens
        from sqlalchemy import select
        from modules.auth import models as auth_models
        
        # Try to find user by the string/int ID
        try:
            user_id_int = int(user_id_str)
            # Query user by converting int to string and trying to match
            # Since User.id is UUID, we can't directly match int
            # But we can try to find user by other means if needed
            # For now, require re-login for old tokens
            raise HTTPException(
                status_code=401, 
                detail="Token format outdated. Please log in again to get a new token."
            )
        except ValueError:
            raise HTTPException(
                status_code=401, 
                detail="Invalid user ID in token. Please log in again."
            )


@router.get("/", response_model=List[schemas.NotificationResponse])
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id_from_payload),
):
    """Get user notifications"""
    notifications = await NotificationService.get_user_notifications(
        db=db,
        user_id=user_id,
        limit=limit,
        offset=offset,
        unread_only=unread_only,
    )
    return notifications


@router.get("/unread/count", response_model=dict)
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id_from_payload),
):
    """Get count of unread notifications"""
    count = await NotificationService.get_unread_count(db=db, user_id=user_id)
    return {"count": count}


@router.post("/{notification_id}/read", response_model=dict)
async def mark_as_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id_from_payload),
):
    """Mark notification as read"""
    success = await NotificationService.mark_as_read(
        db=db,
        notification_id=notification_id,
        user_id=user_id,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"success": True}


@router.post("/read-all", response_model=dict)
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id_from_payload),
):
    """Mark all notifications as read"""
    count = await NotificationService.mark_all_as_read(db=db, user_id=user_id)
    return {"success": True, "count": count}


@router.get("/settings", response_model=schemas.NotificationSettingsResponse)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id_from_payload),
):
    """Get user notification settings"""
    settings = await NotificationService.get_user_settings(db=db, user_id=user_id)
    return settings


@router.put("/settings", response_model=schemas.NotificationSettingsResponse)
async def update_settings(
    settings_update: schemas.NotificationSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_user_id_from_payload),
):
    """Update user notification settings"""
    settings = await NotificationService.get_user_settings(db=db, user_id=user_id)
    
    # Update fields
    if settings_update.enabled is not None:
        settings.enabled = settings_update.enabled
    if settings_update.sound is not None:
        settings.sound = settings_update.sound
    if settings_update.desktop is not None:
        settings.desktop = settings_update.desktop
    if settings_update.vibration is not None:
        settings.vibration = settings_update.vibration
    if settings_update.types_enabled is not None:
        settings.types_enabled = settings_update.types_enabled
    if settings_update.do_not_disturb is not None:
        settings.do_not_disturb = settings_update.do_not_disturb
    
    await db.commit()
    await db.refresh(settings)
    return settings


@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint for real-time notifications
    
    Usage from frontend:
    ```typescript
    const ws = new WebSocket(`ws://localhost:8000/api/v1/notifications/ws/${userId}`);
    ws.onmessage = (event) => {
        const notification = JSON.parse(event.data);
        console.log(notification);
    };
    ```
    """
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        await websocket.close(code=1003, reason="Invalid user_id format")
        return
    
    await manager.connect(user_uuid, websocket)
    
    try:
        # Keep connection alive and handle incoming messages (ping/pong)
        while True:
            # Receive ping from client
            data = await websocket.receive_text()
            
            # Respond with pong
            if data == "ping":
                await websocket.send_text("pong")
            
    except WebSocketDisconnect:
        manager.disconnect(user_uuid)
        logger.info(f"Client disconnected: {user_uuid}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_uuid}: {e}")
        manager.disconnect(user_uuid)
