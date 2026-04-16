"""Document indexer — extract → clean → chunk → embed → upsert to Qdrant."""

import re
import uuid
from dataclasses import dataclass
from typing import Final

import structlog
import tiktoken
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

from app.config import settings
from rag_pipeline.embeddings import EmbeddingService

logger = structlog.get_logger(__name__)

CHUNK_SIZE: Final[int] = 512     # tokens per chunk
CHUNK_OVERLAP: Final[int] = 50   # tokens shared between consecutive chunks


@dataclass
class IndexResult:
    chunks_count: int
    status: str


class DocumentIndexer:
    def __init__(self) -> None:
        self._embedding = EmbeddingService(settings.openai_api_key)
        self._encoder = tiktoken.get_encoding("cl100k_base")
        self._qdrant = AsyncQdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
        )

    # ── Public API ────────────────────────────────────────────────────────────

    async def index_document(
        self,
        file_bytes: bytes,
        teacher_id: str,
        topic_id: str | None,
        filename: str,
        file_type: str,
    ) -> IndexResult:
        """Full pipeline: extract → chunk → embed → upsert."""
        try:
            text = self._extract_text(file_bytes, file_type)
            text = self._clean_text(text)
            chunks = self._chunk_text(text)

            if not chunks:
                logger.warning("indexer_no_chunks", filename=filename)
                return IndexResult(chunks_count=0, status="indexed")

            embeddings = await self._embedding.embed_batch(chunks)

            await self._ensure_collection(teacher_id)
            await self._upsert_chunks(
                chunks, embeddings, teacher_id, topic_id or "", filename, file_type
            )

            logger.info(
                "document_indexed",
                filename=filename,
                teacher_id=teacher_id,
                chunks=len(chunks),
            )
            return IndexResult(chunks_count=len(chunks), status="indexed")

        except Exception as exc:
            logger.error("indexer_error", filename=filename, error=str(exc))
            return IndexResult(chunks_count=0, status="error")

    async def delete_document(self, teacher_id: str, filename: str) -> None:
        """Delete all Qdrant points whose payload matches teacher + filename."""
        from qdrant_client.models import FieldCondition, Filter, MatchValue

        collection = f"teacher_{teacher_id}"
        flt = Filter(
            must=[
                FieldCondition(key="teacher_id", match=MatchValue(value=teacher_id)),
                FieldCondition(key="filename", match=MatchValue(value=filename)),
            ]
        )
        try:
            await self._qdrant.delete(
                collection_name=collection,
                points_selector=flt,
            )
            logger.info(
                "document_deleted", teacher_id=teacher_id, filename=filename
            )
        except Exception as exc:
            logger.error("indexer_delete_error", error=str(exc))

    # ── Text extraction ───────────────────────────────────────────────────────

    def _extract_text(self, file_bytes: bytes, file_type: str) -> str:
        ft = file_type.lower().lstrip(".")
        if ft == "pdf":
            return self._extract_pdf(file_bytes)
        # md and txt
        return file_bytes.decode("utf-8", errors="replace")

    def _extract_pdf(self, file_bytes: bytes) -> str:
        import fitz  # PyMuPDF

        pages: list[str] = []
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                pages.append(page.get_text())
        return "\n".join(pages)

    # ── Cleaning ──────────────────────────────────────────────────────────────

    def _clean_text(self, text: str) -> str:
        # Collapse 3+ blank lines into 2
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Remove non-printable characters (keep standard whitespace)
        text = re.sub(r"[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]", "", text)
        return text.strip()

    # ── Chunking ──────────────────────────────────────────────────────────────

    def _chunk_text(self, text: str) -> list[str]:
        """Token-based chunking with sentence-aware splits and overlap."""
        tokens = self._encoder.encode(text)
        if not tokens:
            return []

        chunks: list[str] = []
        start = 0

        while start < len(tokens):
            end = min(start + CHUNK_SIZE, len(tokens))
            chunk_tokens = tokens[start:end]
            chunk_text = self._encoder.decode(chunk_tokens)

            # Try to end at a sentence boundary if we're not at the end
            if end < len(tokens) and len(chunk_text) > CHUNK_SIZE // 4:
                cut = self._last_sentence_end(chunk_text)
                if cut > 0:
                    chunk_text = chunk_text[:cut]
                    # Recalculate how many tokens we actually consumed
                    actual_tokens = self._encoder.encode(chunk_text)
                    end = start + len(actual_tokens)

            stripped = chunk_text.strip()
            if stripped:
                chunks.append(stripped)

            # Next chunk starts with CHUNK_OVERLAP tokens of overlap
            next_start = end - CHUNK_OVERLAP
            if next_start <= start:
                next_start = end  # guard against infinite loop
            start = next_start

        return chunks

    @staticmethod
    def _last_sentence_end(text: str) -> int:
        """Return the index after the last sentence-ending punctuation."""
        best = -1
        for m in re.finditer(r"[.!?]\s+", text):
            best = m.end()
        if best == -1:
            nl = text.rfind("\n")
            if nl > len(text) // 2:
                best = nl
        return best

    # ── Qdrant helpers ────────────────────────────────────────────────────────

    async def _ensure_collection(self, teacher_id: str) -> None:
        """Create the Qdrant collection if it does not exist yet."""
        name = f"teacher_{teacher_id}"
        existing = [c.name for c in (await self._qdrant.get_collections()).collections]
        if name not in existing:
            await self._qdrant.create_collection(
                collection_name=name,
                vectors_config=VectorParams(
                    size=EmbeddingService.dimension,
                    distance=Distance.COSINE,
                ),
            )
            logger.info("qdrant_collection_created", collection=name)

    async def _upsert_chunks(
        self,
        chunks: list[str],
        embeddings: list[list[float]],
        teacher_id: str,
        topic_id: str,
        filename: str,
        file_type: str,
    ) -> None:
        total = len(chunks)
        points = [
            PointStruct(
                id=str(uuid.uuid4()),
                vector=embeddings[i],
                payload={
                    "text": chunks[i],
                    "teacher_id": teacher_id,
                    "topic_id": topic_id,
                    "filename": filename,
                    "file_type": file_type,
                    "chunk_index": i,
                    "total_chunks": total,
                    "char_count": len(chunks[i]),
                },
            )
            for i in range(total)
        ]
        await self._qdrant.upsert(
            collection_name=f"teacher_{teacher_id}",
            points=points,
        )
