import base64
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from hume import AsyncHumeClient
from hume.expression_measurement.stream.stream.types.config import Config
from hume.expression_measurement.stream.stream.types.stream_model_predictions import StreamModelPredictions

from db.database import get_db, AsyncSessionLocal
from db.models import PitchSession, PitchVideoSnapshot, PitchAudioSegment, StartupManifest, User
from core.security import get_current_user
from core.utils import parse_uuid

router = APIRouter()

HUME_API_KEY = os.getenv("HUME_API_KEY")


class CreatePitchSessionRequest(BaseModel):
    session_id: str
    investor_first_name: str
    investor_last_name: str
    investor_company: str
    investor_linkedin: str | None = None
    investor_notes: str | None = None


class VideoInsightSnapshot(BaseModel):
    timestamp: int
    eye_contact_score: float
    expression_score: float
    posture_score: float
    head_movement_score: float


@router.post("/sessions")
async def create_pitch_session(
    body: CreatePitchSessionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Attach the user's startup manifest if one exists, so the pitch has startup context
    manifest_result = await db.execute(
        select(StartupManifest).where(StartupManifest.user_id == current_user.id)
    )
    manifest = manifest_result.scalar_one_or_none()

    # Use the client-supplied UUID so the audio WebSocket can reference the same
    # session ID before this HTTP response is fully awaited on the frontend
    pitch_session = PitchSession(
        id=uuid.UUID(body.session_id),
        user_id=current_user.id,
        manifest_id=manifest.id if manifest else None,
        investor_first_name=body.investor_first_name,
        investor_last_name=body.investor_last_name,
        investor_company=body.investor_company,
        investor_linkedin=body.investor_linkedin,
        investor_notes=body.investor_notes,
    )
    db.add(pitch_session)
    await db.commit()
    return {"session_id": str(pitch_session.id)}


@router.post("/sessions/{session_id}/video-analysis")
async def receive_video_analysis(
    session_id: str,
    snapshots: list[VideoInsightSnapshot],
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PitchSession).where(PitchSession.id == parse_uuid(session_id))
    )
    pitch_session = result.scalar_one_or_none()
    if not pitch_session:
        raise HTTPException(status_code=404, detail="Pitch session not found")

    for s in snapshots:
        db.add(PitchVideoSnapshot(
            pitch_session_id=pitch_session.id,
            timestamp=s.timestamp,
            eye_contact_score=s.eye_contact_score,
            expression_score=s.expression_score,
            posture_score=s.posture_score,
            head_movement_score=s.head_movement_score,
        ))

    await db.commit()
    print(f"[pitch:{session_id}] saved {len(snapshots)} video snapshots")
    return {"session_id": session_id, "saved": len(snapshots)}


@router.websocket("/ws/{session_id}/audio")
async def audio_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()

    client = AsyncHumeClient(api_key=HUME_API_KEY)
    config = Config(prosody={})

    TRACKED_EMOTIONS = {
        "Determination", "Pride", "Triumph", "Enthusiasm", "Excitement",
        "Anxiety", "Awkwardness", "Fear", "Distress", "Doubt", "Embarrassment",
        "Interest", "Concentration", "Calmness",
        "Confusion", "Boredom", "Tiredness", "Sadness",
    }

    CHUNK_DURATION = 1.5  # seconds, matches recorder.start(1500) on the frontend
    audio_chunk_idx = 0
    # Accumulate in memory during the connection; flushed to DB after the socket
    # closes because WebSocket routes can't use Depends(get_db) for the full lifetime
    audio_segments: list[tuple[float, float, list]] = []

    async with client.expression_measurement.stream.connect() as hume_socket:
        webm_header: bytes = b""

        try:
            while True:
                data = await websocket.receive_bytes()

                if not webm_header:
                    # First chunk is the WebM container header and carries no audio frames.
                    webm_header = data
                    continue

                payload = webm_header + data
                start_time = audio_chunk_idx * CHUNK_DURATION
                end_time = start_time + CHUNK_DURATION
                audio_chunk_idx += 1

                b64_audio = base64.b64encode(payload).decode()
                try:
                    response = await hume_socket.send_file(file_=b64_audio, config=config)
                except Exception as e:
                    print(f"[pitch:{session_id}] hume send error: {e}")
                    continue

                if not isinstance(response, StreamModelPredictions):
                    continue

                prosody = response.prosody
                if not prosody or not prosody.predictions:
                    continue

                for prediction in prosody.predictions:
                    if not prediction.emotions:
                        continue
                    top_emotions = sorted(
                        [
                            {"name": e.name, "score": round(e.score, 4)}
                            for e in prediction.emotions
                            if e.name in TRACKED_EMOTIONS and e.score is not None
                        ],
                        key=lambda x: x["score"],
                        reverse=True,
                    )
                    if top_emotions:
                        audio_segments.append((start_time, end_time, top_emotions))

        except WebSocketDisconnect:
            print(f"[pitch:{session_id}] audio WebSocket disconnected")

    # Open a fresh DB session after the WebSocket closes to persist the accumulated segments.
    if audio_segments:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(PitchSession).where(PitchSession.id == parse_uuid(session_id))
            )
            if result.scalar_one_or_none():
                for start_time, end_time, emotions in audio_segments:
                    db.add(
                        PitchAudioSegment(
                            pitch_session_id=uuid.UUID(session_id),
                            start_time=start_time,
                            end_time=end_time,
                            emotions=emotions,
                        )
                    )
                await db.commit()
                print(f"[pitch:{session_id}] saved {len(audio_segments)} audio segments")
            else:
                print(f"[pitch:{session_id}] session not found, skipping audio segment save")
