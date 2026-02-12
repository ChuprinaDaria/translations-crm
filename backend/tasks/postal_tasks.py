"""
Postal Services Tasks - автоматичне оновлення статусів shipment.
"""
import logging
import asyncio
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

DATABASE_URL = None

def get_db_session():
    """Get database session for tasks."""
    global DATABASE_URL
    if not DATABASE_URL:
        import os
        DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://translator:traslatorini2025@localhost:5434/crm_db")
    
    engine = create_engine(DATABASE_URL)
    Session = sessionmaker(bind=engine)
    return Session()


@celery_app.task(name="update_shipment_status_task", bind=True, max_retries=3)
def update_shipment_status_task(self, shipment_id: str):
    """
    Оновити статус одного shipment з InPost API.
    
    Args:
        shipment_id: UUID shipment в форматі string
    """
    db = get_db_session()
    try:
        from modules.postal_services.service import InPostService
        from uuid import UUID as UUIDType
        
        service = InPostService(db)
        shipment_uuid = UUIDType(shipment_id)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            shipment = loop.run_until_complete(service.update_shipment_status(shipment_uuid))
            logger.info(f"Updated shipment {shipment_id} status to {shipment.status}")
            return {"shipment_id": shipment_id, "status": shipment.status.value}
        finally:
            loop.close()
    
    except Exception as e:
        logger.error(f"Error updating shipment {shipment_id}: {e}")
        raise self.retry(exc=e, countdown=60)
    finally:
        db.close()


@celery_app.task(name="update_all_active_shipments_task")
def update_all_active_shipments_task():
    """
    Оновити статуси всіх активних shipments з InPost API.
    Виконується періодично через Celery Beat.
    """
    db = get_db_session()
    try:
        from modules.postal_services.models import InPostShipment, ShipmentStatus
        
        active_statuses = [
            ShipmentStatus.CREATED,
            ShipmentStatus.CONFIRMED,
            ShipmentStatus.DISPATCHED_BY_SENDER,
            ShipmentStatus.COLLECTED_FROM_SENDER,
            ShipmentStatus.TAKEN_BY_COURIER,
            ShipmentStatus.ADOPTED_AT_SOURCE_BRANCH,
            ShipmentStatus.SENT_FROM_SOURCE_BRANCH,
            ShipmentStatus.READY_TO_PICKUP,
            ShipmentStatus.OUT_FOR_DELIVERY,
        ]
        
        cutoff_time = datetime.utcnow() - timedelta(days=30)
        
        shipments = db.query(InPostShipment).filter(
            InPostShipment.status.in_([s.value for s in active_statuses]),
            InPostShipment.shipment_id.isnot(None),
            InPostShipment.created_at >= cutoff_time
        ).all()
        
        logger.info(f"Found {len(shipments)} active shipments to update")
        
        if not shipments:
            return {"updated": 0, "errors": 0, "total": 0}
        
        from modules.postal_services.service import InPostService
        service = InPostService(db)
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        updated_count = 0
        error_count = 0
        
        try:
            for shipment in shipments:
                try:
                    loop.run_until_complete(service.update_shipment_status(shipment.id))
                    updated_count += 1
                except Exception as e:
                    logger.error(f"Error updating shipment {shipment.id}: {e}")
                    error_count += 1
        finally:
            loop.close()
        
        logger.info(f"Updated {updated_count} shipments, {error_count} errors")
        return {"updated": updated_count, "errors": error_count, "total": len(shipments)}
    
    except Exception as e:
        logger.error(f"Error in update_all_active_shipments_task: {e}", exc_info=True)
        raise
    finally:
        db.close()

