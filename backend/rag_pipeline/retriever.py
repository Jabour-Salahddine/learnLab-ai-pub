"""Contextual retriever — embed query → Qdrant search → formatted context."""

from dataclasses import dataclass

import structlog
from qdrant_client import AsyncQdrantClient

from app.config import settings
from rag_pipeline.embeddings import EmbeddingService

logger = structlog.get_logger(__name__)


@dataclass
class RetrievedChunk:
    text: str
    score: float
    filename: str
    chunk_index: int
    topic_id: str
    teacher_id: str


class RAGRetriever:
    def __init__(self) -> None:
        self._embedding = EmbeddingService(settings.openai_api_key)
        self._qdrant = AsyncQdrantClient(
            host=settings.qdrant_host,
            port=settings.qdrant_port,
        )

    async def search(
        self,
        query: str,
        teacher_id: str,
        topic_id: str | None = None,
        top_k: int = 5,
        score_threshold: float = 0.70,
    ) -> list[RetrievedChunk]:
        """Semantic search scoped to a single teacher's collection."""
        collection = f"teacher_{teacher_id}"

        # Build optional topic filter
        query_filter = None
        if topic_id:
            from qdrant_client.models import FieldCondition, Filter, MatchValue

            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="topic_id",
                        match=MatchValue(value=topic_id),
                    )
                ]
            )

        try:
            query_vector = await self._embedding.embed_text(query)
            results = await self._qdrant.search(
                collection_name=collection,
                query_vector=query_vector,
                limit=top_k * 2,  # over-fetch to allow de-duplication
                query_filter=query_filter,
                score_threshold=score_threshold,
                with_payload=True,
            )
        except Exception as exc:
            logger.warning("rag_search_failed", error=str(exc), collection=collection)
            return []

        # De-duplicate by text (keep highest score)
        seen: dict[str, RetrievedChunk] = {}
        for hit in results:
            payload = hit.payload or {}
            text = payload.get("text", "")
            chunk = RetrievedChunk(
                text=text,
                score=hit.score,
                filename=payload.get("filename", ""),
                chunk_index=payload.get("chunk_index", 0),
                topic_id=payload.get("topic_id", ""),
                teacher_id=payload.get("teacher_id", ""),
            )
            if text not in seen or seen[text].score < chunk.score:
                seen[text] = chunk

        # Sort by score and return top_k
        sorted_chunks = sorted(seen.values(), key=lambda c: c.score, reverse=True)
        return sorted_chunks[:top_k]

    def format_context(self, chunks: list[RetrievedChunk]) -> str:
        """Format retrieved chunks as a block suitable for prompt injection."""
        if not chunks:
            return "Aucun contexte disponible dans la base documentaire."
        parts: list[str] = []
        for chunk in chunks:
            parts.append(
                f"Source : {chunk.filename} (pertinence : {chunk.score:.0%})\n"
                f"{chunk.text}\n---"
            )
        return "\n".join(parts)
