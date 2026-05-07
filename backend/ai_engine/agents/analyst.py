"""Analyst Agent — updates student profiles and generates weekly reports."""

from datetime import datetime, timedelta, timezone

import structlog
from langchain_core.messages import HumanMessage
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

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

        # Fetch last 10 final submissions (scored) for this student/teacher pair
        result = await self._db.execute(
            select(Submission)
            .where(
                Submission.student_id == student_id,
                Submission.teacher_id == teacher_id,
                Submission.submission_type == "submission",
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

        # Final submissions only (scored evaluations)
        final_result = await db.execute(
            select(Submission)
            .where(
                Submission.student_id == s_id,
                Submission.teacher_id == t_id,
                Submission.submission_type == "submission",
            )
            .order_by(Submission.created_at.desc())
            .limit(15)
        )
        final_submissions = final_result.scalars().all()

        # Execution attempts (engagement indicator — not failures)
        exec_count_result = await db.execute(
            select(func.count(Submission.id))
            .where(
                Submission.student_id == s_id,
                Submission.teacher_id == t_id,
                Submission.submission_type == "execution",
            )
        )
        exec_count = exec_count_result.scalar() or 0

        scores = [s.score for s in final_submissions if s.score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        max_score = max(scores) if scores else None

        progression = ""
        if len(scores) >= 2:
            diff = scores[0] - scores[-1]
            if diff > 0:
                progression = f"Progression : +{diff} pts"
            elif diff < 0:
                progression = f"Régression : {diff} pts"
            else:
                progression = "Score stable"
        elif len(scores) == 1:
            progression = "Première évaluation"

        error_counts: dict[str, int] = {}
        for sub in final_submissions:
            for err in (sub.errors_json or {}).get("errors_categorized", []):
                t = err.get("type", "Unknown")
                error_counts[t] = error_counts.get(t, 0) + 1

        error_types = ", ".join(
            f"{k} ({v}x)"
            for k, v in sorted(error_counts.items(), key=lambda x: -x[1])
        ) or "Aucune erreur détectée"

        def build_context(submissions: list) -> str:
            if not submissions:
                return "Aucune soumission finale sur la période."
            lines = []
            for i, s in enumerate(submissions, 1):
                errors = s.errors_json or {}
                errors_cat = errors.get("errors_categorized", [])
                tests = errors.get("tests_results", [])
                feedback = errors.get("feedback_general", "")
                passed = sum(1 for t in tests if t.get("passed"))
                total = len(tests)
                error_descs = [e.get("description", "") for e in errors_cat]
                code_preview = s.code[:400].replace("\n", " | ") if s.code else ""
                lines.append(
                    f"Soumission {i} — {s.created_at.date()}\n"
                    f"  Score : {s.score}/100\n"
                    f"  Tests : {passed}/{total} passés\n"
                    f"  Erreurs : {' | '.join(error_descs) or 'Aucune'}\n"
                    f"  Feedback : {feedback[:200]}\n"
                    f"  Code (extrait) : {code_preview}\n"
                    f"  Stderr : {(s.stderr or '')[:150]}\n"
                )
            return "\n".join(lines)

        sub_context = build_context(final_submissions)

        profile_res = await db.execute(
            select(StudentProfile).where(StudentProfile.student_id == s_id)
        )
        profile = profile_res.scalar_one_or_none()
        niveau = profile.niveau if profile else 1
        points_faibles = profile.points_faibles if profile else []
        concepts = profile.concepts_maitrises if profile else []

        student_res = await db.execute(select(User).where(User.id == s_id))
        student = student_res.scalar_one_or_none()
        student_name = (
            f"{student.first_name} {student.last_name}" if student else student_id
        )

        prompt = f"""Tu es un analyste pédagogique expert
en informatique et en pédagogie.

Génère un bilan pédagogique détaillé et UTILE
pour l'étudiant {student_name}.
Période : {period_start} → {period_end}

━━ COMPRENDRE LES DONNÉES ━━

Deux types de soumissions existent dans le système :
- Soumissions finales (avec score) → BASE DE TON ANALYSE
- Tentatives d'exécution (sans score) → signe POSITIF
  d'engagement. Ne jamais interpréter comme un échec
  ou un travail non rendu.

━━ PROFIL ACTUEL ━━
Niveau : {niveau}/5
Score moyen : {f"{avg_score}/100" if avg_score else "Pas encore évalué"}
Score maximum : {f"{max_score}/100" if max_score else "—"}
Progression : {progression}
Points faibles identifiés : {", ".join(points_faibles) if points_faibles else "Non encore détectés"}
Concepts maîtrisés : {", ".join(concepts) if concepts else "Non encore détectés"}
Tentatives d'exécution : {exec_count} (engagement positif)
Erreurs récurrentes : {error_types}

━━ SOUMISSIONS FINALES DÉTAILLÉES ━━
{sub_context}

━━ INSTRUCTIONS D'ANALYSE ━━

Analyse le CODE SOUMIS et les ERREURS RÉELLES.
Sois concret et utile pour l'enseignant.

IMPORTANT — Différences mineures de format :
Si l'étudiant retourne "Woof!" au lieu de "Wouf",
ou "Miaou!" au lieu de "Miaou", NE le signale PAS
comme une difficulté ou un point faible.
Ce sont des différences cosmétiques sans importance
pédagogique. Concentre-toi sur la LOGIQUE du code,
la STRUCTURE, et la compréhension des CONCEPTS.

Génère un rapport structuré :

1. RÉSUMÉ DE PROGRESSION (2-3 phrases) :
   Score moyen, progression, engagement.
   Mentionne positivement les tentatives d'exécution.

2. POINTS FORTS (bullet points) :
   Ce que l'étudiant maîtrise bien.
   Cite des éléments concrets du code soumis.

3. DIFFICULTÉS RÉELLES (bullet points) :
   Uniquement des problèmes de LOGIQUE ou CONCEPT.
   Jamais des différences de format de sortie.
   Pour chaque difficulté : cite un exemple du code.

4. RECOMMANDATIONS POUR L'ENSEIGNANT (2-3 actions) :
   Concrètes et réalisables.
   Basées sur les vraies lacunes observées.

5. OBJECTIFS POUR LA PROCHAINE PÉRIODE :
   2-3 objectifs SMART basés sur les lacunes réelles.

Règles :
- Maximum 600 mots en français
- Chaque phrase doit apporter une info utile
- Pas de généralités comme "l'étudiant a des difficultés"
- Cite toujours des éléments concrets du code"""

        messages = [HumanMessage(content=prompt)]
        response = await self._llm.ainvoke(messages)
        report_content = (
            response.content if hasattr(response, "content") else str(response)
        )

        report = Report(
            student_id=s_id,
            teacher_id=t_id,
            period_start=period_start,
            period_end=period_end,
            content=report_content,
            metrics_json={
                "avg_score": avg_score,
                "max_score": max_score,
                "submissions_count": len(final_submissions),
                "exec_count": exec_count,
                "error_counts": error_counts,
                "niveau": niveau,
                "progression": progression,
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
