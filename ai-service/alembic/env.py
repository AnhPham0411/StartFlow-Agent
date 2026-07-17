from __future__ import annotations

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from src.core.database import prepare_asyncpg_connection
from src.core.settings import get_settings
from src.rag.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
settings = get_settings()
if not settings.ai_database_url:
    raise RuntimeError("AI_DATABASE_URL is required to run migrations")
database_url, connect_args = prepare_asyncpg_connection(
    settings.ai_database_url, settings.db_ssl_mode, settings.db_ssl_root_cert
)
config.set_main_option(
    "sqlalchemy.url", database_url.render_as_string(hide_password=False).replace("%", "%%")
)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, include_schemas=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
