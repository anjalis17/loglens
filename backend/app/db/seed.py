"""
Seed script: creates a test org, admin user, member user, and one subject.

Usage (from inside the fastapi container):
    python -m app.db.seed

Credentials:
    Admin:  admin@loglens.dev / password123
    Member: member@loglens.dev / password123
"""
import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os

from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.subject import Subject
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://loglens:loglens@postgres:5432/loglens"
)


async def seed() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        async with session.begin():
            org = Organization(name="Acme University")
            session.add(org)
            await session.flush()

            admin = User(
                email="admin@loglens.dev",
                hashed_password=pwd_context.hash("password123"),
                org_id=org.id,
                role=UserRole.admin,
            )
            member = User(
                email="member@loglens.dev",
                hashed_password=pwd_context.hash("password123"),
                org_id=org.id,
                role=UserRole.member,
            )
            session.add_all([admin, member])
            await session.flush()

            subject = Subject(
                org_id=org.id,
                created_by_user_id=admin.id,
                full_name="Alex Chen",
                role_title="Software Engineering Intern",
                relationship_type="direct report",
            )
            session.add(subject)

    await engine.dispose()
    print("Seed complete.")
    print("  Admin:  admin@loglens.dev / password123")
    print("  Member: member@loglens.dev / password123")


if __name__ == "__main__":
    asyncio.run(seed())
