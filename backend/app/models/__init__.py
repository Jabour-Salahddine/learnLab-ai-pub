"""ORM model registry — import all models so Alembic discovers them."""

from app.models.chat import ChatMessage
from app.models.enrollment import StudentEnrollment
from app.models.invitation import InvitationCode
from app.models.rag_document import RagDocument
from app.models.report import Report
from app.models.student_profile import StudentProfile
from app.models.submission import Submission
from app.models.topic import Topic
from app.models.tp import GeneratedTP
from app.models.user import User

__all__ = [
    "User",
    "StudentProfile",
    "StudentEnrollment",
    "InvitationCode",
    "Topic",
    "GeneratedTP",
    "Submission",
    "ChatMessage",
    "RagDocument",
    "Report",
]
