import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr


# --- Auth ---

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str


# --- BrainstormSession ---

class BrainstormSessionCreate(BaseModel):
    user_id: uuid.UUID | None = None


class BrainstormSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str = "Chat session"
    status: str
    created_at: datetime
    completed_at: datetime | None = None


# --- Message ---

class MessageCreate(BaseModel):
    role: str
    content: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: str
    content: str
    created_at: datetime


# --- StartupManifest ---

class StartupManifestCreate(BaseModel):
    one_liner: str | None = None
    problem: str | None = None
    solution: str | None = None
    target_customer: str | None = None
    market_size: str | None = None
    competitors: list | None = None
    differentiators: list | None = None
    key_assumptions: list | None = None


class StartupManifestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    brainstorm_session_id: uuid.UUID
    one_liner: str | None = None
    problem: str | None = None
    solution: str | None = None
    target_customer: str | None = None
    market_size: str | None = None
    competitors: list | None = None
    differentiators: list | None = None
    key_assumptions: list | None = None
    created_at: datetime
