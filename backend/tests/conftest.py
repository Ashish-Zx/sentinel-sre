"""Shared pytest fixtures for SentinelSRE backend tests.

Tests run against a dedicated Postgres database (``sentinel_test``) on the
local Docker instance so pgvector-native types and Postgres ENUMs work
(SQLite is not compatible with this schema).
"""

import httpx
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from backend.core.security import CurrentUser, get_current_user
from backend.db.base import Base
from backend.db.session import get_db
from backend.main import app

ADMIN_URL = "postgresql+asyncpg://sentinel:sentinel@localhost:5432/postgres"
TEST_DB = "sentinel_test"
TEST_URL = f"postgresql+asyncpg://sentinel:sentinel@localhost:5432/{TEST_DB}"

TEST_USER = CurrentUser(
    clerk_user_id="test-user-1",
    email="test@example.com",
    first_name="Test",
    last_name="User",
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _ensure_test_database():
    """Create the test database (idempotent) and enable pgvector."""
    admin = create_async_engine(
        ADMIN_URL, isolation_level="AUTOCOMMIT", poolclass=NullPool
    )
    async with admin.connect() as conn:
        exists = await conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"),
            {"name": TEST_DB},
        )
        if not exists:
            await conn.execute(text(f'CREATE DATABASE "{TEST_DB}"'))
    await admin.dispose()

    engine = create_async_engine(TEST_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(TEST_URL, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


def _make_factory(db_engine):
    return async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def client(db_engine):
    """FastAPI test client with DB + auth dependency overrides."""

    factory = _make_factory(db_engine)

    async def override_get_db():
        async with factory() as session:
            yield session

    async def override_current_user():
        return TEST_USER

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def anon_client(db_engine):
    """FastAPI test client with DB override but real (rejected) auth."""

    factory = _make_factory(db_engine)

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as c:
        yield c
    app.dependency_overrides.clear()
