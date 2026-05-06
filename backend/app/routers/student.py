"""Student router — topics, TP generation, code submission, hints."""

import uuid
from datetime import datetime, timezone

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_student
from app.models.enrollment import StudentEnrollment
from app.models.tp import GeneratedTP as GeneratedTPModel
from app.models.student_profile import StudentProfile
from app.models.submission import Submission
from app.models.topic import Topic
from app.models.user import User
from app.schemas.student import (
    ErrorItem,
    GenerateTPResponse,
    HintResponse,
    RunCodeRequest,
    RunCodeResponse,
    StudentProfileResponse,
    SubmissionHistoryItem,
    SubmitCodeRequest,
    SubmitCodeResponse,
    TestResult,
    TopicListItem,
    TPDetailResponse,
)
from app.utils.exceptions import BadRequestException, ForbiddenException, NotFoundException

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/student", tags=["student"])


# ── Helpers ────────────────────────────────────────────────────────────────────


async def _get_student_profile(student_id: uuid.UUID, db: AsyncSession) -> StudentProfile:
    result = await db.execute(
        select(StudentProfile).where(StudentProfile.student_id == student_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        # Create default profile if missing
        profile = StudentProfile(student_id=student_id)
        db.add(profile)
        await db.commit()
        await db.refresh(profile)
    return profile


async def _get_teacher_id(student_id: uuid.UUID, db: AsyncSession) -> uuid.UUID | None:
    result = await db.execute(
        select(StudentEnrollment.teacher_id)
        .where(StudentEnrollment.student_id == student_id)
        .limit(1)
    )
    row = result.first()
    return row[0] if row else None


async def _run_piston(code: str, language: str = "python") -> dict:
    """Execute code in Piston sandbox. Returns {stdout, stderr, exit_code}."""
    payload = {
        "language": language,
        "version": "*",
        "files": [{"content": code}],
        "run_timeout": 30000,
    }
    try:
        async with httpx.AsyncClient(timeout=35.0) as client:
            resp = await client.post(
                f"{settings.piston_url}/api/v2/execute",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            run = data.get("run", {})
            return {
                "stdout": run.get("stdout", ""),
                "stderr": run.get("stderr", ""),
                "exit_code": run.get("code", -1),
            }
    except Exception as exc:
        logger.warning("piston_unavailable", error=str(exc))
        # Graceful degradation — try local execution in a subprocess
        return await _run_local(code)


async def _run_local(code: str) -> dict:
    """Fallback: run Python code in a subprocess (dev only)."""
    import asyncio
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
        f.write(code)
        tmp_path = f.name

    try:
        proc = await asyncio.create_subprocess_exec(
            "python", tmp_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30.0)
            return {
                "stdout": stdout.decode("utf-8", errors="replace"),
                "stderr": stderr.decode("utf-8", errors="replace"),
                "exit_code": proc.returncode or 0,
            }
        except asyncio.TimeoutError:
            proc.kill()
            return {"stdout": "", "stderr": "Timeout: exécution trop longue", "exit_code": -1}
    finally:
        os.unlink(tmp_path)


async def _run_analyst_background(
    student_id: str, teacher_id: str, graph
) -> None:
    """Fire-and-forget analyst update after submission."""
    from ai_engine.state import AgentState
    from app.database import AsyncSessionLocal

    async with AsyncSessionLocal() as db:
        from ai_engine.agents.analyst import AnalystAgent
        from ai_engine.llm_factory import get_llm

        analyst = AnalystAgent(get_llm(), db)
        state: AgentState = {
            "student_id": student_id,
            "teacher_id": teacher_id,
            "session_id": f"{student_id}:{teacher_id}",
            "tp_id": None,
            "topic_id": None,
            "topic_title": None,
            "topic_description": None,
            "student_level": 1,
            "student_weak_points": [],
            "student_concepts_maitrisés": [],
            "code_submitted": None,
            "stdout": None,
            "stderr": None,
            "exit_code": None,
            "generated_enonce": None,
            "generated_starter_code": None,
            "generated_tests": None,
            "generated_hints": None,
            "score": None,
            "errors_categorized": None,
            "tests_results": None,
            "rag_chunks": None,
            "chat_history": [],
            "current_question": None,
            "agent_response": None,
            "current_agent": None,
            "hint_level": 0,
            "action": "analyze",
            "error_message": None,
        }
        await analyst.update_profile(state)


# ── GET /student/topics ────────────────────────────────────────────────────────


@router.get("/topics", response_model=list[TopicListItem])
async def list_topics(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[TopicListItem]:
    """Return all active topics from enrolled teachers."""
    enroll_res = await db.execute(
        select(StudentEnrollment.teacher_id)
        .where(StudentEnrollment.student_id == student.id)
    )
    teacher_ids = [row[0] for row in enroll_res.all()]

    if not teacher_ids:
        return []

    topics_res = await db.execute(
        select(Topic)
        .where(Topic.teacher_id.in_(teacher_ids), Topic.is_active.is_(True))
        .order_by(Topic.created_at.desc())
    )
    return [TopicListItem.model_validate(t) for t in topics_res.scalars().all()]


# ── POST /student/topics/{topic_id}/generate ──────────────────────────────────


@router.post("/topics/{topic_id}/generate", response_model=GenerateTPResponse, status_code=201)
async def generate_tp(
    topic_id: uuid.UUID,
    request: Request,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> GenerateTPResponse:
    """Generate a personalised TP for the student using the Tutor Agent."""
    topic: Topic | None = await db.get(Topic, topic_id)
    if not topic or not topic.is_active:
        raise NotFoundException("Topic introuvable ou inactif")

    # Verify student is enrolled with this teacher
    enroll = await db.execute(
        select(StudentEnrollment).where(
            StudentEnrollment.student_id == student.id,
            StudentEnrollment.teacher_id == topic.teacher_id,
        )
    )
    if not enroll.scalar_one_or_none():
        raise ForbiddenException("Vous n'êtes pas inscrit avec cet enseignant")

    profile = await _get_student_profile(student.id, db)

    # Build initial state
    from ai_engine.state import AgentState

    state: AgentState = {
        "student_id": str(student.id),
        "teacher_id": str(topic.teacher_id),
        "tp_id": None,
        "session_id": f"{student.id}:{topic.teacher_id}",
        "topic_id": str(topic_id),
        "topic_title": topic.title,
        "topic_description": topic.description or "",
        "student_level": profile.niveau,
        "student_weak_points": list(profile.points_faibles or []),
        "student_concepts_maitrisés": list(profile.concepts_maitrises or []),
        "code_submitted": None,
        "stdout": None,
        "stderr": None,
        "exit_code": None,
        "generated_enonce": None,
        "generated_starter_code": None,
        "generated_tests": None,
        "generated_hints": None,
        "score": None,
        "errors_categorized": None,
        "tests_results": None,
        "rag_chunks": None,
        "chat_history": [],
        "current_question": None,
        "agent_response": None,
        "current_agent": None,
        "hint_level": 0,
        "action": "generate_tp",
        "error_message": None,
    }

    graph = request.app.state.graph
    result_state: AgentState = await graph.ainvoke(state)

    # Persist generated TP
    tp = GeneratedTPModel(
        student_id=student.id,
        topic_id=topic_id,
        teacher_id=topic.teacher_id,
        enonce=result_state.get("generated_enonce") or "",
        starter_code=result_state.get("generated_starter_code") or "",
        tests_unitaires=result_state.get("generated_tests") or [],
        hints_progressifs=result_state.get("generated_hints") or {},
        solution_modele="",  # stored but not exposed to students
    )
    db.add(tp)
    await db.commit()
    await db.refresh(tp)

    return GenerateTPResponse(
        tp_id=tp.id,
        enonce=tp.enonce,
        starter_code=tp.starter_code,
        tests_count=len(tp.tests_unitaires or []),
    )


# ── POST /student/tp/{tp_id}/run ──────────────────────────────────────────────


@router.post("/tp/{tp_id}/run", response_model=RunCodeResponse)
async def run_code(
    tp_id: uuid.UUID,
    body: RunCodeRequest,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> RunCodeResponse:
    """Execute code without full evaluation. Saved as type='execution' for traceability."""
    language = body.language.lower()

    # Check runtime availability
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.piston_url}/api/v2/runtimes")
            runtimes = resp.json()
            available_langs = [r["language"].lower() for r in runtimes]
            if language not in available_langs:
                return RunCodeResponse(
                    stdout="",
                    stderr=f"⚠️ Runtime '{language}' non disponible. Contactez votre enseignant.",
                    exit_code=-1,
                    runtime_available=False,
                )
    except Exception:
        return RunCodeResponse(
            stdout="",
            stderr="⚠️ Service d'exécution inaccessible.",
            exit_code=-1,
            runtime_available=False,
        )

    # Execute via Piston
    exec_result = await _run_piston(body.code, language)

    # Get teacher_id from enrollment
    teacher_id = await _get_teacher_id(student.id, db)
    effective_teacher_id = teacher_id if teacher_id else student.id

    # Save with type="execution" for traceability
    submission = Submission(
        student_id=student.id,
        tp_id=tp_id,
        teacher_id=effective_teacher_id,
        code=body.code,
        stdout=exec_result["stdout"],
        stderr=exec_result["stderr"],
        exit_code=exec_result["exit_code"],
        score=None,
        errors_json={},
        submission_type="execution",
    )
    db.add(submission)
    await db.commit()

    return RunCodeResponse(
        stdout=exec_result["stdout"],
        stderr=exec_result["stderr"],
        exit_code=exec_result["exit_code"],
        runtime_available=True,
    )


# ── POST /student/tp/{tp_id}/submit ───────────────────────────────────────────


@router.post("/tp/{tp_id}/submit", response_model=SubmitCodeResponse, status_code=201)
async def submit_code(
    tp_id: uuid.UUID,
    body: SubmitCodeRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> SubmitCodeResponse:
    """Submit code, run in Piston, evaluate with the Evaluator Agent."""
    tp: GeneratedTPModel | None = await db.get(GeneratedTPModel, tp_id)
    if not tp or tp.student_id != student.id:
        raise NotFoundException("TP introuvable")

    profile = await _get_student_profile(student.id, db)

    # Execute in sandbox
    exec_result = await _run_piston(body.code, body.language)

    # Build state for evaluator
    from ai_engine.state import AgentState

    state: AgentState = {
        "student_id": str(student.id),
        "teacher_id": str(tp.teacher_id),
        "tp_id": str(tp_id),
        "session_id": f"{student.id}:{tp.teacher_id}:{tp_id}",
        "topic_id": str(tp.topic_id),
        "topic_title": None,
        "topic_description": None,
        "student_level": profile.niveau,
        "student_weak_points": list(profile.points_faibles or []),
        "student_concepts_maitrisés": list(profile.concepts_maitrises or []),
        "code_submitted": body.code,
        "stdout": exec_result["stdout"],
        "stderr": exec_result["stderr"],
        "exit_code": exec_result["exit_code"],
        "generated_enonce": tp.enonce,
        "generated_starter_code": tp.starter_code,
        "generated_tests": tp.tests_unitaires,
        "generated_hints": tp.hints_progressifs,
        "score": None,
        "errors_categorized": None,
        "tests_results": None,
        "rag_chunks": None,
        "chat_history": [],
        "current_question": None,
        "agent_response": None,
        "current_agent": None,
        "hint_level": 0,
        "action": "evaluate",
        "error_message": None,
    }

    graph = request.app.state.graph
    result_state: AgentState = await graph.ainvoke(state)

    score = result_state.get("score") or 0
    tests_results = result_state.get("tests_results") or []
    errors = result_state.get("errors_categorized") or []
    feedback = result_state.get("agent_response") or ""
    hint = result_state.get("agent_response")  # hint is set when score < 70
    hint_level = result_state.get("hint_level", 0)

    # Persist submission
    submission = Submission(
        student_id=student.id,
        tp_id=tp_id,
        teacher_id=tp.teacher_id,
        code=body.code,
        stdout=exec_result["stdout"],
        stderr=exec_result["stderr"],
        exit_code=exec_result["exit_code"],
        score=score,
        errors_json={
            "errors_categorized": errors,
            "tests_results": tests_results,
            "feedback": feedback,
        },
        submission_type="submission",
    )
    db.add(submission)
    await db.commit()
    await db.refresh(submission)

    # Background analyst update
    background_tasks.add_task(
        _run_analyst_background,
        str(student.id),
        str(tp.teacher_id),
        graph,
    )

    return SubmitCodeResponse(
        submission_id=submission.id,
        score=score,
        tests_results=[TestResult(**t) for t in tests_results],
        errors_categorized=[ErrorItem(**e) for e in errors],
        feedback=feedback,
        hint=hint if score < 70 else None,
        hint_level=hint_level if score < 70 else None,
    )


# ── GET /student/tp/{tp_id}/hint ──────────────────────────────────────────────


@router.get("/tp/{tp_id}/hint", response_model=HintResponse)
async def get_hint(
    tp_id: uuid.UUID,
    request: Request,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> HintResponse:
    """Request the next progressive hint for the current TP."""
    tp: GeneratedTPModel | None = await db.get(GeneratedTPModel, tp_id)
    if not tp or tp.student_id != student.id:
        raise NotFoundException("TP introuvable")

    profile = await _get_student_profile(student.id, db)

    from ai_engine.state import AgentState

    state: AgentState = {
        "student_id": str(student.id),
        "teacher_id": str(tp.teacher_id),
        "tp_id": str(tp_id),
        "session_id": f"{student.id}:{tp.teacher_id}:{tp_id}",
        "topic_id": str(tp.topic_id),
        "topic_title": None,
        "topic_description": None,
        "student_level": profile.niveau,
        "student_weak_points": list(profile.points_faibles or []),
        "student_concepts_maitrisés": list(profile.concepts_maitrises or []),
        "code_submitted": None,
        "stdout": None,
        "stderr": None,
        "exit_code": None,
        "generated_enonce": tp.enonce,
        "generated_starter_code": tp.starter_code,
        "generated_tests": tp.tests_unitaires,
        "generated_hints": tp.hints_progressifs,
        "score": None,
        "errors_categorized": None,
        "tests_results": None,
        "rag_chunks": None,
        "chat_history": [],
        "current_question": None,
        "agent_response": None,
        "current_agent": None,
        "hint_level": 0,
        "action": "hint",
        "error_message": None,
    }

    graph = request.app.state.graph
    result_state: AgentState = await graph.ainvoke(state)

    return HintResponse(
        hint=result_state.get("agent_response") or "Réfléchissez à la structure de votre solution.",
        hint_level=result_state.get("hint_level", 1),
    )


# ── GET /student/profile ──────────────────────────────────────────────────────


@router.get("/profile", response_model=StudentProfileResponse)
async def get_student_profile(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> StudentProfileResponse:
    """Return the authenticated student's full profile with aggregated stats."""
    from sqlalchemy import func

    profile = await _get_student_profile(student.id, db)

    # Aggregate submissions stats
    stats_result = await db.execute(
        select(
            func.avg(Submission.score),
            func.count(Submission.id),
            func.max(Submission.created_at),
        ).where(
            Submission.student_id == student.id,
            Submission.score.isnot(None),
        )
    )
    avg_score, total_subs, last_activity = stats_result.one()

    # Count TPs with score >= 50
    completed_result = await db.execute(
        select(func.count(Submission.id)).where(
            Submission.student_id == student.id,
            Submission.score >= 50,
        )
    )
    tps_completes = completed_result.scalar() or 0

    return StudentProfileResponse(
        id=student.id,
        first_name=student.first_name,
        last_name=student.last_name,
        email=student.email,
        formation=student.formation,
        filiere=student.filiere,
        year_of_study=student.year_of_study,
        niveau=profile.niveau,
        concepts_maitrises=list(profile.concepts_maitrises or []),
        points_faibles=list(profile.points_faibles or []),
        score_moyen=round(float(avg_score), 1) if avg_score else None,
        tps_completes=tps_completes,
        derniere_activite=last_activity,
    )


# ── GET /student/tp/{tp_id} ───────────────────────────────────────────────────


@router.get("/tp/{tp_id}/detail", response_model=TPDetailResponse)
async def get_tp_detail(
    tp_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> TPDetailResponse:
    """Return the full details of a generated TP (for session page)."""
    tp: GeneratedTPModel | None = await db.get(GeneratedTPModel, tp_id)
    if not tp or tp.student_id != student.id:
        raise NotFoundException("TP introuvable")

    # Fetch topic title
    topic_title: str | None = None
    if tp.topic_id:
        topic: Topic | None = await db.get(Topic, tp.topic_id)
        if topic:
            topic_title = topic.title

    return TPDetailResponse(
        tp_id=tp.id,
        enonce=tp.enonce,
        starter_code=tp.starter_code,
        tests_count=len(tp.tests_unitaires or []),
        topic_id=tp.topic_id,
        topic_title=topic_title,
        created_at=tp.created_at,
    )


# ── GET /student/submissions/{submission_id} ──────────────────────────────────


@router.get("/submissions/{submission_id}")
async def get_submission_detail(
    submission_id: uuid.UUID,
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return full detail for a specific submission (for history → result navigation)."""
    sub: Submission | None = await db.get(Submission, submission_id)
    if not sub or sub.student_id != student.id:
        raise NotFoundException("Soumission introuvable")

    topic_title: str | None = None
    if sub.tp_id:
        tp: GeneratedTPModel | None = await db.get(GeneratedTPModel, sub.tp_id)
        if tp and tp.topic_id:
            topic: Topic | None = await db.get(Topic, tp.topic_id)
            if topic:
                topic_title = topic.title

    errors_data = sub.errors_json or {}

    return {
        "id": str(sub.id),
        "submission_id": str(sub.id),
        "tp_id": str(sub.tp_id) if sub.tp_id else None,
        "topic_title": topic_title,
        "score": sub.score,
        "tests_results": errors_data.get("tests_results", []),
        "errors_categorized": errors_data.get("errors_categorized", []),
        "feedback": errors_data.get("feedback", ""),
        "code_submitted": sub.code,
        "stdout": sub.stdout,
        "stderr": sub.stderr,
        "created_at": sub.created_at.isoformat(),
    }


# ── GET /student/submissions ──────────────────────────────────────────────────


@router.get("/submissions", response_model=list[SubmissionHistoryItem])
async def get_my_submissions(
    student: User = Depends(get_current_student),
    db: AsyncSession = Depends(get_db),
) -> list[SubmissionHistoryItem]:
    """Return all submissions for the authenticated student, sorted by date desc."""
    result = await db.execute(
        select(Submission)
        .where(
            Submission.student_id == student.id,
            Submission.submission_type == "submission",
        )
        .order_by(Submission.created_at.desc())
    )
    submissions = result.scalars().all()

    items: list[SubmissionHistoryItem] = []
    for sub in submissions:
        topic_title: str | None = None
        tests_passed = 0
        tests_total = 0

        if sub.tp_id:
            tp: GeneratedTPModel | None = await db.get(GeneratedTPModel, sub.tp_id)
            if tp and tp.topic_id:
                topic: Topic | None = await db.get(Topic, tp.topic_id)
                if topic:
                    topic_title = topic.title

        errors_data = sub.errors_json or {}
        tests_results = errors_data.get("tests_results", [])
        if isinstance(tests_results, list):
            tests_total = len(tests_results)
            tests_passed = sum(1 for t in tests_results if t.get("passed") is True)

        items.append(
            SubmissionHistoryItem(
                id=sub.id,
                tp_id=sub.tp_id,
                topic_title=topic_title,
                score=sub.score,
                created_at=sub.created_at,
                tests_passed=tests_passed,
                tests_total=tests_total,
                submission_type=sub.submission_type,
            )
        )

    return items
