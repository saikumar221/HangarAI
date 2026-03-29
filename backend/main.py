from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db.database import init_db
from routes.brainstorm import router as brainstorm_router
from routes.auth import router as auth_router
from routes.pitch import router as pitch_router
from routes.analysis import router as analysis_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all DB tables on startup if they don't exist
    await init_db()
    yield


app = FastAPI(title="HangarAI API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register brainstorm routes under /brainstorm prefix
app.include_router(brainstorm_router, prefix="/brainstorm")
app.include_router(auth_router, prefix="/auth")
app.include_router(pitch_router, prefix="/pitch")
app.include_router(analysis_router, prefix="/analysis")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
