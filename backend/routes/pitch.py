import base64
import os
from typing import List

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from hume import AsyncHumeClient
from hume.expression_measurement.stream.stream.types.config import Config
from hume.expression_measurement.stream.stream.types.stream_model_predictions import StreamModelPredictions

router = APIRouter()

HUME_API_KEY = os.getenv("HUME_API_KEY")

class VideoInsightSnapshot(BaseModel):
    timestamp: int
    eye_contact_score: float
    expression_score: float
    posture_score: float
    head_movement_score: float


@router.post("/sessions/{session_id}/video-analysis")
async def receive_video_analysis(session_id: str, snapshots: List[VideoInsightSnapshot]):
    for s in snapshots:
        print(f"[pitch:{session_id}] t={s.timestamp}s | eye_contact={s.eye_contact_score:.3f} | expression={s.expression_score:.3f} | posture={s.posture_score:.3f} | head_movement={s.head_movement_score:.3f}")
    return {"session_id": session_id, "received": len(snapshots)}




@router.websocket("/ws/{session_id}/audio")
async def audio_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()
    # print(f"[pitch:{session_id}] audio WebSocket connected")

    client = AsyncHumeClient(api_key=HUME_API_KEY)
    config = Config(prosody={})

    TRACKED_EMOTIONS = {
        "Determination", "Pride", "Triumph", "Enthusiasm", "Excitement",
        "Anxiety", "Awkwardness", "Fear", "Distress", "Doubt", "Embarrassment",
        "Interest", "Concentration", "Calmness",
        "Confusion", "Boredom", "Tiredness", "Sadness",
    }

    async with client.expression_measurement.stream.connect() as hume_socket:
        webm_header: bytes = b""
        try:
            while True:
                data = await websocket.receive_bytes()
                print(f"[pitch:{session_id}] audio chunk — {len(data)} bytes")

                if not webm_header:
                    # First chunk contains the WebM header — use as-is and save it
                    webm_header = data
                    payload = data
                else:
                    # Prepend header so each chunk is a parseable WebM file
                    payload = webm_header + data

                b64_audio = base64.b64encode(payload).decode()
                try:
                    response = await hume_socket.send_file(file_=b64_audio, config=config)
                except Exception as e:
                    # print(f"[pitch:{session_id}] hume error: {e}")
                    continue

                if not isinstance(response, StreamModelPredictions):
                    # print(f"[pitch:{session_id}] hume: {response}")
                    continue

                prosody = response.prosody
                if not prosody or not prosody.predictions:
                    continue

                for prediction in prosody.predictions:
                    if not prediction.emotions:
                        continue
                    top = sorted(
                        [
                            (e.name, round(e.score, 4))
                            for e in prediction.emotions
                            if e.name in TRACKED_EMOTIONS and e.score is not None
                        ],
                        key=lambda x: x[1],
                        reverse=True,
                    )
                    # print(f"[pitch:{session_id}] emotions: {top}")

        except WebSocketDisconnect:
            print(f"[pitch:{session_id}] audio WebSocket disconnected")
