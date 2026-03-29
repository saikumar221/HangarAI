import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import BrainstormSession, Message, StartupManifest
from schemas.brainstorm import BrainstormSessionOut, MessageOut, StartupManifestOut
from agents.brainstorm_agent import initial_state, chat

router = APIRouter()

# In-memory agent state store keyed by session_id string.
# Holds the full LangGraph AgentState (messages, phase, manifest) per session.
# NOTE: This is lost on server restart — sessions started before a restart
# will begin with a fresh state if chatted again.
_session_states: dict[str, Any] = {}


# ---------------------------------------------------------------------------
# Request schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/session", response_model=BrainstormSessionOut, status_code=201)
async def create_session(db: AsyncSession = Depends(get_db)):
    # Creates a new brainstorm session with status "in_progress"
    session = BrainstormSession()
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/session/{session_id}/chat")
async def chat_turn(
    session_id: uuid.UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(BrainstormSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    key = str(session_id)
    # Load existing agent state or start fresh if not found (e.g. after restart)
    state = _session_states.get(key, initial_state())

    # Run one turn through the LangGraph agent
    state = chat(state, body.message)
    _session_states[key] = state

    reply = state["messages"][-1].content

    # Persist both sides of the conversation to the DB
    db.add(Message(session_id=session_id, role="user", content=body.message))
    db.add(Message(session_id=session_id, role="assistant", content=reply))
    await db.commit()

    return {"reply": reply, "phase": state["phase"]}


@router.get("/session/{session_id}/messages", response_model=list[MessageOut])
async def get_messages(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    # Returns all messages for a session ordered oldest-first
    session = await db.get(BrainstormSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@router.post("/session/{session_id}/finalize", response_model=StartupManifestOut)
async def finalize_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(BrainstormSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")

    key = str(session_id)
    state = _session_states.get(key, initial_state())

    # Run a final agent turn to generate the summary and extract the manifest
    state = chat(state, "Please finalize my idea")
    _session_states[key] = state

    manifest_data = state.get("manifest", {})

    # Write the extracted manifest fields to the DB
    manifest = StartupManifest(
        brainstorm_session_id=session_id,
        one_liner=manifest_data.get("one_liner"),
        problem=manifest_data.get("problem"),
        solution=manifest_data.get("solution"),
        target_customer=manifest_data.get("target_customer"),
        market_size=manifest_data.get("market_size"),
        competitors=manifest_data.get("competitors"),
        differentiators=manifest_data.get("differentiators"),
        key_assumptions=manifest_data.get("key_assumptions"),
    )
    db.add(manifest)

    # Mark the session as done
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(manifest)
    return manifest
