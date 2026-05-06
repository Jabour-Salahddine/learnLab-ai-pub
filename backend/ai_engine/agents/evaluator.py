"""Evaluator Agent — scores code submissions and classifies errors."""

import json

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from ai_engine.agents.tutor import _parse_json
from ai_engine.prompts.evaluator_prompts import SYSTEM_EVALUATOR
from ai_engine.state import AgentState

logger = structlog.get_logger(__name__)

_DEFAULT_EVAL = {
    "score": 50,
    "tests_results": [],
    "errors_categorized": [],
    "feedback_general": "Bonne tentative — continuez à améliorer votre solution.",
    "points_positifs": ["Le code s'exécute sans erreur fatale."],
    "points_ameliorer": ["Vérifiez la logique de votre algorithme."],
}


class EvaluatorAgent:
    def __init__(self, llm) -> None:
        self._llm = llm

    async def evaluate(self, state: AgentState) -> dict:
        """Score the submitted code and return detailed feedback."""
        pre_class = self._detect_error_type(
            state.get("stderr", ""), state.get("exit_code")
        )

        system_prompt = SYSTEM_EVALUATOR.format(
            student_level=state.get("student_level", 1),
            enonce=state.get("generated_enonce") or "Voir description du TP.",
            code=state.get("code_submitted") or "",
            stdout=state.get("stdout") or "",
            stderr=state.get("stderr") or "",
            exit_code=state.get("exit_code", -1),
            tests=json.dumps(state.get("generated_tests") or [], ensure_ascii=False),
        )

        messages = [SystemMessage(content=system_prompt), HumanMessage(content="Évalue le code.")]
        response = await self._llm.ainvoke(messages)
        content = response.content if hasattr(response, "content") else str(response)
        parsed = _parse_json(content, _DEFAULT_EVAL)

        # Override error type with deterministic pre-classification if Unknown
        errors = parsed.get("errors_categorized", [])
        if not errors and pre_class != "Unknown":
            errors = [{"type": pre_class, "description": state.get("stderr", ""), "line": None}]

        score = max(0, min(100, int(parsed.get("score", 50))))

        return {
            "score": score,
            "tests_results": parsed.get("tests_results", []),
            "errors_categorized": errors,
            "agent_response": parsed.get("feedback_general", ""),
            "current_agent": "evaluator",
        }

    @staticmethod
    def _compare_output_flexible(actual: str, expected: str) -> bool:
        """Intelligent comparison: if expected is short (≤30 chars), check containment."""
        actual_clean = actual.strip().lower()
        expected_clean = expected.strip().lower()
        if actual_clean == expected_clean:
            return True
        if len(expected_clean) <= 30:
            return expected_clean in actual_clean
        return False

    @staticmethod
    def _detect_error_type(stderr: str, exit_code: int | None) -> str:
        stderr = stderr or ""
        if "SyntaxError" in stderr or "IndentationError" in stderr:
            return "SyntaxError"
        if "NameError" in stderr or "TypeError" in stderr or "AttributeError" in stderr:
            return "LogicError"
        if exit_code and exit_code != 0 and not stderr:
            return "LogicError"
        return "Unknown"
