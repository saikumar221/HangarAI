from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


@router.websocket("/ws/{session_id}/audio")
async def audio_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()
    print(f"[pitch:{session_id}] audio WebSocket connected")
    try:
        while True:
            data = await websocket.receive_bytes()
            print(f"[pitch:{session_id}] audio chunk — {len(data)} bytes")
            # TODO: forward to Deepgram (STT) + Hume (emotion)
    except WebSocketDisconnect:
        print(f"[pitch:{session_id}] audio WebSocket disconnected")


@router.websocket("/ws/{session_id}/video")
async def video_stream(websocket: WebSocket, session_id: str):
    await websocket.accept()
    print(f"[pitch:{session_id}] video WebSocket connected")
    try:
        while True:
            data = await websocket.receive_bytes()
            print(f"[pitch:{session_id}] video frame — {len(data)} bytes")
            # TODO: forward to Gemini vision (Agent 3)
    except WebSocketDisconnect:
        print(f"[pitch:{session_id}] video WebSocket disconnected")
