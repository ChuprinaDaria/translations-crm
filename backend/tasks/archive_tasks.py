"""
Background tasks for archiving old conversations.
"""
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from core.database import get_db
from modules.communications.models import Conversation
import logging

logger = logging.getLogger(__name__)


async def archive_old_conversations():
    """
    Archive conversations older than 30 days without new messages.
    This task should run daily (e.g., at 3:00 AM).
    """
    db: Session = next(get_db())
    
    try:
        # Calculate threshold: 30 days ago
        threshold = datetime.now(timezone.utc) - timedelta(days=30)
        
        # Find conversations to archive:
        # - Not already archived
        # - Have last_message_at older than 30 days
        conversations_to_archive = db.query(Conversation).filter(
            Conversation.is_archived == False,
            Conversation.last_message_at.isnot(None),
            Conversation.last_message_at < threshold,
        ).all()
        
        archived_count = 0
        for conversation in conversations_to_archive:
            conversation.is_archived = True
            archived_count += 1
        
        db.commit()
        
        logger.info(f"Archived {archived_count} conversations older than 30 days")
        
        return {
            "status": "success",
            "archived_count": archived_count,
            "threshold": threshold.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error archiving old conversations: {e}", exc_info=True)
        db.rollback()
        raise
    finally:
        db.close()

