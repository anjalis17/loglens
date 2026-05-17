import asyncio
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text

from app.main import app
from app.deps import get_db
from app.models.organization import Base, Organization
from app.models.user import User, UserRole
from passlib.context import CryptContext

TEST_DB_URL = "postgresql+asyncpg://loglens:loglens@localhost:5432/loglens_test"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def engine():
    eng = create_async_engine(TEST_DB_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db(engine):
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db):
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def org_and_user(db):
    org = Organization(name="Test Org")
    db.add(org)
    await db.flush()
    user = User(
        email=f"user_{uuid.uuid4().hex[:6]}@test.com",
        hashed_password=pwd_context.hash("testpass"),
        org_id=org.id,
        role=UserRole.admin,
    )
    db.add(user)
    await db.commit()
    return org, user


@pytest_asyncio.fixture
async def auth_headers(client, org_and_user):
    org, user = org_and_user
    resp = await client.post("/auth/login", json={"email": user.email, "password": "testpass"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
