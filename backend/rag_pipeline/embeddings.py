"""Async wrapper around OpenAI text-embedding-3-small.

When OPENAI_API_KEY is a placeholder, all calls return random unit
vectors so the rest of the pipeline can be exercised without a real key.
"""

import math
import random
from typing import Final

import structlog

logger = structlog.get_logger(__name__)

_BATCH_LIMIT: Final[int] = 100  # OpenAI max per request


def _is_placeholder(api_key: str) -> bool:
    return api_key.startswith("sk-placeholder")


def _unit_vector(dim: int) -> list[float]:
    """Gaussian-normalised random vector — appropriate for cosine search."""
    v = [random.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [x / norm for x in v]


class EmbeddingService:
    model: str = "text-embedding-3-small"
    dimension: int = 1536

    def __init__(self, api_key: str) -> None:
        self._mock = _is_placeholder(api_key)
        if not self._mock:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(api_key=api_key)
        if self._mock:
            logger.warning("embedding_mock_mode_active")

    async def embed_text(self, text: str) -> list[float]:
        """Return the embedding vector of *text*."""
        if self._mock:
            return _unit_vector(self.dimension)
        response = await self._client.embeddings.create(
            model=self.model,
            input=text,
        )
        return response.data[0].embedding

    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Return embeddings for *texts*, paginating at 100 items per call."""
        if self._mock:
            return [_unit_vector(self.dimension) for _ in texts]

        results: list[list[float]] = []
        for i in range(0, len(texts), _BATCH_LIMIT):
            batch = texts[i : i + _BATCH_LIMIT]
            response = await self._client.embeddings.create(
                model=self.model,
                input=batch,
            )
            # OpenAI preserves order
            results.extend(item.embedding for item in response.data)
        return results
