"""Async Redis client and session helpers."""

import json
from typing import Any, Optional

from redis.asyncio import ConnectionPool, Redis

from app.config import settings

# Module-level pool — created once at startup, reused across requests
_pool: Optional[ConnectionPool] = None


def _get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool.from_url(
            settings.redis_url,
            max_connections=20,
            decode_responses=True,
        )
    return _pool


async def get_redis() -> Redis:
    """Return a Redis client backed by the shared connection pool."""
    return Redis(connection_pool=_get_pool())


# ─── Session helpers ────────────────────────────────────────────────────────


def _session_key(teacher_id: str, student_id: str, tp_id: str) -> str:
    """Canonical Redis key for a TP session."""
    return f"session:{teacher_id}:{student_id}:{tp_id}"


async def set_session(
    teacher_id: str,
    student_id: str,
    tp_id: str,
    data: dict[str, Any],
    ttl_seconds: int = 3600,
) -> None:
    """Persist session data as JSON with an expiry."""
    redis = await get_redis()
    key = _session_key(teacher_id, student_id, tp_id)
    await redis.set(key, json.dumps(data), ex=ttl_seconds)


async def get_session(
    teacher_id: str,
    student_id: str,
    tp_id: str,
) -> Optional[dict[str, Any]]:
    """Retrieve session data, or None if the key has expired."""
    redis = await get_redis()
    key = _session_key(teacher_id, student_id, tp_id)
    raw = await redis.get(key)
    return json.loads(raw) if raw else None


async def delete_session(
    teacher_id: str,
    student_id: str,
    tp_id: str,
) -> None:
    """Remove a session key immediately."""
    redis = await get_redis()
    key = _session_key(teacher_id, student_id, tp_id)
    await redis.delete(key)
