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
from app.models.tp import GeneratedTP
from app.models.user import User
from app.schemas.teacher import (
    AnalyticsResponse,
    AskStudentRequest,
    AskStudentResponse,
    CreateInvitationCodeRequest,
    CreateTopicRequest,
    GeneratedTPItem,
    InvitationCodeResponse,
    StudentAtRisk,
    StudentSummary,
    SubmissionSummary,
    TeacherSubmissionItem,
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

    student = await db.get(User, student_id)
    if not student:
        raise NotFoundException("Étudiant introuvable")

    profile_result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = profile_result.scalar_one_or_none()

    # Final submissions only (official evaluations with score)
    final_subs_result = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student_id,
            Submission.submission_type == "submission",
        )
        .order_by(Submission.created_at.desc())
        .limit(15)
    )
    final_submissions = final_subs_result.scalars().all()

    # Execution attempts — fetch detail for enriched context
    exec_detail_result = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student_id,
            Submission.submission_type == "execution",
        )
        .order_by(Submission.created_at.asc())
        .limit(10)
    )
    exec_submissions = exec_detail_result.scalars().all()
    exec_count = len(exec_submissions)

    niveau = profile.niveau if profile else 1
    points_faibles = profile.points_faibles if profile else []
    concepts = profile.concepts_maitrises if profile else []

    _exec_ctx_labels = {
        "skeleton": "Squelette vide testé",
        "syntax_error": "Erreur de syntaxe",
        "logic_error": "Erreur logique",
        "runtime_error": "Erreur d'exécution",
        "correct": "Code correct",
        "unknown": "Tentative de code",
    }

    def build_exec_context(execs: list) -> str:
        if not execs:
            return "Aucune tentative d'exécution."
        lines = []
        for i, e in enumerate(execs, 1):
            errors = e.errors_json or {}
            exec_ctx = errors.get("execution_context", "unknown")
            errors_cat = errors.get("errors_categorized", [])
            feedback = errors.get("feedback_general", "")
            code_preview = (
                e.code[:200].replace("\n", " | ") if e.code else "vide"
            )
            label = _exec_ctx_labels.get(exec_ctx, "Tentative de code")
            error_descs = [
                f"{err.get('type')}: {err.get('description')}"
                for err in errors_cat
            ]
            lines.append(
                f"Tentative {i} ({e.created_at.strftime('%d/%m %H:%M')}) "
                f"— {label}\n"
                f"  Code : {code_preview}\n"
                f"  Erreurs : {' | '.join(error_descs) or 'Aucune'}\n"
                f"  Analyse : {feedback[:150]}\n"
            )
        return "\n".join(lines)

    exec_context = build_exec_context(exec_submissions)

    def build_submission_context(submissions: list) -> str:
        if not submissions:
            return "Aucune soumission finale encore."
        lines = []
        for i, s in enumerate(submissions, 1):
            errors = s.errors_json or {}
            errors_cat = errors.get("errors_categorized", [])
            tests = errors.get("tests_results", [])
            feedback = errors.get("feedback_general", errors.get("feedback", ""))
            passed = sum(1 for t in tests if t.get("passed"))
            total = len(tests)
            error_types = [e.get("type", "") for e in errors_cat]
            error_descs = [e.get("description", "") for e in errors_cat]
            code_preview = s.code[:300].replace("\n", " | ") if s.code else ""
            lines.append(
                f"Soumission {i} — {s.created_at.date()}\n"
                f"  Score : {s.score}/100\n"
                f"  Tests : {passed}/{total} passés\n"
                f"  Types d'erreurs : {', '.join(set(error_types)) or 'Aucune'}\n"
                f"  Détail erreurs : {' | '.join(error_descs) or 'Aucune'}\n"
                f"  Feedback agent : {feedback[:200]}\n"
                f"  Code soumis (extrait) : {code_preview}\n"
                f"  Stdout : {(s.stdout or '')[:100]}\n"
                f"  Stderr : {(s.stderr or '')[:100]}\n"
            )
        return "\n".join(lines)

    sub_context = build_submission_context(final_submissions)

    scores = [s.score for s in final_submissions if s.score is not None]
    score_moyen = round(sum(scores) / len(scores), 1) if scores else None

    progression = ""
    if len(scores) >= 2:
        diff = scores[0] - scores[-1]
        if diff > 0:
            progression = f"Progression positive : +{diff} points sur la période"
        elif diff < 0:
            progression = f"Régression : {diff} points sur la période"
        else:
            progression = "Score stable sur la période"

    score_moyen_str = f"{score_moyen}/100" if score_moyen is not None else "Pas encore de soumission finale"
    progression_str = progression or "Première évaluation"
    points_faibles_str = ', '.join(points_faibles) if points_faibles else "Non encore détectés"
    concepts_str = ', '.join(concepts) if concepts else "Non encore détectés"

    prompt = (
        f"Tu es un assistant pédagogique expert en analyse de code et en pédagogie informatique.\n\n"
        f"Génère un bilan pédagogique détaillé et UTILE pour l'étudiant "
        f"{student.first_name} {student.last_name}.\n\n"
        f"DONNÉES IMPORTANTES À COMPRENDRE :\n"
        f"- submission_type='submission' = évaluation officielle avec score → BASE DE TON ANALYSE\n"
        f"- submission_type='execution' = test de code intermédiaire sans score → SIGNE POSITIF\n"
        f"  d'engagement, ne jamais interpréter comme un travail non rendu ou une difficulté\n\n"
        f"PROFIL ACTUEL :\n"
        f"Niveau : {niveau}/5\n"
        f"Score moyen (soumissions finales) : {score_moyen_str}\n"
        f"Progression : {progression_str}\n"
        f"Points faibles identifiés : {points_faibles_str}\n"
        f"Concepts maîtrisés : {concepts_str}\n"
        f"Tentatives d'exécution (engagement) : {exec_count}\n\n"
        f"SOUMISSIONS FINALES DÉTAILLÉES :\n{sub_context}\n\n"
        f"TENTATIVES D'EXÉCUTION DÉTAILLÉES ({exec_count} tentatives) :\n{exec_context}\n\n"
        f"INSTRUCTIONS D'ANALYSE :\n\n"
        f"Analyse le CODE SOUMIS et les ERREURS RÉELLES pour produire un rapport concret.\n\n"
        f"ANALYSE DU PROCESSUS D'APPRENTISSAGE :\n"
        f"Les tentatives d'exécution montrent la progression AVANT la soumission finale.\n"
        f"Si des tentatives intéressantes existent (erreurs spécifiques, progression visible),\n"
        f"mentionne-les concrètement. NE mentionne PAS les tentatives 'skeleton' comme des difficultés.\n\n"
        f"1. RÉSUMÉ DE PROGRESSION :\n"
        f"   Basé sur les scores réels. Mentionne positivement les {exec_count} "
        f"tentatives d'exécution comme preuve d'engagement.\n\n"
        f"2. POINTS FORTS :\n"
        f"   Identifie ce qui est correct dans le code soumis. Sois précis — cite des éléments du code.\n\n"
        f"3. DIFFICULTÉS RÉCURRENTES :\n"
        f"   Pour chaque difficulté : nomme le concept, donne un exemple du code soumis, explique l'erreur.\n\n"
        f"4. RECOMMANDATIONS PRÉCISES :\n"
        f"   Pour chaque difficulté : recommandation concrète et réalisable. Pas de généralités.\n\n"
        f"5. OBJECTIFS POUR LA PROCHAINE PÉRIODE :\n"
        f"   2-3 objectifs SMART basés sur les vraies lacunes observées.\n\n"
        f"RÈGLES :\n"
        f"- Cite des éléments concrets du code soumis\n"
        f"- Ne jamais interpréter score=None comme un échec\n"
        f"- Sois encourageant mais honnête\n"
        f"- Maximum 600 mots en français\n"
        f"- Évite les généralités — chaque phrase doit apporter une information utile"
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
            "submissions_count": len(final_submissions),
            "exec_count": exec_count,
            "score_moyen": score_moyen,
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

    # Final submissions only (official evaluations with score)
    final_subs_result = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student_id,
            Submission.teacher_id == teacher.id,
            Submission.submission_type == "submission",
        )
        .order_by(Submission.created_at.desc())
        .limit(10)
    )
    final_submissions = final_subs_result.scalars().all()

    # Execution attempts — fetch detail for enriched context
    exec_ask_result = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student_id,
            Submission.teacher_id == teacher.id,
            Submission.submission_type == "execution",
        )
        .order_by(Submission.created_at.asc())
        .limit(10)
    )
    exec_ask_submissions = exec_ask_result.scalars().all()
    exec_count = len(exec_ask_submissions)

    scores = [s.score for s in final_submissions if s.score is not None]
    score_moyen = round(sum(scores) / len(scores), 1) if scores else None
    niveau = profile.niveau if profile else 1

    _ask_ctx_labels = {
        "skeleton": "Squelette vide testé",
        "syntax_error": "Erreur de syntaxe",
        "logic_error": "Erreur logique",
        "runtime_error": "Erreur d'exécution",
        "correct": "Code correct",
        "unknown": "Tentative de code",
    }

    def build_ask_exec_context(execs: list) -> str:
        if not execs:
            return "Aucune tentative d'exécution."
        lines = []
        for i, e in enumerate(execs, 1):
            errors = e.errors_json or {}
            exec_ctx = errors.get("execution_context", "unknown")
            errors_cat = errors.get("errors_categorized", [])
            feedback = errors.get("feedback_general", "")
            code_preview = (
                e.code[:200].replace("\n", " | ") if e.code else "vide"
            )
            label = _ask_ctx_labels.get(exec_ctx, "Tentative de code")
            error_descs = [
                f"{err.get('type')}: {err.get('description')}"
                for err in errors_cat
            ]
            lines.append(
                f"Tentative {i} ({e.created_at.strftime('%d/%m %H:%M')}) "
                f"— {label}\n"
                f"  Code : {code_preview}\n"
                f"  Erreurs : {' | '.join(error_descs) or 'Aucune'}\n"
                f"  Analyse : {feedback[:150]}\n"
            )
        return "\n".join(lines)

    ask_exec_context = build_ask_exec_context(exec_ask_submissions)

    def build_submission_context(submissions: list) -> str:
        if not submissions:
            return "Aucune soumission finale encore."
        lines = []
        for i, s in enumerate(submissions, 1):
            errors = s.errors_json or {}
            errors_cat = errors.get("errors_categorized", [])
            tests = errors.get("tests_results", [])
            feedback = errors.get("feedback_general", errors.get("feedback", ""))
            passed = sum(1 for t in tests if t.get("passed"))
            total = len(tests)
            error_types = [e.get("type", "") for e in errors_cat]
            error_descs = [e.get("description", "") for e in errors_cat]
            code_preview = s.code[:300].replace("\n", " | ") if s.code else ""
            lines.append(
                f"Soumission {i} — {s.created_at.date()}\n"
                f"  Score : {s.score}/100\n"
                f"  Tests : {passed}/{total} passés\n"
                f"  Types d'erreurs : {', '.join(set(error_types)) or 'Aucune'}\n"
                f"  Détail erreurs : {' | '.join(error_descs) or 'Aucune'}\n"
                f"  Feedback agent : {feedback[:200]}\n"
                f"  Code soumis (extrait) : {code_preview}\n"
            )
        return "\n".join(lines)

    sub_context = build_submission_context(final_submissions)
    score_moyen_str = f"{score_moyen}/100" if score_moyen is not None else "Pas de soumission finale"

    prompt = (
        f"Tu es un assistant pédagogique expert.\n\n"
        f"IMPORTANT — Contexte du système :\n"
        f"- submission_type='execution' = test intermédiaire sans score, signe d'engagement positif\n"
        f"- submission_type='submission' = évaluation finale avec score, base de l'analyse\n\n"
        f"Profil de {student.first_name} {student.last_name} :\n"
        f"Niveau : {niveau}/5\n"
        f"Score moyen : {score_moyen_str}\n"
        f"Tentatives d'exécution : {exec_count} (engagement positif)\n\n"
        f"Soumissions finales analysées :\n{sub_context}\n\n"
        f"Tentatives d'exécution détaillées ({exec_count}) :\n{ask_exec_context}\n\n"
        f"Question de l'enseignant : {body.question}\n\n"
        f"Réponds de façon PRÉCISE et UTILE.\n"
        f"Appuie-toi sur les données réelles du code, des erreurs ET des tentatives d'exécution pour répondre.\n"
        f"Maximum 200 mots en français."
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


# ── TP Monitor ────────────────────────────────────────────────────────────────

@router.get("/generated-tps", response_model=list[GeneratedTPItem])
async def list_generated_tps(
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[GeneratedTPItem]:
    """Return all AI-generated TPs for students enrolled with this teacher."""
    enroll_res = await db.execute(
        select(StudentEnrollment.student_id).where(StudentEnrollment.teacher_id == teacher.id)
    )
    student_ids = [row[0] for row in enroll_res.all()]

    if not student_ids:
        return []

    tp_res = await db.execute(
        select(GeneratedTP)
        .where(GeneratedTP.teacher_id == teacher.id)
        .order_by(GeneratedTP.created_at.desc())
        .limit(50)
    )
    tps = tp_res.scalars().all()

    items: list[GeneratedTPItem] = []
    for tp in tps:
        student_res = await db.execute(select(User).where(User.id == tp.student_id))
        student: User | None = student_res.scalar_one_or_none()
        student_name = (
            f"{student.first_name} {student.last_name}" if student else str(tp.student_id)
        )

        topic_res = await db.execute(select(Topic).where(Topic.id == tp.topic_id))
        topic: Topic | None = topic_res.scalar_one_or_none()
        topic_title = topic.title if topic else str(tp.topic_id)

        sub_count_res = await db.execute(
            select(func.count(Submission.id)).where(
                Submission.tp_id == tp.id,
                Submission.submission_type == "submission",
            )
        )
        submissions_count = sub_count_res.scalar() or 0

        items.append(
            GeneratedTPItem(
                tp_id=tp.id,
                student_name=student_name,
                topic_title=topic_title,
                enonce_preview=(tp.enonce or "")[:3000],
                starter_code_preview=(tp.starter_code or "")[:2000],
                created_at=tp.created_at,
                submissions_count=submissions_count,
            )
        )
    return items


@router.get("/submissions", response_model=list[TeacherSubmissionItem])
async def list_teacher_submissions(
    student_id: Optional[uuid.UUID] = None,
    topic_id: Optional[uuid.UUID] = None,
    min_score: Optional[int] = None,
    max_score: Optional[int] = None,
    teacher: User = Depends(get_current_teacher),
    db: AsyncSession = Depends(get_db),
) -> list[TeacherSubmissionItem]:
    """Return final submissions for all students enrolled with this teacher."""
    query = (
        select(Submission)
        .where(
            Submission.teacher_id == teacher.id,
            Submission.submission_type == "submission",
        )
        .order_by(Submission.created_at.desc())
        .limit(100)
    )

    if student_id is not None:
        query = query.where(Submission.student_id == student_id)
    if topic_id is not None:
        query = query.where(Submission.tp_id == topic_id)
    if min_score is not None:
        query = query.where(Submission.score >= min_score)
    if max_score is not None:
        query = query.where(Submission.score <= max_score)

    sub_res = await db.execute(query)
    submissions = sub_res.scalars().all()

    items: list[TeacherSubmissionItem] = []
    for sub in submissions:
        student_res = await db.execute(select(User).where(User.id == sub.student_id))
        student: User | None = student_res.scalar_one_or_none()
        student_name = (
            f"{student.first_name} {student.last_name}" if student else str(sub.student_id)
        )

        topic_title = str(sub.tp_id)
        tp_res = await db.execute(select(GeneratedTP).where(GeneratedTP.id == sub.tp_id))
        tp: GeneratedTP | None = tp_res.scalar_one_or_none()
        if tp:
            topic_res = await db.execute(select(Topic).where(Topic.id == tp.topic_id))
            topic: Topic | None = topic_res.scalar_one_or_none()
            if topic:
                topic_title = topic.title

        errors = sub.errors_json or {}
        tests = errors.get("tests_results", [])
        errors_cat = errors.get("errors_categorized", [])
        feedback = errors.get("feedback_general", errors.get("feedback", ""))
        tests_passed = sum(1 for t in tests if t.get("passed"))

        items.append(
            TeacherSubmissionItem(
                submission_id=sub.id,
                student_name=student_name,
                topic_title=topic_title,
                score=sub.score,
                code_preview=(sub.code or "")[:3000],
                feedback=feedback,
                tests_passed=tests_passed,
                tests_total=len(tests),
                errors_categorized=errors_cat,
                created_at=sub.created_at,
            )
        )
    return items
