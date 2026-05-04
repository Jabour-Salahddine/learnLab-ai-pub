"""Async-friendly MinIO helper (wraps the synchronous minio SDK)."""

import asyncio
import io
from datetime import timedelta

import structlog
from minio import Minio
from minio.error import S3Error

from app.config import settings

logger = structlog.get_logger(__name__)


def _client() -> Minio:
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=False,
    )


def _ensure_bucket() -> None:
    c = _client()
    bucket = settings.minio_bucket
    if not c.bucket_exists(bucket):
        c.make_bucket(bucket)
        logger.info("minio_bucket_created", bucket=bucket)


def _upload_sync(object_name: str, data: bytes, content_type: str) -> None:
    _ensure_bucket()
    c = _client()
    c.put_object(
        settings.minio_bucket,
        object_name,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def _delete_sync(object_name: str) -> None:
    c = _client()
    c.remove_object(settings.minio_bucket, object_name)


async def upload_file(object_name: str, data: bytes, content_type: str) -> None:
    """Upload *data* to MinIO.  Falls back silently if MinIO is unavailable."""
    try:
        await asyncio.to_thread(_upload_sync, object_name, data, content_type)
        logger.info("minio_upload_ok", object=object_name)
    except Exception as exc:
        logger.warning("minio_upload_failed", object=object_name, error=str(exc))


async def delete_file(object_name: str) -> None:
    """Delete an object from MinIO.  Silently ignores missing objects."""
    try:
        await asyncio.to_thread(_delete_sync, object_name)
    except S3Error as exc:
        if exc.code != "NoSuchKey":
            logger.warning("minio_delete_failed", object=object_name, error=str(exc))
    except Exception as exc:
        logger.warning("minio_delete_failed", object=object_name, error=str(exc))


def _presigned_url_sync(object_name: str, expires_seconds: int = 3600) -> str:
    c = _client()
    return c.presigned_get_object(
        settings.minio_bucket,
        object_name,
        expires=timedelta(seconds=expires_seconds),
    )


async def get_presigned_url(object_name: str, expires_seconds: int = 3600) -> str:
    """Generate a presigned GET URL for a MinIO object (1h default TTL)."""
    try:
        return await asyncio.to_thread(_presigned_url_sync, object_name, expires_seconds)
    except Exception as exc:
        logger.warning("minio_presign_failed", object=object_name, error=str(exc))
        return ""
