"""
Analytics routes - dashboards and reports endpoints.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from modules.auth.dependencies import get_current_user_db
import models

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
def get_dashboard(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user_db),
):
    """Get dashboard data."""
    # TODO: Implement dashboard metrics
    return {
        "metrics": {
            "clients": 0,
            "orders": 0,
            "revenue": 0,
        }
    }

