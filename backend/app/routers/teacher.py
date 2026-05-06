"""Teacher router — invitation codes, topics, student management, analytics."""

import random
import string
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_teacher
from app.models.enrollment import StudentEnrollment
from app.models.invitation import InvitationCode
from app.models.report import Report
from app.models.student_profile import StudentProfile
from app.models.submission import Submission
from app.models.topic import Topic
from app.models.user import User
from app.schemas.teacher import (
    AnalyticsResponse,
    AskStudentRequest,
    AskStudentResponse,
    CreateInvitationCodeRequest,
    CreateTopicRequest,
    InvitationCodeResponse,
    StudentAtRisk,
    StudentSummary,
    SubmissionSummary,
    TopErrorItem,
    TopicResponse,
    UpdateTopicRequest,
)
from app.utils.exceptions import ForbiddenException, NotFoundException

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/teacher", tags=["teacher"])


# ── Invitation codes ──────────────────────────────────────────────────────────

def _generate_code(teacher: User) -> str:
    initials = (
        (teacher.first_name[0] if teacher.first_name else "X")
        + (teacher.last_name[0] if teacher.last_name else "X")
    ).upper()
    year = datetime.now(timezone.utc).year
    suffix = "".join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"{initials}-{year}-{suffix}"


@router.post("/invitation-codes", response_model=InvitationCodeResponse, status_code=201)
async def create_invitation_code(
    body: CreateInvitationCodeRequest = CreateInvitationCodeRequest(),
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> InvitationCodeResponse:
    # Deactivate all previous active codes for this teacher
    await db.execute(
        update(InvitationCode)
        .where(
            InvitationCode.teacher_id == teacher.id,
            InvitationCode.is_active.is_(True),
        )
        .values(is_active=False)
    )

    for _ in range(10):
        code_str = _generate_code(teacher)
        existing = await db.execute(
            select(InvitationCode).where(InvitationCode.code == code_str)
        )
        if existing.scalar_one_or_none() is None:
            break

    code = InvitationCode(
        code=code_str,
        teacher_id=teacher.id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=30),
        max_uses=body.max_uses,
    )
    db.add(code)
    await db.commit()
    await db.refresh(code)

    return InvitationCodeResponse(
        **{col: getattr(code, col) for col in
           ["code", "teacher_id", "expires_at", "max_uses", "current_uses", "is_active"]},
        enrolled_count=0,
    )


@router.get("/invitation-codes", response_model=list[InvitationCodeResponse])
async def list_invitation_codes(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[InvitationCodeResponse]:
    result = await db.execute(
        select(InvitationCode).where(InvitationCode.teacher_id == teacher.id)
    )
    codes = result.scalars().all()

    responses: list[InvitationCodeResponse] = []
    for code in codes:
        count_result = await db.execute(
            select(func.count())
            .select_from(StudentEnrollment)
            .where(
                StudentEnrollment.teacher_id == teacher.id,
                StudentEnrollment.joined_via_code == code.code,
            )
        )
        enrolled_count = count_result.scalar() or 0
        responses.append(
            InvitationCodeResponse(
                **{col: getattr(code, col) for col in
                   ["code", "teacher_id", "expires_at", "max_uses", "current_uses", "is_active"]},
                enrolled_count=enrolled_count,
            )
        )
    return responses


# ── Topics ────────────────────────────────────────────────────────────────────

@router.post("/topics", response_model=TopicResponse, status_code=201)
async def create_topic(
    body: CreateTopicRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> TopicResponse:
    topic = Topic(
        teacher_id=teacher.id,
        title=body.title,
        description=body.description,
        domaine=body.domaine,
        niveau_min=body.niveau_min,
        tags=body.tags,
        is_active=body.is_active,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    logger.info("topic_created", topic_id=str(topic.id), teacher_id=str(teacher.id))
    return TopicResponse.model_validate(topic)


@router.get("/topics", response_model=list[TopicResponse])
async def list_topics(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[TopicResponse]:
    result = await db.execute(
        select(Topic)
        .where(Topic.teacher_id == teacher.id)
        .order_by(Topic.created_at.desc())
    )
    return [TopicResponse.model_validate(t) for t in result.scalars().all()]


@router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(
    topic_id: uuid.UUID,
    body: UpdateTopicRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> TopicResponse:
    topic: Topic | None = await db.get(Topic, topic_id)
    if not topic:
        raise NotFoundException("Topic introuvable")
    if topic.teacher_id != teacher.id:
        raise ForbiddenException("Ce topic ne vous appartient pas")

    if body.title is not None:
        topic.title = body.title
    if body.description is not None:
        topic.description = body.description
    if body.domaine is not None:
        topic.domaine = body.domaine
    if body.niveau_min is not None:
        topic.niveau_min = body.niveau_min
    if body.tags is not None:
        topic.tags = body.tags
    if body.is_active is not None:
        topic.is_active = body.is_active

    await db.commit()
    await db.refresh(topic)
    return TopicResponse.model_validate(topic)


# ── Students ──────────────────────────────────────────────────────────────────

@router.get("/students", response_model=list[StudentSummary])
async def list_students(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[StudentSummary]:
    """List enrolled students with their profile summary."""
    enroll_result = await db.execute(
        select(StudentEnrollment).where(StudentEnrollment.teacher_id == teacher.id)
    )
    enrollments = enroll_result.scalars().all()

    summaries: list[StudentSummary] = []
    for enrollment in enrollments:
        student_res = await db.execute(
            select(User).where(User.id == enrollment.student_id)
        )
        student: User | None = student_res.scalar_one_or_none()
        if not student:
            continue

        profile_res = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student.id)
        )
        profile: StudentProfile | None = profile_res.scalar_one_or_none()

        # Average score from submissions
        score_res = await db.execute(
            select(func.avg(Submission.score), func.count(Submission.id), func.max(Submission.created_at))
            .where(
                Submission.student_id == student.id,
                Submission.teacher_id == teacher.id,
                Submission.score.isnot(None),
            )
        )
        avg_score, sub_count, last_activity = score_res.one()

        summaries.append(
            StudentSummary(
                id=student.id,
                first_name=student.first_name,
                last_name=student.last_name,
                email=student.email,
                niveau=profile.niveau if profile else 1,
                score_moyen=round(float(avg_score), 1) if avg_score else None,
                submissions_count=sub_count or 0,
                derniere_activite=last_activity,
            )
        )
    return summaries


@router.get("/students/{student_id}/submissions", response_model=list[SubmissionSummary])
async def student_submissions(
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[SubmissionSummary]:
    """List a specific student's submissions (verifies enrollment)."""
    enroll = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.teacher_id == teacher.id,
        )
    )
    if not enroll.scalar_one_or_none():
        raise ForbiddenException("Cet étudiant n'est pas inscrit chez vous")

    result = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student_id,
            Submission.teacher_id == teacher.id,
        )
        .order_by(Submission.created_at.desc())
        .limit(50)
    )
    return [SubmissionSummary.model_validate(s) for s in result.scalars().all()]


@router.get("/students/{student_id}/report")
async def student_report(
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the latest AI report for a student."""
    enroll = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.teacher_id == teacher.id,
        )
    )
    if not enroll.scalar_one_or_none():
        raise ForbiddenException("Cet étudiant n'est pas inscrit chez vous")

    result = await db.execute(
        select(Report)
        .where(
            Report.student_id == student_id,
            Report.teacher_id == teacher.id,
        )
        .order_by(Report.created_at.desc())
        .limit(1)
    )
    report: Report | None = result.scalar_one_or_none()
    if not report:
        raise NotFoundException("Aucun rapport disponible pour cet étudiant")

    return {
        "id": str(report.id),
        "period_start": report.period_start.isoformat(),
        "period_end": report.period_end.isoformat(),
        "content": report.content,
        "metrics": report.metrics_json,
        "created_at": report.created_at.isoformat(),
    }


@router.post("/students/{student_id}/report")
async def generate_student_report(
    student_id: uuid.UUID,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate a fresh AI report for a student via direct LLM call."""
    from datetime import timezone, timedelta

    from fastapi import HTTPException
    from langchain_core.messages import HumanMessage

    from ai_engine.llm_factory import get_llm

    enroll = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.teacher_id == teacher.id,
        )
    )
    if not enroll.scalar_one_or_none():
        raise NotFoundException("Étudiant non trouvé")

    student_result = await db.get(User, student_id)
    if not student_result:
        raise NotFoundException("Étudiant introuvable")

    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()

    subs_result = await db.execute(
        select(Submission)
        .where(Submission.student_id == student_id)
        .order_by(Submission.created_at.desc())
        .limit(20)
    )
    submissions = subs_result.scalars().all()

    niveau = profile.niveau if profile else 1
    points_faibles = profile.points_faibles if profile else []
    concepts = profile.concepts_maitrises if profile else []

    sub_summary = "\n".join([
        f"- {s.created_at.date()} : score {s.score}/100"
        for s in submissions
    ]) or "Aucune soumission encore"

    prompt = (
        f"Tu es un assistant pédagogique expert.\n"
        f"Génère un bilan pédagogique détaillé en français "
        f"pour l'étudiant {student_result.first_name} {student_result.last_name}.\n\n"
        f"Niveau actuel : {niveau}/5\n"
        f"Points faibles : {', '.join(points_faibles) or 'Non détectés'}\n"
        f"Concepts maîtrisés : {', '.join(concepts) or 'Aucun encore'}\n"
        f"Nombre de soumissions : {len(submissions)}\n\n"
        f"Historique récent :\n{sub_summary}\n\n"
        f"Rédige un rapport structuré avec :\n"
        f"1. Résumé de la progression générale\n"
        f"2. Points forts observés\n"
        f"3. Difficultés récurrentes avec exemples concrets\n"
        f"4. Recommandations pédagogiques précises\n"
        f"5. Objectifs suggérés pour la prochaine période\n\n"
        f"Sois précis, bienveillant et constructif.\n"
        f"Maximum 500 mots. Réponds uniquement en français."
    )

    try:
        llm = get_llm()
        response = await llm.ainvoke([HumanMessage(content=prompt)])
        content = response.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur LLM : {str(e)}")

    now = datetime.now(timezone.utc)
    report = Report(
        student_id=student_id,
        teacher_id=teacher.id,
        period_start=now - timedelta(days=7),
        period_end=now,
        content=content,
        metrics_json={
            "submissions_count": len(submissions),
            "niveau": niveau,
        },
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return {
        "id": str(report.id),
        "content": content,
        "created_at": report.created_at.isoformat(),
    }


# ── Analytics ─────────────────────────────────────────────────────────────────

@router.get("/analytics", response_model=AnalyticsResponse)
async def analytics(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> AnalyticsResponse:
    """Aggregate metrics for all students enrolled with this teacher."""
    enroll_res = await db.execute(
        select(StudentEnrollment.student_id).where(StudentEnrollment.teacher_id == teacher.id)
    )
    student_ids = [row[0] for row in enroll_res.all()]
    total_students = len(student_ids)

    if not student_ids:
        return AnalyticsResponse(
            total_students=0,
            avg_score_class=None,
            completion_rate=0.0,
            top_errors=[],
            students_at_risk=[],
        )

    # Class-wide average score
    avg_res = await db.execute(
        select(func.avg(Submission.score))
        .where(
            Submission.teacher_id == teacher.id,
            Submission.score.isnot(None),
        )
    )
    avg_score_class = avg_res.scalar()

    # Error type aggregation
    sub_res = await db.execute(
        select(Submission.errors_json).where(
            Submission.teacher_id == teacher.id,
            Submission.errors_json.isnot(None),
        )
    )
    error_counts: dict[str, int] = {}
    total_errors = 0
    for (errors_json,) in sub_res.all():
        if not errors_json:
            continue
        for err in errors_json.get("errors_categorized", []):
            t = err.get("type", "Unknown")
            error_counts[t] = error_counts.get(t, 0) + 1
            total_errors += 1

    top_errors = [
        TopErrorItem(
            type=k,
            count=v,
            percentage=round(v / total_errors * 100, 1) if total_errors else 0,
        )
        for k, v in sorted(error_counts.items(), key=lambda x: -x[1])[:5]
    ]

    # Students at risk (avg score < 50)
    at_risk: list[StudentAtRisk] = []
    for s_id in student_ids:
        s_avg_res = await db.execute(
            select(func.avg(Submission.score), func.max(Submission.created_at))
            .where(
                Submission.student_id == s_id,
                Submission.teacher_id == teacher.id,
                Submission.score.isnot(None),
            )
        )
        s_avg, last_act = s_avg_res.one()
        if s_avg is not None and float(s_avg) < 50:
            user_res = await db.execute(select(User).where(User.id == s_id))
            u: User | None = user_res.scalar_one_or_none()
            if u:
                at_risk.append(
                    StudentAtRisk(
                        student_id=u.id,
                        name=f"{u.first_name} {u.last_name}",
                        avg_score=round(float(s_avg), 1),
                        last_activity=last_act,
                    )
                )

    # Completion rate = students with >= 1 submission / total enrolled
    sub_students_res = await db.execute(
        select(func.count(func.distinct(Submission.student_id))).where(
            Submission.teacher_id == teacher.id
        )
    )
    students_with_subs = sub_students_res.scalar() or 0
    completion_rate = round(students_with_subs / total_students * 100, 1)

    return AnalyticsResponse(
        total_students=total_students,
        avg_score_class=round(float(avg_score_class), 1) if avg_score_class else None,
        completion_rate=completion_rate,
        top_errors=top_errors,
        students_at_risk=at_risk,
    )


# ── AI Question about a student ───────────────────────────────────────────────

@router.post("/students/{student_id}/ask", response_model=AskStudentResponse)
async def ask_about_student(
    student_id: uuid.UUID,
    body: AskStudentRequest,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> AskStudentResponse:
    """Let a teacher ask an AI question about a specific student's performance."""
    # Verify enrollment
    enroll = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student_id,
            StudentEnrollment.teacher_id == teacher.id,
        )
    )
    if not enroll.scalar_one_or_none():
        raise ForbiddenException("Cet étudiant n'est pas inscrit chez vous")

    # Load student
    student_res = await db.execute(select(User).where(User.id == student_id))
    student: User | None = student_res.scalar_one_or_none()
    if not student:
        raise NotFoundException("Étudiant introuvable")

    # Load profile
    profile_res = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile: StudentProfile | None = profile_res.scalar_one_or_none()

    # Load last 10 submissions
    sub_res = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student_id,
            Submission.teacher_id == teacher.id,
        )
        .order_by(Submission.created_at.desc())
        .limit(10)
    )
    submissions = sub_res.scalars().all()

    score_moyen = None
    if submissions:
        scores = [s.score for s in submissions if s.score is not None]
        score_moyen = round(sum(scores) / len(scores), 1) if scores else None

    sub_summary = "\n".join(
        f"- Soumission du {s.created_at.strftime('%d/%m/%Y')} : score {s.score or '—'}%"
        for s in submissions[:5]
    ) or "Aucune soumission récente"

    points_faibles = ", ".join(profile.points_faibles) if profile and profile.points_faibles else "Non identifiés"
    niveau = profile.niveau if profile else 1

    prompt = (
        f"Tu es un assistant pédagogique expert. "
        f"Voici le profil de l'étudiant {student.first_name} {student.last_name} :\n"
        f"- Niveau : {niveau}/5\n"
        f"- Score moyen : {score_moyen if score_moyen is not None else '—'}%\n"
        f"- Points faibles : {points_faibles}\n"
        f"- Dernières soumissions :\n{sub_summary}\n\n"
        f"Question de l'enseignant : {body.question}\n\n"
        f"Réponds en français, de façon concise (maximum 150 mots), "
        f"avec des recommandations pédagogiques concrètes."
    )

    from ai_engine.llm_factory import get_llm
    from langchain_core.messages import HumanMessage, SystemMessage

    llm = get_llm()
    messages = [
        SystemMessage(content="Tu es un assistant pédagogique spécialisé dans l'analyse des performances étudiantes."),
        HumanMessage(content=prompt),
    ]
    result = await llm.ainvoke(messages)
    response_text = result.content if hasattr(result, "content") else str(result)

    return AskStudentResponse(response=response_text)
