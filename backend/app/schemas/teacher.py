"""Pydantic v2 schemas for teacher endpoints."""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Invitation codes ──────────────────────────────────────────────────────────

class InvitationCodeResponse(BaseModel):
    code: str
    teacher_id: uuid.UUID
    expires_at: datetime
    max_uses: int
    current_uses: int
    is_active: bool
    enrolled_count: int = 0

    model_config = {"from_attributes": True}


class CreateInvitationCodeRequest(BaseModel):
    max_uses: int = Field(default=100, ge=1, le=1000)


# ── Topics ────────────────────────────────────────────────────────────────────

class CreateTopicRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: Optional[str] = None
    domaine: Optional[str] = None
    niveau_min: int = Field(default=1, ge=1, le=5)
    tags: list[str] = Field(default_factory=list)
    is_active: bool = True


class UpdateTopicRequest(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=300)
    description: Optional[str] = None
    domaine: Optional[str] = None
    niveau_min: Optional[int] = Field(default=None, ge=1, le=5)
    tags: Optional[list[str]] = None
    is_active: Optional[bool] = None


class TopicResponse(BaseModel):
    id: uuid.UUID
    teacher_id: uuid.UUID
    title: str
    description: Optional[str]
    domaine: Optional[str]
    niveau_min: int
    tags: list[str]
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Students ──────────────────────────────────────────────────────────────────

class StudentSummary(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    niveau: int
    score_moyen: Optional[float]
    submissions_count: int
    derniere_activite: Optional[datetime]


class SubmissionSummary(BaseModel):
    id: uuid.UUID
    tp_id: uuid.UUID
    score: Optional[int]
    errors_json: Optional[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Analytics ─────────────────────────────────────────────────────────────────

class TopErrorItem(BaseModel):
    type: str
    count: int
    percentage: float


class StudentAtRisk(BaseModel):
    student_id: uuid.UUID
    name: str
    avg_score: float
    last_activity: Optional[datetime]


class AnalyticsResponse(BaseModel):
    total_students: int
    avg_score_class: Optional[float]
    completion_rate: float
    top_errors: list[TopErrorItem]
    students_at_risk: list[StudentAtRisk]


class AskStudentRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)


class AskStudentResponse(BaseModel):
    response: str
