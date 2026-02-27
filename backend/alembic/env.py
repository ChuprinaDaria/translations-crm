from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, MetaData
from alembic import context
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.config import settings

# Import all Base classes used across the project
from core.database import Base as CoreBase
from core.db import Base as AsyncBase
from db import Base as LegacyBase

# Import all models so they register with their respective Base.metadata
try:
    from modules.communications.models import *  # noqa
except ImportError:
    pass
try:
    from modules.crm.models import *  # noqa
except ImportError:
    pass
try:
    from modules.auth.models import *  # noqa
except ImportError:
    pass
try:
    from modules.finance.models import *  # noqa
except ImportError:
    pass
try:
    from modules.payment.models import *  # noqa
except ImportError:
    pass
try:
    from modules.notifications.models import *  # noqa
except ImportError:
    pass
try:
    from modules.postal_services.models import *  # noqa
except ImportError:
    pass
try:
    from modules.ai_integration.models import *  # noqa
except ImportError:
    pass
try:
    from modules.autobot.models import *  # noqa
except ImportError:
    pass
try:
    import models  # noqa: legacy models
except ImportError:
    pass

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set database URL from settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Merge metadata from all Base classes so Alembic sees every table
combined_metadata = MetaData()
for base in (LegacyBase, CoreBase, AsyncBase):
    for table in base.metadata.tables.values():
        if table.name not in combined_metadata.tables:
            table.tometadata(combined_metadata)

target_metadata = combined_metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
