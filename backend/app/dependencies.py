"""FastAPI shared dependencies — current user injection."""

import uuid

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.utils.exceptions import ForbiddenException, UnauthorizedException
from app.utils.security import decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Decode JWT and load the corresponding User from the database."""
    payload = decode_token(token)

    if payload.get("type") != "access":
        raise UnauthorizedException("Token de type incorrect")

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise UnauthorizedException("Token malformé")

    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError as exc:
        raise UnauthorizedException("Token malformé") from exc

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if user is None:
        raise UnauthorizedException("Utilisateur introuvable")

    return user


async def get_current_teacher(
    user: User = Depends(get_current_user),
) -> User:
    """Ensure the authenticated user has the 'teacher' role."""
    if user.role != "teacher":
        raise ForbiddenException("Accès réservé aux enseignants")
    return user


async def get_current_student(
    user: User = Depends(get_current_user),
) -> User:
    """Ensure the authenticated user has the 'student' role."""
    if user.role != "student":
        raise ForbiddenException("Accès réservé aux étudiants")
    return user
