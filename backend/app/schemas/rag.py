"""Pydantic v2 schemas for RAG endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: uuid.UUID
    filename: str
    status: str  # "processing"


class DocumentItem(BaseModel):
    id: uuid.UUID
    filename: str
    file_type: str | None
    topic_id: uuid.UUID | None
    chunks_count: int
    status: str
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: list[DocumentItem]


class CollectionStats(BaseModel):
    collection_name: str
    vectors_count: int
    status: str


class RetrievedChunkResponse(BaseModel):
    text: str
    score: float
    filename: str
    chunk_index: int
    topic_id: str
    teacher_id: str
