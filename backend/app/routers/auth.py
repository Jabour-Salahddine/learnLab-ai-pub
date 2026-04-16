"""Authentication router — register, login, refresh."""

import uuid
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.enrollment import StudentEnrollment
from app.models.invitation import InvitationCode
from app.models.student_profile import StudentProfile
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterStudentRequest,
    RegisterTeacherRequest,
    TokenResponse,
    UserResponse,
)
from app.utils.exceptions import (
    BadRequestException,
    ConflictException,
    UnauthorizedException,
)
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _build_token_response(user: User) -> TokenResponse:
    """Build JWT pair + user info for a response."""
    payload = {"sub": str(user.id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
        user=UserResponse.model_validate(user),
    )


async def _create_qdrant_collection(teacher_id: uuid.UUID) -> None:
    """Create an isolated Qdrant collection for the new teacher (background)."""
    try:
        from qdrant_client import AsyncQdrantClient
        from qdrant_client.models import Distance, VectorParams

        from app.config import settings

        client = AsyncQdrantClient(host=settings.qdrant_host, port=settings.qdrant_port)
        collection_name = f"teacher_{teacher_id}"
        await client.recreate_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=1536, distance=Distance.COSINE),
        )
        logger.info("qdrant_collection_created", collection=collection_name)
    except Exception:
        # Non-blocking — Qdrant may not be up in every environment
        logger.warning("qdrant_collection_creation_failed", teacher_id=str(teacher_id))


# ── POST /auth/register/student ───────────────────────────────────────────────

@router.post("/register/student", response_model=TokenResponse, status_code=201)
async def register_student(
    body: RegisterStudentRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Register a new student using a valid invitation code."""
    # 1. Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise ConflictException("Un compte existe déjà avec cet email")

    # 2. Validate invitation code
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(InvitationCode).where(InvitationCode.code == body.invitation_code)
    )
    code_obj: InvitationCode | None = result.scalar_one_or_none()

    if code_obj is None:
        raise BadRequestException("Code d'invitation invalide")
    if not code_obj.is_active:
        raise BadRequestException("Code d'invitation désactivé")
    if code_obj.expires_at < now:
        raise BadRequestException("Code d'invitation expiré")
    if code_obj.current_uses >= code_obj.max_uses:
        raise BadRequestException("Code d'invitation épuisé")

    # 3. Create user
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role="student",
        first_name=body.first_name,
        last_name=body.last_name,
        formation=body.formation,
        filiere=body.filiere,
        year_of_study=body.year_of_study,
    )
    db.add(user)
    await db.flush()  # get user.id before creating related records

    # 4. Create student profile (default niveau = 1)
    profile = StudentProfile(student_id=user.id)
    db.add(profile)

    # 5. Enroll under teacher
    enrollment = StudentEnrollment(
        student_id=user.id,
        teacher_id=code_obj.teacher_id,
        joined_via_code=body.invitation_code,
    )
    db.add(enrollment)

    # 6. Increment code usage
    code_obj.current_uses += 1

    await db.commit()

    logger.info("student_registered", user_id=str(user.id), teacher_id=str(code_obj.teacher_id))
    return _build_token_response(user)


# ── POST /auth/register/teacher ───────────────────────────────────────────────

@router.post("/register/teacher", response_model=TokenResponse, status_code=201)
async def register_teacher(
    body: RegisterTeacherRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Register a new teacher and provision their Qdrant collection."""
    # 1. Check email uniqueness
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise ConflictException("Un compte existe déjà avec cet email")

    # 2. Create user
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role="teacher",
        first_name=body.first_name,
        last_name=body.last_name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 3. Auto-create first invitation code for the teacher
    import random
    import string
    from app.models.invitation import InvitationCode

    def _gen_code() -> str:
        initials = (
            (user.first_name[0] if user.first_name else "X")
            + (user.last_name[0] if user.last_name else "X")
        ).upper()
        year = datetime.now(timezone.utc).year
        suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
        return f"{initials}-{year}-{suffix}"

    invitation = InvitationCode(
        code=_gen_code(),
        teacher_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=365),
        max_uses=200,
    )
    db.add(invitation)
    await db.commit()

    # 4. Provision Qdrant collection in background (non-blocking)
    background_tasks.add_task(_create_qdrant_collection, user.id)

    logger.info("teacher_registered", user_id=str(user.id))
    return _build_token_response(user)


# ── POST /auth/login ──────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Authenticate a user and return a JWT pair."""
    result = await db.execute(select(User).where(User.email == body.email))
    user: User | None = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise UnauthorizedException("Email ou mot de passe incorrect")

    logger.info("user_logged_in", user_id=str(user.id), role=user.role)
    return _build_token_response(user)


# ── POST /auth/refresh ────────────────────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Issue a new access token from a valid refresh token."""
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise UnauthorizedException("Token de rafraîchissement invalide")

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Token malformé")

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id_str)))
    user: User | None = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("Utilisateur introuvable")

    return _build_token_response(user)
