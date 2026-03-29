import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PitchSessionCreate(BaseModel):
    id: uuid.UUID           # client-generated, matches WS session_id
    manifest_id: uuid.UUID
    investor_first_name: str
    investor_last_name: str
    investor_company: str
    investor_linkedin: str | None = None
    investor_notes: str | None = None


class PitchSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str
    created_at: datetime


class VideoSnapshotIn(BaseModel):
    timestamp: float           # seconds from pitch start, client-computed
    eye_contact_score: float
    expression_score: float
    posture_score: float
    head_movement_score: float
