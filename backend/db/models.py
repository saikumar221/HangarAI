import uuid
from sqlalchemy import Text, Index, ForeignKey, Float
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
from db.database import Base


class User(Base):
    """Registered user account. Owns brainstorm sessions, a startup manifest, and pitch sessions."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    first_name: Mapped[str] = mapped_column(Text, nullable=False)
    last_name: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    sessions: Mapped[list["BrainstormSession"]] = relationship("BrainstormSession", back_populates="user")
    manifest: Mapped["StartupManifest | None"] = relationship("StartupManifest", back_populates="user", uselist=False)


class BrainstormSession(Base):
    """An interactive AI chat session used to develop and refine a startup idea."""

    __tablename__ = "brainstorm_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # user_id now has a FK constraint to users.id
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # "in_progress" while the session is active, "completed" after finalize
    status: Mapped[str] = mapped_column(Text, default="in_progress", nullable=False)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    completed_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    user: Mapped["User | None"] = relationship("User", back_populates="sessions")
    messages: Mapped[list["Message"]] = relationship("Message", back_populates="session")
    manifest: Mapped["StartupManifest | None"] = relationship("StartupManifest", back_populates="session", uselist=False)


class Message(Base):
    """A single turn in a BrainstormSession. Role is either "user" or "assistant"."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("brainstorm_sessions.id"), nullable=False)
    # role is either "user" or "assistant"
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped["BrainstormSession"] = relationship("BrainstormSession", back_populates="messages")

    __table_args__ = (
        # Composite index for efficient per-session message fetching in order
        Index("ix_messages_session_created", "session_id", "created_at"),
    )


class StartupManifest(Base):
    """Structured snapshot of a user's startup idea, extracted by the agent at the end of a BrainstormSession.
    One manifest per user (enforced by the unique constraint on user_id).
    """

    __tablename__ = "startup_manifests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Links back to the session this manifest was extracted from
    brainstorm_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("brainstorm_sessions.id"), nullable=False)
    # Direct link to the user — one manifest per user
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, unique=True)

    # Core idea fields — extracted by the agent during finalization
    one_liner: Mapped[str | None] = mapped_column(Text, nullable=True)
    problem: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_customer: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_size: Mapped[str | None] = mapped_column(Text, nullable=True)

    # List fields stored as JSONB arrays
    competitors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    differentiators: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    key_assumptions: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped["BrainstormSession"] = relationship("BrainstormSession", back_populates="manifest")
    user: Mapped["User | None"] = relationship("User", back_populates="manifest")


class PitchSession(Base):
    """A single investor pitch practice session. Tracks the target investor, session status,
    and links to the audio, video, and transcript data captured during the pitch.
    """

    __tablename__ = "pitch_sessions"

    # UUID is generated by the client so the audio WebSocket can reference the
    # same session ID immediately, without waiting for a server-generated one
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # Optional link to the user's startup manifest — used to give the pitch context
    manifest_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("startup_manifests.id"), nullable=True)
    investor_first_name: Mapped[str] = mapped_column(Text, nullable=False)
    investor_last_name: Mapped[str] = mapped_column(Text, nullable=False)
    investor_company: Mapped[str] = mapped_column(Text, nullable=False)
    investor_linkedin: Mapped[str | None] = mapped_column(Text, nullable=True)
    investor_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "in_progress" while the session is active, "completed" after the pitch ends
    status: Mapped[str] = mapped_column(Text, default="in_progress", nullable=False)
    duration_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    completed_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    audio_segments: Mapped[list["PitchAudioSegment"]] = relationship("PitchAudioSegment", back_populates="pitch_session")
    video_snapshots: Mapped[list["PitchVideoSnapshot"]] = relationship("PitchVideoSnapshot", back_populates="pitch_session")
    transcripts: Mapped[list["PitchTranscript"]] = relationship("PitchTranscript", back_populates="pitch_session")


class PitchAudioSegment(Base):
    """A 1.5-second window of audio from a pitch, annotated with the top emotions
    detected by the Hume prosody model for that time range.
    """

    __tablename__ = "pitch_audio_segments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pitch_sessions.id"), nullable=False)
    # start_time / end_time are seconds from pitch start, derived from chunk_index * CHUNK_DURATION
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    # JSONB list of {"name": str, "score": float} — top Hume prosody emotions for this time window
    emotions: Mapped[list] = mapped_column(JSONB, nullable=False)

    pitch_session: Mapped["PitchSession"] = relationship("PitchSession", back_populates="audio_segments")

    __table_args__ = (
        # Composite index for efficient per-session timeline queries
        Index("ix_audio_seg_session_start", "pitch_session_id", "start_time"),
    )


class PitchVideoSnapshot(Base):
    """A 5-second video window averaged into four presence scores (0–1) computed
    by MediaPipe face and pose landmark analysis.
    """

    __tablename__ = "pitch_video_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pitch_sessions.id"), nullable=False)
    # Seconds from pitch start — matches InsightSnapshot.timestamp on the frontend
    timestamp: Mapped[float] = mapped_column(Float, nullable=False)
    # All scores are 0–1, computed from MediaPipe blendshapes / landmarks averaged over a 5 s window
    eye_contact_score: Mapped[float] = mapped_column(Float, nullable=False)
    expression_score: Mapped[float] = mapped_column(Float, nullable=False)
    posture_score: Mapped[float] = mapped_column(Float, nullable=False)
    head_movement_score: Mapped[float] = mapped_column(Float, nullable=False)

    pitch_session: Mapped["PitchSession"] = relationship("PitchSession", back_populates="video_snapshots")

    __table_args__ = (
        # Composite index for efficient per-session timeline queries
        Index("ix_video_snap_session_ts", "pitch_session_id", "timestamp"),
    )


class PitchTranscript(Base):
    """A timestamped speech-to-text segment from a pitch. Confidence is optional
    and only populated when the STT source provides a score.
    """

    __tablename__ = "pitch_transcripts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pitch_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pitch_sessions.id"), nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # None when the STT source does not provide a confidence value
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    pitch_session: Mapped["PitchSession"] = relationship("PitchSession", back_populates="transcripts")

    __table_args__ = (
        # Composite index for efficient per-session timeline queries
        Index("ix_transcript_session_start", "pitch_session_id", "start_time"),
    )
