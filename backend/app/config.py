"""Application settings loaded from environment variables."""

import json
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration values injected from .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # PostgreSQL
    postgres_user: str = "learnlab"
    postgres_password: str = "learnlab_secure_2025"
    postgres_db: str = "learnlab_db"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60
    jwt_refresh_token_expire_days: int = 7

    # OpenAI
    openai_api_key: str = "sk-placeholder"

    # Qdrant
    qdrant_host: str = "qdrant"
    qdrant_port: int = 6333

    # Piston sandbox
    piston_url: str = "http://piston:2000"

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "learnlab_minio"
    minio_secret_key: str = "learnlab_minio_secret"
    minio_bucket: str = "rag-documents"

    # App
    environment: str = "development"
    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    @property
    def database_url(self) -> str:
        """Async PostgreSQL DSN for SQLAlchemy."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        """Sync PostgreSQL DSN used by Alembic."""
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
