from contextlib import asynccontextmanager
from fastapi import FastAPI
from db.database import init_db
from routes.brainstorm import router as brainstorm_router
from routes.auth import router as auth_router
from routes.pitch import router as pitch_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables on startup if they don't exist
    await init_db()
    yield


app = FastAPI(title="HangarAI API", lifespan=lifespan)

# Register brainstorm routes under /brainstorm prefix
app.include_router(brainstorm_router, prefix="/brainstorm")
app.include_router(auth_router, prefix="/auth")
app.include_router(pitch_router, prefix="/pitch")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
