"""Custom application exceptions mapped to HTTP status codes."""

from fastapi import HTTPException, status


class LearnLabException(HTTPException):
    """Base exception for all LearnLab domain errors."""


class NotFoundException(LearnLabException):
    def __init__(self, detail: str = "Ressource introuvable"):
        super().__init__(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


class UnauthorizedException(LearnLabException):
    def __init__(self, detail: str = "Non autorisé"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class ForbiddenException(LearnLabException):
    def __init__(self, detail: str = "Accès refusé"):
        super().__init__(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


class ConflictException(LearnLabException):
    def __init__(self, detail: str = "Conflit de données"):
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)


class BadRequestException(LearnLabException):
    def __init__(self, detail: str = "Requête invalide"):
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class ServiceUnavailableException(LearnLabException):
    def __init__(self, detail: str = "Service temporairement indisponible"):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail
        )
