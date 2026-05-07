"""Evaluator Agent — scores code submissions and classifies errors."""

import json
import re

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

        enonce = state.get("generated_enonce") or ""
        stdout = state.get("stdout") or ""
        strict = self._is_strict_mode(enonce)

        # Deterministic test evaluation before LLM call
        raw_tests = state.get("generated_tests") or []
        precomputed_tests: list[dict] = []
        for t in raw_tests:
            expected = t.get("expected_output", "")
            passed = self._outputs_match(actual=stdout, expected=expected, strict_mode=strict)
            precomputed_tests.append({
                "description": t.get("description", ""),
                "passed": passed,
                "actual": stdout[:200],
                "expected": expected,
            })

        tests_passed = sum(1 for t in precomputed_tests if t["passed"])
        tests_total = len(precomputed_tests)

        system_prompt = SYSTEM_EVALUATOR.format(
            student_level=state.get("student_level", 1),
            enonce=enonce or "Voir description du TP.",
            code=state.get("code_submitted") or "",
            stdout=stdout,
            stderr=state.get("stderr") or "",
            exit_code=state.get("exit_code", -1),
            tests=json.dumps(precomputed_tests if precomputed_tests else raw_tests, ensure_ascii=False),
        )

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=(
                "Évalue la qualité du code. "
                "Les résultats des tests sont déjà calculés dans le JSON ci-dessus — "
                "utilise-les directement sans les modifier."
            )),
        ]
        response = await self._llm.ainvoke(messages)
        content = response.content if hasattr(response, "content") else str(response)
        parsed = _parse_json(content, _DEFAULT_EVAL)

        # Override error type with deterministic pre-classification if Unknown
        errors = parsed.get("errors_categorized", [])
        if not errors and pre_class != "Unknown":
            errors = [{"type": pre_class, "description": state.get("stderr", ""), "line": None}]

        if precomputed_tests:
            # 40% from deterministic test results + 60% code quality from LLM
            test_score = round((tests_passed / tests_total) * 40) if tests_total > 0 else 20
            llm_score = max(0, min(100, int(parsed.get("score", 50))))
            code_quality = max(0, min(60, round(llm_score * 0.6)))
            score = min(100, test_score + code_quality)
            final_tests = precomputed_tests
        else:
            score = max(0, min(100, int(parsed.get("score", 50))))
            final_tests = parsed.get("tests_results", [])

        return {
            "score": score,
            "tests_results": final_tests,
            "errors_categorized": errors,
            "agent_response": parsed.get("feedback_general", ""),
            "current_agent": "evaluator",
        }

    @staticmethod
    def _outputs_match(actual: str, expected: str, strict_mode: bool = False) -> bool:
        """Compare actual stdout against expected output with intelligent normalization."""
        if not actual and not expected:
            return True
        if not actual or not expected:
            return False

        actual_clean = actual.strip()
        expected_clean = expected.strip()

        if actual_clean.lower() == expected_clean.lower():
            return True

        if strict_mode:
            return False

        def normalize(s: str) -> str:
            s = s.lower().strip()
            s = re.sub(r'[\s!?.,:;]+$', '', s)
            s = re.sub(r'\s+', ' ', s)
            return s

        actual_norm = normalize(actual_clean)
        expected_norm = normalize(expected_clean)

        if actual_norm == expected_norm:
            return True

        if len(expected_norm) <= 30:
            return expected_norm in actual_norm

        if len(actual_norm) <= 30:
            return actual_norm in expected_norm

        return False

    @staticmethod
    def _is_strict_mode(enonce: str) -> bool:
        """Detect if the TP statement explicitly requires exact output format."""
        if not enonce:
            return False
        strict_keywords = [
            "affiche exactement",
            "sortie exacte",
            "format attendu",
            "doit afficher exactement",
            "la sortie doit être",
            "respecte le format",
            "output exact",
        ]
        enonce_lower = enonce.lower()
        return any(kw in enonce_lower for kw in strict_keywords)

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
