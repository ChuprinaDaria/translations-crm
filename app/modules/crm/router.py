"""
CRM routes - clients, orders, KP endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
import models

router = APIRouter(prefix="/crm", tags=["crm"])


@router.get("/clients")
def get_clients(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """Get clients list."""
    # TODO: Move client routes here
    return {"clients": []}


@router.get("/orders")
def get_orders(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """Get orders list."""
    # TODO: Implement orders workflow
    return {"orders": []}

