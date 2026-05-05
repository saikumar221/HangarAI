from dotenv import load_dotenv

load_dotenv()

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv("DATABASE_URL", "")

# asyncpg doesn't accept sslmode as a URL query param (psycopg2 convention).
# Strip it and pass ssl=True via connect_args instead.
_db_url = DATABASE_URL.replace("?sslmode=require", "").replace("&sslmode=require", "")
_connect_args = {"ssl": True} if "neon.tech" in _db_url or "sslmode" in DATABASE_URL else {}

engine = create_async_engine(_db_url, connect_args=_connect_args, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
