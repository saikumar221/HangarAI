import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from db.database import init_db
import agents.brainstorm_agent as brainstorm_agent
from routes.brainstorm import router as brainstorm_router
from routes.auth import router as auth_router
from routes.pitch import router as pitch_router
from routes.analysis import router as analysis_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    pg_url = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://").replace("postgres+asyncpg://", "postgres://")
    async with AsyncPostgresSaver.from_conn_string(pg_url) as checkpointer:
        await checkpointer.setup()
        brainstorm_agent.init(checkpointer)
        yield


app = FastAPI(title="HangarAI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(brainstorm_router, prefix="/brainstorm")
app.include_router(auth_router, prefix="/auth")
app.include_router(pitch_router, prefix="/pitch")
app.include_router(analysis_router, prefix="/analysis")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
