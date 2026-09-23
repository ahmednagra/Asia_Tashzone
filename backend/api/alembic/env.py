import os
from logging.config import fileConfig

from sqlalchemy import create_engine

import app.Models  # noqa: F401  (registers every table on Base.metadata)
from alembic import context
from config.database import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run() -> None:
    url = os.environ["DATABASE_URL"]
    engine = create_engine(url)
    with engine.connect() as conn:
        context.configure(connection=conn, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


run()
