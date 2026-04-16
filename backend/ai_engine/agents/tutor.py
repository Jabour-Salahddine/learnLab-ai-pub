"""Tutor Agent — generates TPs and delivers progressive hints."""

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from ai_engine.prompts.tutor_prompts import SYSTEM_TUTOR_GENERATE, SYSTEM_TUTOR_HINT
from ai_engine.state import AgentState
from app.config import settings
from app.redis_client import get_redis
from rag_pipeline.retriever import RAGRetriever

logger = structlog.get_logger(__name__)

_HINT_KEY_TPL = "hint:{student_id}:{tp_id}"


def _hint_key(student_id: str, tp_id: str) -> str:
    return _HINT_KEY_TPL.format(student_id=student_id, tp_id=tp_id or "none")


class TutorAgent:
    def __init__(self, llm, retriever: RAGRetriever) -> None:
        self._llm = llm
        self._retriever = retriever

    # ── Generate TP ───────────────────────────────────────────────────────────

    async def generate_tp(self, state: AgentState) -> dict:
        """Generate a personalised TP statement for the student."""
        chunks = await self._retriever.search(
            query=f"{state.get('topic_title', '')} {state.get('topic_description', '')} exercice pratique",
            teacher_id=state["teacher_id"],
            topic_id=state.get("topic_id"),
            top_k=5,
        )
        rag_context = self._retriever.format_context(chunks)

        system_prompt = SYSTEM_TUTOR_GENERATE.format(
            student_level=state.get("student_level", 1),
            concepts_maitrisés=", ".join(state.get("student_concepts_maitrisés", [])) or "aucun",
            weak_points=", ".join(state.get("student_weak_points", [])) or "aucun",
            topic_title=state.get("topic_title", ""),
            topic_description=state.get("topic_description", ""),
            rag_context=rag_context,
        )

        messages = [SystemMessage(content=system_prompt), HumanMessage(content="Génère le TP.")]
        response = await self._llm.ainvoke(messages)
        content = response.content if hasattr(response, "content") else str(response)

        parsed = _parse_json(content, _DEFAULT_TP)

        return {
            "generated_enonce": parsed.get("enonce", ""),
            "generated_starter_code": parsed.get("starter_code", ""),
            "generated_tests": parsed.get("tests_unitaires", []),
            "generated_hints": parsed.get("hints", {}),
            "current_agent": "tutor",
            "rag_chunks": [c.text for c in chunks],
        }

    # ── Give hint ─────────────────────────────────────────────────────────────

    async def give_hint(self, state: AgentState) -> dict:
        """Return the next progressive hint for the current TP session."""
        redis = await get_redis()
        key = _hint_key(state["student_id"], state.get("tp_id", "none"))
        raw_level = await redis.get(key)
        current_level = int(raw_level) if raw_level else 0
        new_level = min(current_level + 1, 3)

        # Fetch contextual chunks based on the error type
        error_type = _detect_error_type(state.get("stderr", ""), state.get("exit_code"))
        chunks = await self._retriever.search(
            query=f"comment corriger {error_type} Python",
            teacher_id=state["teacher_id"],
            topic_id=state.get("topic_id"),
            top_k=3,
        )
        rag_context = self._retriever.format_context(chunks)

        system_prompt = SYSTEM_TUTOR_HINT.format(
            hint_level=new_level,
            code=state.get("code_submitted") or "",
            error_type=error_type,
            stderr=state.get("stderr") or "Aucune erreur explicite",
            rag_context=rag_context,
        )

        messages = [SystemMessage(content=system_prompt), HumanMessage(content="Donne le hint.")]
        response = await self._llm.ainvoke(messages)
        hint_text = response.content if hasattr(response, "content") else str(response)

        # Persist new level in Redis (TTL 24h)
        await redis.set(key, str(new_level), ex=86400)

        return {
            "hint_level": new_level,
            "agent_response": hint_text,
            "current_agent": "tutor_hint",
        }


# ── Helpers ───────────────────────────────────────────────────────────────────

_DEFAULT_TP = {
    "enonce": "Implémentez la fonction demandée selon les spécifications fournies.",
    "starter_code": "def solution():\n    # TODO: à implémenter\n    pass",
    "tests_unitaires": [
        {"description": "Test de base", "input": "", "expected_output": ""},
    ],
    "hints": {
        "1": "Réfléchissez à l'approche générale de l'algorithme.",
        "2": "Regardez la structure de votre boucle principale.",
        "3": "# Pseudo-code:\n# Pour chaque élément...\n#   Si condition...",
    },
    "solution_modele": "# Solution disponible après évaluation.",
}


def _parse_json(text: str, default: dict) -> dict:
    """Extract the first JSON object from *text*, returning *default* on failure."""
    # Find JSON block (the LLM sometimes wraps it in ```json ... ```)
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass
    logger.warning("json_parse_failed", text=text[:200])
    return default


def _detect_error_type(stderr: str, exit_code: int | None) -> str:
    """Deterministic error classification before the LLM."""
    stderr = stderr or ""
    if "SyntaxError" in stderr or "IndentationError" in stderr:
        return "SyntaxError"
    if "NameError" in stderr or "TypeError" in stderr:
        return "LogicError"
    if exit_code and exit_code != 0 and not stderr:
        return "LogicError"
    return "Unknown"
