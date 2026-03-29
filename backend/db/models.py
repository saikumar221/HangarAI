import uuid
from sqlalchemy import Text, Index, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
from db.database import Base


class User(Base):
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
