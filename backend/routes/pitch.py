import asyncio
import base64
import json
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from hume import AsyncHumeClient
from hume.expression_measurement.stream.stream.types.config import Config
from hume.expression_measurement.stream.stream.types.stream_model_predictions import StreamModelPredictions
from deepgram import DeepgramClient, LiveTranscriptionEvents, LiveOptions

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
    manifest_result = await db.execute(
        select(StartupManifest).where(StartupManifest.user_id == current_user.id)
    )
    manifest = manifest_result.scalar_one_or_none()

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

    hume_client = AsyncHumeClient(api_key=HUME_API_KEY)
    hume_config = Config(prosody={})

    TRACKED_EMOTIONS = {
        "Determination", "Pride", "Triumph", "Enthusiasm", "Excitement",
        "Anxiety", "Awkwardness", "Fear", "Distress", "Doubt", "Embarrassment",
        "Interest", "Concentration", "Calmness",
        "Confusion", "Boredom", "Tiredness", "Sadness",
    }

    CHUNK_DURATION = 1.5
    audio_chunk_idx = 0
    audio_segments: list[tuple[float, float, list]] = []
    transcript_segments: list[tuple[float, float, str, float | None]] = []

    # ── Deepgram live streaming setup ───────────────────────────────────────
    dg_connection = None
    if DEEPGRAM_API_KEY:
        try:
            dg_client = DeepgramClient(DEEPGRAM_API_KEY)
            dg_connection = dg_client.listen.asyncwebsocket.v("1")

            async def on_transcript(self, result, **kwargs):
                try:
                    alt = result.channel.alternatives[0]
                    text = (alt.transcript or "").strip()
                    if not text:
                        return
                    if result.is_final:
                        start = float(result.start)
                        end = float(result.start + result.duration)
                        confidence = float(alt.confidence) if alt.confidence is not None else None
                        transcript_segments.append((start, end, text, confidence))
                    # Forward transcript to frontend (interim + final)
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "transcript",
                            "text": text,
                            "is_final": bool(result.is_final),
                        }))
                    except Exception:
                        pass  # websocket already closed — ignore
                except Exception as e:
                    print(f"[deepgram:{session_id}] on_transcript error: {e}")

            dg_connection.on(LiveTranscriptionEvents.Transcript, on_transcript)

            started = await dg_connection.start(LiveOptions(
                model="nova-2",
                encoding="opus",
                sample_rate=48000,
                channels=1,
                smart_format=True,
                interim_results=True,
                utterance_end_ms="1000",
                vad_events=True,
            ))
            if not started:
                print(f"[deepgram:{session_id}] failed to start live connection")
                dg_connection = None

        except Exception as e:
            print(f"[deepgram:{session_id}] setup error: {e}")
            dg_connection = None

    # ── Main audio loop ──────────────────────────────────────────────────────
    print(f"[pitch:{session_id}] deepgram live: {'connected' if dg_connection else 'disabled'}")
    async with hume_client.expression_measurement.stream.connect() as hume_socket:
        webm_header: bytes = b""
        chunks_received = 0

        try:
            while True:
                data = await websocket.receive_bytes()
                chunks_received += 1
                print(f"[pitch:{session_id}] chunk #{chunks_received} bytes={len(data)}")

                if not webm_header:
                    # First chunk is the WebM container header.
                    webm_header = data
                    print(f"[pitch:{session_id}] webm header captured ({len(data)} bytes)")
                    if dg_connection:
                        try:
                            await dg_connection.send(data)
                        except Exception as e:
                            print(f"[deepgram:{session_id}] send error: {e}")
                    continue

                # Send audio cluster to Deepgram live
                if dg_connection:
                    try:
                        await dg_connection.send(data)
                    except Exception as e:
                        print(f"[deepgram:{session_id}] send error: {e}")

                # Send to Hume (header prepended so each chunk is a standalone WebM)
                start_time = audio_chunk_idx * CHUNK_DURATION
                end_time = start_time + CHUNK_DURATION
                audio_chunk_idx += 1

                b64_audio = base64.b64encode(webm_header + data).decode()
                try:
                    response = await hume_socket.send_file(file_=b64_audio, config=hume_config)
                except Exception as e:
                    print(f"[pitch:{session_id}] hume send error: {e}")
                    continue

                print(f"[pitch:{session_id}] hume response type: {type(response).__name__}")

                if not isinstance(response, StreamModelPredictions):
                    print(f"[pitch:{session_id}] skipping non-predictions response")
                    continue

                prosody = response.prosody
                if not prosody or not prosody.predictions:
                    print(f"[pitch:{session_id}] no prosody predictions in response")
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
                        print(f"[pitch:{session_id}] emotion segment at {start_time:.1f}s: {top_emotions[0]['name']}")

        except WebSocketDisconnect:
            print(f"[pitch:{session_id}] audio WebSocket disconnected")

    # ── Finish Deepgram ──────────────────────────────────────────────────────
    # finalize() sends {"type":"Finalize"} so Deepgram flushes and emits
    # the last is_final transcript before we tear down the connection.
    # We then sleep briefly to let those on_transcript callbacks fire and
    # append to transcript_segments before finish() cancels the listener.
    if dg_connection:
        try:
            await dg_connection.finalize()
            await asyncio.sleep(1.5)  # wait for final on_transcript callbacks
            await dg_connection.finish()
        except Exception as e:
            print(f"[deepgram:{session_id}] shutdown error: {e}")

    # ── Persist to DB ────────────────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(PitchSession).where(PitchSession.id == parse_uuid(session_id))
        )
        if not result.scalar_one_or_none():
            print(f"[pitch:{session_id}] session not found, skipping save")
        else:
            for start_time, end_time, emotions in audio_segments:
                db.add(PitchAudioSegment(
                    pitch_session_id=uuid.UUID(session_id),
                    start_time=start_time,
                    end_time=end_time,
                    emotions=emotions,
                ))
            for start_time, end_time, text, confidence in transcript_segments:
                db.add(PitchTranscript(
                    pitch_session_id=uuid.UUID(session_id),
                    start_time=start_time,
                    end_time=end_time,
                    text=text,
                    confidence=confidence,
                ))
            await db.commit()
            print(
                f"[pitch:{session_id}] saved {len(audio_segments)} audio segments, "
                f"{len(transcript_segments)} transcript segments"
            )
