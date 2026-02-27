"""One-time script to add missing indexes. Run inside container: python scripts/add_indexes.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import text

try:
    from core.database import engine
except ImportError:
    from db import engine

indexes = [
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conv_platform_archived ON communications_conversations(platform, is_archived);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_conv_created ON communications_messages(conversation_id, created_at DESC);",
    "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_conv_dir_status ON communications_messages(conversation_id, direction, status);",
    "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_conv_platform_external ON communications_conversations(platform, external_id);",
]

if __name__ == "__main__":
    with engine.connect() as conn:
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        for idx_sql in indexes:
            print(f"Executing: {idx_sql}")
            conn.execute(text(idx_sql))
        print("All indexes created successfully.")
