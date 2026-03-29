import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.pitch_orchestrator import analyze_pitch
from core.security import get_current_user
from db.database import get_db
from db.models import (
    PitchAudioSegment,
    PitchSession,
    PitchVideoSnapshot,
    StartupManifest,
    User,
)

router = APIRouter()


@router.post("/pitch/{session_id}")
async def generate_pitch_analysis(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the multi-agent pitch analysis orchestrator for a session.

    Fetches audio segments and video snapshots from the DB, fires the
    Audio Agent and Video Agent in parallel, then synthesises a full
    report containing an improvement roadmap, a confidence graph, and
    the investor-persona verdict.
    """
    # Verify the session belongs to this user
    session_result = await db.execute(
        select(PitchSession).where(
            PitchSession.id == uuid.UUID(session_id),
            PitchSession.user_id == current_user.id,
        )
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Pitch session not found")

    # Audio segments ordered by start_time
    audio_result = await db.execute(
        select(PitchAudioSegment)
        .where(PitchAudioSegment.pitch_session_id == session.id)
        .order_by(PitchAudioSegment.start_time)
    )
    audio_segments = [
        {
            "start_time": seg.start_time,
            "end_time": seg.end_time,
            "emotions": seg.emotions,
        }
        for seg in audio_result.scalars().all()
    ]

    # Video snapshots ordered by timestamp
    video_result = await db.execute(
        select(PitchVideoSnapshot)
        .where(PitchVideoSnapshot.pitch_session_id == session.id)
        .order_by(PitchVideoSnapshot.timestamp)
    )
    video_snapshots = [
        {
            "timestamp": snap.timestamp,
            "eye_contact_score": snap.eye_contact_score,
            "expression_score": snap.expression_score,
            "posture_score": snap.posture_score,
            "head_movement_score": snap.head_movement_score,
        }
        for snap in video_result.scalars().all()
    ]

    # Startup manifest (optional — gives the agents rich pitch context)
    manifest: dict = {}
    if session.manifest_id:
        manifest_result = await db.execute(
            select(StartupManifest).where(StartupManifest.id == session.manifest_id)
        )
        m = manifest_result.scalar_one_or_none()
        if m:
            manifest = {
                "one_liner": m.one_liner,
                "problem": m.problem,
                "solution": m.solution,
                "target_customer": m.target_customer,
                "market_size": m.market_size,
                "competitors": m.competitors,
                "differentiators": m.differentiators,
                "key_assumptions": m.key_assumptions,
            }

    investor_name = f"{session.investor_first_name} {session.investor_last_name}"

    analysis = await analyze_pitch(
        investor_name=investor_name,
        investor_company=session.investor_company,
        investor_notes=session.investor_notes,
        manifest=manifest,
        audio_segments=audio_segments,
        video_snapshots=video_snapshots,
    )

    return {
        "session_id": session_id,
        "investor_name": investor_name,
        "investor_company": session.investor_company,
        "audio_insights": analysis["audio_insights"],
        "video_insights": analysis["video_insights"],
        "improvement_roadmap": analysis["improvement_roadmap"],
        "confidence_graph": analysis["confidence_graph"],
        "verdict": analysis["verdict"],
    }
