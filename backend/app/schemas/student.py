"""Pydantic v2 schemas for student endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class TopicListItem(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    domaine: str | None
    niveau_min: int
    tags: list[str]
    teacher_id: uuid.UUID

    model_config = {"from_attributes": True}


class GenerateTPResponse(BaseModel):
    tp_id: uuid.UUID
    enonce: str
    starter_code: str
    tests_count: int


class SubmitCodeRequest(BaseModel):
    code: str = Field(min_length=1)
    language: str = "python"


class TestResult(BaseModel):
    description: str
    passed: bool
    actual: str | None
    expected: str | None


class ErrorItem(BaseModel):
    type: str
    description: str
    line: int | None = None


class SubmitCodeResponse(BaseModel):
    submission_id: uuid.UUID
    score: int
    tests_results: list[TestResult]
    errors_categorized: list[ErrorItem]
    feedback: str
    hint: str | None = None
    hint_level: int | None = None


class HintResponse(BaseModel):
    hint: str
    hint_level: int


class StudentProfileResponse(BaseModel):
    id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    formation: str | None
    filiere: str | None
    year_of_study: int | None
    niveau: int
    concepts_maitrises: list[str]
    points_faibles: list[str]
    score_moyen: float | None
    tps_completes: int
    derniere_activite: datetime | None


class TPDetailResponse(BaseModel):
    tp_id: uuid.UUID
    enonce: str
    starter_code: str
    tests_count: int
    topic_id: uuid.UUID | None
    topic_title: str | None
    created_at: datetime


class RunCodeRequest(BaseModel):
    code: str = Field(min_length=1)
    language: str = "python"


class RunCodeResponse(BaseModel):
    stdout: str
    stderr: str
    exit_code: int
    runtime_available: bool


class SubmissionHistoryItem(BaseModel):
    id: uuid.UUID
    tp_id: uuid.UUID | None
    topic_title: str | None
    score: int | None
    created_at: datetime
    tests_passed: int
    tests_total: int
    submission_type: str = "submission"
