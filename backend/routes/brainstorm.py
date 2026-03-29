import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import BrainstormSession, Message, StartupManifest, User
from schemas.brainstorm import BrainstormSessionOut, MessageOut, StartupManifestOut
from agents.brainstorm_agent import initial_state, chat
from core.security import get_current_user

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

@router.get("/sessions", response_model=list[BrainstormSessionOut])
async def list_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BrainstormSession)
        .where(BrainstormSession.user_id == current_user.id)
        .order_by(BrainstormSession.created_at.desc())
    )
    sessions = result.scalars().all()

    output = []
    for session in sessions:
        msg_result = await db.execute(
            select(Message)
            .where(Message.session_id == session.id, Message.role == "user")
            .order_by(Message.created_at.asc())
            .limit(1)
        )
        first_msg = msg_result.scalar_one_or_none()
        if first_msg:
            raw = first_msg.content
            title = raw[:42] + "…" if len(raw) > 42 else raw
        else:
            title = "Chat session"
        output.append(BrainstormSessionOut(
            id=session.id,
            title=title,
            status=session.status,
            created_at=session.created_at,
            completed_at=session.completed_at,
        ))
    return output


@router.post("/session", response_model=BrainstormSessionOut, status_code=201)
async def create_session(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Creates a new brainstorm session tied to the current user
    session = BrainstormSession(user_id=current_user.id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/session/{session_id}/chat")
async def chat_turn(
    session_id: uuid.UUID,
    body: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(BrainstormSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Returns all messages for a session ordered oldest-first
    session = await db.get(BrainstormSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    )
    return result.scalars().all()


@router.delete("/session/{session_id}", status_code=204)
async def delete_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(BrainstormSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Delete child records first, then the session
    await db.execute(delete(Message).where(Message.session_id == session_id))
    await db.execute(delete(StartupManifest).where(StartupManifest.brainstorm_session_id == session_id))
    await db.delete(session)
    await db.commit()

    # Clear in-memory agent state
    _session_states.pop(str(session_id), None)


@router.get("/manifest", response_model=StartupManifestOut)
async def get_user_manifest(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StartupManifest).where(StartupManifest.user_id == current_user.id)
    )
    manifest = result.scalar_one_or_none()
    if manifest is None:
        raise HTTPException(status_code=404, detail="No manifest found")
    return manifest


@router.delete("/manifest", status_code=204)
async def delete_user_manifest(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(StartupManifest).where(StartupManifest.user_id == current_user.id)
    )
    await db.commit()


@router.get("/session/{session_id}/manifest", response_model=StartupManifestOut)
async def get_manifest(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(StartupManifest).where(StartupManifest.brainstorm_session_id == session_id)
    )
    manifest = result.scalar_one_or_none()
    if manifest is None:
        raise HTTPException(status_code=404, detail="Manifest not found")
    return manifest


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

    # Upsert: update existing manifest for this session if one already exists
    existing = await db.execute(
        select(StartupManifest).where(StartupManifest.brainstorm_session_id == session_id)
    )
    manifest = existing.scalar_one_or_none()

    if manifest is None:
        manifest = StartupManifest(
            brainstorm_session_id=session_id,
            user_id=session.user_id,
        )
        db.add(manifest)

    manifest.one_liner = manifest_data.get("one_liner")
    manifest.problem = manifest_data.get("problem")
    manifest.solution = manifest_data.get("solution")
    manifest.target_customer = manifest_data.get("target_customer")
    manifest.market_size = manifest_data.get("market_size")
    manifest.competitors = manifest_data.get("competitors")
    manifest.differentiators = manifest_data.get("differentiators")
    manifest.key_assumptions = manifest_data.get("key_assumptions")

    # Mark the session as done
    session.status = "completed"
    session.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(manifest)
    return manifest
