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
from deepgram import DeepgramClient, PrerecordedOptions

from db.database import get_db, AsyncSessionLocal
from db.models import PitchSession, PitchVideoSnapshot, PitchAudioSegment, PitchTranscript, StartupManifest, User
from core.security import get_current_user
from core.utils import parse_uuid

router = APIRouter()

HUME_API_KEY = os.getenv("HUME_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")


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


async def _transcribe_audio(audio_bytes: bytes) -> list[tuple[float, float, str, float | None]]:
    """Send the full WebM audio to Deepgram prerecorded API.

    Returns a list of (start_time, end_time, text, confidence) tuples,
    one per utterance.  Returns an empty list on any error.
    """
    if not DEEPGRAM_API_KEY or not audio_bytes:
        return []
    try:
        client = DeepgramClient(DEEPGRAM_API_KEY)
        options = PrerecordedOptions(
            model="nova-3",
            utterances=True,
            punctuate=True,
            smart_format=True,
        )
        response = await client.listen.asyncrest.v("1").transcribe_file(
            {"buffer": audio_bytes, "mimetype": "audio/webm"},
            options,
        )
        utterances = (response.results.utterances or []) if response.results else []
        segments: list[tuple[float, float, str, float | None]] = []
        for u in utterances:
            text = (u.transcript or "").strip()
            if text:
                segments.append((
                    float(u.start),
                    float(u.end),
                    text,
                    float(u.confidence) if u.confidence is not None else None,
                ))
        return segments
    except Exception as e:
        print(f"[deepgram] transcription error: {e}")
        return []


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

    # Raw WebM data for Deepgram transcription (header stored separately,
    # each subsequent chunk appended to raw_chunks)
    webm_header_bytes: bytes = b""
    raw_chunks: list[bytes] = []

    async with client.expression_measurement.stream.connect() as hume_socket:
        webm_header: bytes = b""

        try:
            while True:
                data = await websocket.receive_bytes()

                if not webm_header:
                    # First chunk is the WebM container header and carries no audio frames.
                    webm_header = data
                    webm_header_bytes = data
                    continue

                raw_chunks.append(data)

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

    # Open a fresh DB session after the WebSocket closes to persist accumulated data.
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PitchSession).where(PitchSession.id == parse_uuid(session_id))
        )
        if not result.scalar_one_or_none():
            print(f"[pitch:{session_id}] session not found, skipping save")
        else:
            # Save Hume emotion segments
            if audio_segments:
                for start_time, end_time, emotions in audio_segments:
                    db.add(
                        PitchAudioSegment(
                            pitch_session_id=uuid.UUID(session_id),
                            start_time=start_time,
                            end_time=end_time,
                            emotions=emotions,
                        )
                    )
                print(f"[pitch:{session_id}] saved {len(audio_segments)} audio segments")

            # Transcribe the full WebM with Deepgram and save transcript rows
            if webm_header_bytes and raw_chunks:
                full_webm = webm_header_bytes + b"".join(raw_chunks)
                transcript_segments = await _transcribe_audio(full_webm)
                for start_time, end_time, text, confidence in transcript_segments:
                    db.add(
                        PitchTranscript(
                            pitch_session_id=uuid.UUID(session_id),
                            start_time=start_time,
                            end_time=end_time,
                            text=text,
                            confidence=confidence,
                        )
                    )
                print(f"[pitch:{session_id}] saved {len(transcript_segments)} transcript segments")

            await db.commit()
