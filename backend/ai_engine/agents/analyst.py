"""Analyst Agent — updates student profiles and generates weekly reports."""

import json
from datetime import date, datetime, timedelta, timezone

import structlog
from langchain_core.messages import HumanMessage, SystemMessage
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ai_engine.prompts.explainer_prompts import SYSTEM_ANALYST_REPORT
from ai_engine.state import AgentState
from app.models.report import Report
from app.models.student_profile import StudentProfile
from app.models.submission import Submission
from app.models.user import User

logger = structlog.get_logger(__name__)


class AnalystAgent:
    def __init__(self, llm, db: AsyncSession) -> None:
        self._llm = llm
        self._db = db

    async def update_profile(self, state: AgentState) -> dict:
        """Recalculate student level and weak points from last 10 submissions."""
        import uuid

        student_id = uuid.UUID(state["student_id"])
        teacher_id = uuid.UUID(state["teacher_id"])

        # Fetch last 10 submissions for this student/teacher pair
        result = await self._db.execute(
            select(Submission)
            .where(
                Submission.student_id == student_id,
                Submission.teacher_id == teacher_id,
            )
            .order_by(Submission.created_at.desc())
            .limit(10)
        )
        submissions = result.scalars().all()

        if not submissions:
            return {"current_agent": "analyst"}

        scores = [s.score for s in submissions if s.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0

        # Count recurring error types
        error_counts: dict[str, int] = {}
        for sub in submissions:
            for err in (sub.errors_json or {}).get("errors_categorized", []):
                t = err.get("type", "Unknown")
                error_counts[t] = error_counts.get(t, 0) + 1

        recurring_errors = [k for k, v in error_counts.items() if v >= 3]

        # Update profile
        profile_result = await self._db.execute(
            select(StudentProfile).where(StudentProfile.student_id == student_id)
        )
        profile: StudentProfile | None = profile_result.scalar_one_or_none()

        if profile:
            if avg_score > 80 and profile.niveau < 5:
                profile.niveau += 1
            elif avg_score < 40 and profile.niveau > 1:
                profile.niveau -= 1
            profile.points_faibles = recurring_errors
            profile.updated_at = datetime.now(timezone.utc)
            await self._db.commit()
            logger.info(
                "student_profile_updated",
                student_id=str(student_id),
                niveau=profile.niveau,
                avg_score=avg_score,
            )

        return {"current_agent": "analyst"}

    async def generate_report(
        self,
        student_id: str,
        teacher_id: str,
        db: AsyncSession,
    ) -> str:
        """Generate a weekly pedagogical report and persist it."""
        import uuid

        s_id = uuid.UUID(student_id)
        t_id = uuid.UUID(teacher_id)
        now = datetime.now(timezone.utc)
        period_start = (now - timedelta(days=7)).date()
        period_end = now.date()

        # Fetch submissions for the week
        result = await db.execute(
            select(Submission)
            .where(
                Submission.student_id == s_id,
                Submission.teacher_id == t_id,
                Submission.created_at >= datetime.combine(period_start, datetime.min.time()),
            )
        )
        submissions = result.scalars().all()

        scores = [s.score for s in submissions if s.score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        max_score = max(scores) if scores else 0

        error_counts: dict[str, int] = {}
        for sub in submissions:
            for err in (sub.errors_json or {}).get("errors_categorized", []):
                t = err.get("type", "Unknown")
                error_counts[t] = error_counts.get(t, 0) + 1
        error_types = ", ".join(
            f"{k} ({v})" for k, v in sorted(error_counts.items(), key=lambda x: -x[1])
        ) or "Aucune"

        # Load student profile
        profile_res = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == s_id)
        )
        profile = profile_res.scalar_one_or_none()
        niveau = profile.niveau if profile else 1

        student_res = await db.execute(select(User).where(User.id == s_id))
        student = student_res.scalar_one_or_none()
        student_name = f"{student.first_name} {student.last_name}" if student else student_id

        system_prompt = SYSTEM_ANALYST_REPORT.format(
            student_name=student_name,
            period_start=period_start.isoformat(),
            period_end=period_end.isoformat(),
            submissions_count=len(submissions),
            avg_score=avg_score,
            max_score=max_score,
            error_types=error_types,
            niveau=niveau,
            scores_history=str(scores[-10:]),
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content="Génère le rapport."),
        ]
        response = await self._llm.ainvoke(messages)
        report_content = response.content if hasattr(response, "content") else str(response)

        # Persist report
        report = Report(
            student_id=s_id,
            teacher_id=t_id,
            period_start=period_start,
            period_end=period_end,
            content=report_content,
            metrics_json={
                "avg_score": avg_score,
                "max_score": max_score,
                "submissions_count": len(submissions),
                "error_counts": error_counts,
                "niveau": niveau,
            },
        )
        db.add(report)
        await db.commit()

        logger.info(
            "report_generated",
            student_id=student_id,
            teacher_id=teacher_id,
            period=f"{period_start}/{period_end}",
        )
        return report_content
