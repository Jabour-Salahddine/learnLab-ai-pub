"""RAG router — document upload, listing, deletion, collection stats."""

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_teacher, get_current_user
from app.models.enrollment import StudentEnrollment
from app.models.rag_document import RagDocument
from app.models.user import User
from app.schemas.rag import CollectionStats, DocumentItem, DocumentUploadResponse
from app.utils.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.utils.minio_client import delete_file, upload_file
from rag_pipeline.indexer import DocumentIndexer

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/rag", tags=["rag"])

_ALLOWED_TYPES = {"pdf", "md", "txt"}
_MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

_indexer = DocumentIndexer()


# ── Background task ────────────────────────────────────────────────────────────


async def _index_and_update(
    doc_id: uuid.UUID,
    file_bytes: bytes,
    teacher_id: str,
    topic_id: str | None,
    filename: str,
    file_type: str,
) -> None:
    """Index the document and update its status in the DB."""
    from app.database import AsyncSessionLocal

    result = await _indexer.index_document(
        file_bytes=file_bytes,
        teacher_id=teacher_id,
        topic_id=topic_id,
        filename=filename,
        file_type=file_type,
    )

    async with AsyncSessionLocal() as db:
        row = await db.get(RagDocument, doc_id)
        if row:
            row.chunks_count = result.chunks_count
            row.status = result.status
            await db.commit()

    logger.info(
        "rag_document_indexed",
        doc_id=str(doc_id),
        chunks=result.chunks_count,
        status=result.status,
    )


# ── POST /rag/documents/upload ────────────────────────────────────────────────


@router.post("/documents/upload", response_model=DocumentUploadResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    topic_id: str | None = Form(default=None),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> DocumentUploadResponse:
    """Upload a PDF/MD/TXT file and schedule background indexing."""
    # Validate extension
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in _ALLOWED_TYPES:
        raise BadRequestException(f"Type non supporté '{ext}'. Acceptés : {_ALLOWED_TYPES}")

    # Validate size
    file_bytes = await file.read()
    if len(file_bytes) > _MAX_SIZE_BYTES:
        raise BadRequestException("Fichier trop volumineux (max 10 MB)")

    # Validate topic_id belongs to teacher if provided
    topic_uuid: uuid.UUID | None = None
    if topic_id:
        try:
            topic_uuid = uuid.UUID(topic_id)
        except ValueError:
            raise BadRequestException("topic_id invalide")

    filename = file.filename or f"document.{ext}"
    object_name = f"{teacher.id}/{filename}"

    # Persist to MinIO (non-blocking — failure is tolerated)
    background_tasks.add_task(
        upload_file,
        object_name,
        file_bytes,
        file.content_type or "application/octet-stream",
    )

    # Create DB record
    doc = RagDocument(
        teacher_id=teacher.id,
        filename=filename,
        file_type=ext,
        topic_id=topic_uuid,
        qdrant_collection=f"teacher_{teacher.id}",
        status="pending",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Schedule indexing
    background_tasks.add_task(
        _index_and_update,
        doc.id,
        file_bytes,
        str(teacher.id),
        topic_id,
        filename,
        ext,
    )

    return DocumentUploadResponse(
        document_id=doc.id,
        filename=filename,
        status="processing",
    )


# ── GET /rag/documents ────────────────────────────────────────────────────────


@router.get("/documents", response_model=list[DocumentItem])
async def list_documents(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[DocumentItem]:
    """Return all RAG documents belonging to the current teacher."""
    result = await db.execute(
        select(RagDocument)
        .where(RagDocument.teacher_id == teacher.id)
        .order_by(RagDocument.uploaded_at.desc())
    )
    docs = result.scalars().all()
    return [DocumentItem.model_validate(d) for d in docs]


# ── DELETE /rag/documents/{document_id} ──────────────────────────────────────


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Remove a document from Qdrant, MinIO, and the database."""
    doc: RagDocument | None = await db.get(RagDocument, document_id)
    if not doc:
        raise NotFoundException("Document introuvable")
    if doc.teacher_id != teacher.id:
        raise ForbiddenException("Ce document ne vous appartient pas")

    # Delete from Qdrant
    await _indexer.delete_document(str(teacher.id), doc.filename)

    # Delete from MinIO
    await delete_file(f"{teacher.id}/{doc.filename}")

    # Delete from DB
    await db.delete(doc)
    await db.commit()

    return {"message": "Document supprimé"}


# ── GET /rag/documents/{document_id}/preview ─────────────────────────────────


@router.get("/documents/{document_id}/preview")
async def preview_document(
    document_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the first 3 chunks of a RAG document (student or teacher)."""
    from sqlalchemy import select as sa_select

    doc: RagDocument | None = await db.get(RagDocument, document_id)
    if not doc:
        raise NotFoundException("Document introuvable")

    # Access control: teacher owns the doc, or student is enrolled with that teacher
    if user.role == "teacher":
        if doc.teacher_id != user.id:
            raise ForbiddenException("Ce document ne vous appartient pas")
    else:
        # student: verify enrollment with doc's teacher
        enroll = await db.execute(
            sa_select(StudentEnrollment).where(
                StudentEnrollment.student_id == user.id,
                StudentEnrollment.teacher_id == doc.teacher_id,
            )
        )
        if not enroll.scalar_one_or_none():
            raise ForbiddenException("Accès non autorisé")

    if doc.status != "indexed":
        return {"chunks": [], "message": "Document pas encore indexé"}

    # Query Qdrant for first 3 chunks filtered by filename
    try:
        from qdrant_client import AsyncQdrantClient
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        from app.config import settings

        client = AsyncQdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        collection_name = f"teacher_{doc.teacher_id}"

        scroll_result = await client.scroll(
            collection_name=collection_name,
            scroll_filter=Filter(
                must=[
                    FieldCondition(
                        key="filename",
                        match=MatchValue(value=doc.filename),
                    )
                ]
            ),
            limit=3,
            with_payload=True,
            with_vectors=False,
        )
        points = scroll_result[0]
        # Sort by chunk_index
        chunks = sorted(
            [
                {
                    "text": (p.payload or {}).get("text", ""),
                    "chunk_index": (p.payload or {}).get("chunk_index", 0),
                }
                for p in points
            ],
            key=lambda c: c["chunk_index"],
        )
        return {"chunks": chunks}
    except Exception as exc:
        logger.warning("rag_preview_failed", doc_id=str(document_id), error=str(exc))
        return {"chunks": [], "message": "Aperçu indisponible"}


# ── GET /rag/collections/stats ────────────────────────────────────────────────


@router.get("/collections/stats", response_model=CollectionStats)
async def collection_stats(
    teacher: User = Depends(get_current_teacher),
) -> CollectionStats:
    """Return Qdrant collection stats for the current teacher."""
    from qdrant_client import AsyncQdrantClient

    from app.config import settings

    collection_name = f"teacher_{teacher.id}"
    client = AsyncQdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)

    try:
        info = await client.get_collection(collection_name)
        # qdrant-client 1.9 reports vectors_count lazily — prefer points_count
        count = info.points_count or info.vectors_count or 0
        return CollectionStats(
            collection_name=collection_name,
            vectors_count=count,
            status=info.status.value if info.status else "unknown",
        )
    except Exception:
        return CollectionStats(
            collection_name=collection_name,
            vectors_count=0,
            status="not_found",
        )
