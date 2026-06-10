"""LLM factory — returns either a real ChatOpenAI or a deterministic mock."""

import asyncio
import json
from typing import Any, AsyncIterator, Iterator, Optional

import structlog
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage, AIMessageChunk, BaseMessage
from langchain_core.outputs import ChatGeneration, ChatResult

from app.config import settings

logger = structlog.get_logger(__name__)

# ── Mock responses ─────────────────────────────────────────────────────────────

_MOCK_TP = json.dumps(
    {
        "enonce": (
            "## TP : Implémentation du Tri Rapide (Quicksort)\n\n"
            "Implémentez l'algorithme de tri rapide en Python.\n\n"
            "### Consignes\n"
            "1. Choisissez un pivot (premier élément)\n"
            "2. Partitionnez la liste en deux sous-listes\n"
            "3. Appliquez récursivement l'algorithme\n\n"
            "### Contraintes\n- Ne pas utiliser `sorted()` ou `list.sort()`"
        ),
        "starter_code": (
            "def quicksort(arr: list) -> list:\n"
            "    \"\"\"\n"
            "    Tri une liste par l'algorithme quicksort.\n"
            "    Args:\n        arr: Liste à trier\n"
            "    Returns:\n        Liste triée\n"
            "    \"\"\"\n"
            "    # TODO: Cas de base\n"
            "    # TODO: Choisir le pivot\n"
            "    # TODO: Partitionner\n"
            "    # TODO: Appel récursif\n"
            "    pass\n"
        ),
        "tests_unitaires": [
            {"description": "Liste vide", "input": "[]", "expected_output": "[]"},
            {"description": "Liste triée", "input": "[1, 2, 3]", "expected_output": "[1, 2, 3]"},
            {"description": "Liste inversée", "input": "[5, 3, 1, 4, 2]", "expected_output": "[1, 2, 3, 4, 5]"},
        ],
        "hints": {
            "1": "Réfléchissez au principe 'diviser pour régner' : comment décomposer le problème en sous-problèmes plus simples ?",
            "2": "Le cas de base de la récursion est une liste de 0 ou 1 élément. Regardez votre condition d'arrêt.",
            "3": "# Pseudo-code :\n# si len(arr) <= 1 : retourner arr\n# pivot = arr[0]\n# gauche = [x for x in arr[1:] if x <= pivot]\n# droite = [x for x in arr[1:] if x > pivot]",
        },
        "solution_modele": (
            "def quicksort(arr):\n"
            "    if len(arr) <= 1:\n        return arr\n"
            "    pivot = arr[0]\n"
            "    left = [x for x in arr[1:] if x <= pivot]\n"
            "    right = [x for x in arr[1:] if x > pivot]\n"
            "    return quicksort(left) + [pivot] + quicksort(right)\n"
        ),
    },
    ensure_ascii=False,
)

_MOCK_EVAL = json.dumps(
    {
        "score": 75,
        "tests_results": [
            {"description": "Liste vide", "passed": True, "actual": "[]", "expected": "[]"},
            {"description": "Liste triée", "passed": True, "actual": "[1, 2, 3]", "expected": "[1, 2, 3]"},
            {"description": "Liste inversée", "passed": False, "actual": "[1, 5, 3]", "expected": "[1, 2, 3, 4, 5]"},
        ],
        "errors_categorized": [
            {"type": "LogicError", "description": "La partition n'est pas correcte pour les doublons.", "line": None}
        ],
        "feedback_general": "Bon début ! Votre structure générale est correcte, mais la partition doit être affinée.",
        "points_positifs": ["Cas de base correct", "Récursion en place"],
        "points_ameliorer": ["Vérifiez la condition de partition pour les doublons"],
    },
    ensure_ascii=False,
)

_MOCK_HINT = "Réfléchissez à ce qui se passe quand votre liste contient des doublons — votre pivot les place-t-il du bon côté ?"

_MOCK_EXPLAIN = (
    "Quicksort est un algorithme de tri 'diviser pour régner'.\n\n"
    "**Exemple :**\n```python\n"
    "def quicksort(arr):\n"
    "    if len(arr) <= 1:\n        return arr  # cas de base\n"
    "    pivot = arr[0]\n"
    "    left = [x for x in arr[1:] if x <= pivot]\n"
    "    right = [x for x in arr[1:] if x > pivot]\n"
    "    return quicksort(left) + [pivot] + quicksort(right)\n"
    "```\n\n"
    "Comprenez-vous maintenant pourquoi on sépare la liste autour du pivot ?"
)

_MOCK_REPORT = (
    "## Rapport hebdomadaire\n\n"
    "**Résumé :** L'étudiant a progressé cette semaine avec plusieurs soumissions.\n\n"
    "**Points forts :**\n- Bonne compréhension des bases\n- Code lisible\n\n"
    "**Points à améliorer :**\n- Gestion des cas limites\n- Optimisation algorithmique\n\n"
    "**Recommandations :**\n1. Proposer des exercices sur la récursion\n2. Revoir les structures de données\n\n"
    "**Prévision :** Bon potentiel d'amélioration avec un travail ciblé."
)


def _detect_mock_type(system_content: str) -> str:
    lc = system_content.lower()
    if "générer un tp" in lc or "starter_code" in lc or "tests_unitaires" in lc:
        return "tp"
    if "évaluateur" in lc or "score sur 100" in lc or "exit_code" in lc:
        return "eval"
    if "hint" in lc or "niveau d'aide" in lc or "tuteur" in lc:
        return "hint"
    if "rapport" in lc or "rapport hebdomadaire" in lc:
        return "report"
    return "explain"


class MockChatModel(BaseChatModel):
    """Deterministic mock — returns valid JSON responses without OpenAI."""

    @property
    def _llm_type(self) -> str:
        return "mock"

    def _generate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        system_content = ""
        for msg in messages:
            if hasattr(msg, "type") and msg.type == "system":
                system_content = msg.content
                break

        mock_type = _detect_mock_type(system_content)
        responses = {
            "tp": _MOCK_TP,
            "eval": _MOCK_EVAL,
            "hint": _MOCK_HINT,
            "explain": _MOCK_EXPLAIN,
            "report": _MOCK_REPORT,
        }
        content = responses.get(mock_type, _MOCK_EXPLAIN)
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=content))])

    async def _agenerate(
        self,
        messages: list[BaseMessage],
        stop: Optional[list[str]] = None,
        run_manager: Any = None,
        **kwargs: Any,
    ) -> ChatResult:
        return self._generate(messages, stop=stop, run_manager=run_manager, **kwargs)

    async def astream(self, messages: Any, **kwargs: Any):  # type: ignore[override]
        """Yield word-by-word for WebSocket streaming simulation."""
        result = self._generate(messages, **kwargs)
        content = result.generations[0].message.content
        for word in content.split():
            yield AIMessageChunk(content=word + " ")


# ── Rate limiting ──────────────────────────────────────────────────────────────

# One shared semaphore for the entire FastAPI process.
_LLM_SEMAPHORE = asyncio.Semaphore(5)


class RateLimitedLLM:
    """Wrapper around the real LLM that caps concurrent OpenAI calls.

    All attributes not defined here are delegated to the underlying LLM via
    __getattr__, preserving full LangChain compatibility (bind_tools, etc.).
    """

    def __init__(self, llm: Any) -> None:
        self._llm = llm

    async def ainvoke(self, messages: Any, **kwargs: Any) -> Any:
        async with _LLM_SEMAPHORE:
            return await self._llm.ainvoke(messages, **kwargs)

    async def astream(self, messages: Any, **kwargs: Any) -> AsyncIterator[Any]:  # type: ignore[override]
        """Hold the semaphore for the full duration of the stream."""
        async with _LLM_SEMAPHORE:
            async for chunk in self._llm.astream(messages, **kwargs):
                yield chunk

    def __getattr__(self, name: str) -> Any:
        return getattr(self._llm, name)


# ── Public factory ─────────────────────────────────────────────────────────────


def get_llm() -> RateLimitedLLM:
    """Return the appropriate LLM based on the configured API key."""
    if settings.openai_api_key.startswith("sk-placeholder"):
        logger.warning("llm_mock_mode_active")
        return RateLimitedLLM(MockChatModel())

    from langchain_openai import ChatOpenAI

    return RateLimitedLLM(
        ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0.7,
            api_key=settings.openai_api_key,
            streaming=True,
        )
    )
