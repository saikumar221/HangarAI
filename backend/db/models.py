import uuid
from sqlalchemy import Text, Index, ForeignKey
from sqlalchemy.orm import mapped_column, Mapped, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB, TIMESTAMP
from sqlalchemy.sql import func
from db.database import Base


class BrainstormSession(Base):
    __tablename__ = "brainstorm_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    status: Mapped[str] = mapped_column(Text, default="in_progress", nullable=False)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)
    completed_at = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    messages: Mapped[list["Message"]] = relationship("Message", back_populates="session")
    manifest: Mapped["StartupManifest | None"] = relationship("StartupManifest", back_populates="session", uselist=False)


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("brainstorm_sessions.id"), nullable=False)
    role: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped["BrainstormSession"] = relationship("BrainstormSession", back_populates="messages")

    __table_args__ = (
        Index("ix_messages_session_created", "session_id", "created_at"),
    )


class StartupManifest(Base):
    __tablename__ = "startup_manifests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brainstorm_session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("brainstorm_sessions.id"), nullable=False)

    one_liner: Mapped[str | None] = mapped_column(Text, nullable=True)
    problem: Mapped[str | None] = mapped_column(Text, nullable=True)
    solution: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_customer: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_size: Mapped[str | None] = mapped_column(Text, nullable=True)

    competitors: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    differentiators: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    key_assumptions: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    created_at = mapped_column(TIMESTAMP(timezone=True), server_default=func.now(), nullable=False)

    session: Mapped["BrainstormSession"] = relationship("BrainstormSession", back_populates="manifest")
