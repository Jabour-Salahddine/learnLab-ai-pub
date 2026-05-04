"""Explainer Agent — answers conceptual questions from students."""

import structlog
from langchain_core.messages import HumanMessage, SystemMessage

from ai_engine.agents.tutor import _detect_language
from ai_engine.prompts.explainer_prompts import SYSTEM_EXPLAINER
from ai_engine.state import AgentState
from rag_pipeline.retriever import RAGRetriever

logger = structlog.get_logger(__name__)


class ExplainerAgent:
    def __init__(self, llm, retriever: RAGRetriever) -> None:
        self._llm = llm
        self._retriever = retriever

    async def explain(self, state: AgentState) -> dict:
        """Generate a pedagogical explanation for the student's question."""
        question = state.get("current_question") or ""
        chunks = await self._retriever.search(
            query=question,
            teacher_id=state["teacher_id"],
            topic_id=state.get("topic_id"),
            top_k=5,
        )
        rag_context = self._retriever.format_context(chunks)

        system_prompt = SYSTEM_EXPLAINER.format(
            student_level=state.get("student_level", 1),
            question=question,
            rag_context=rag_context,
            topic_title=state.get("topic_title") or "Non spécifié",
            tp_enonce=state.get("generated_enonce") or "Énoncé non disponible",
            tp_langage=_detect_language(state),
        )

        messages = [SystemMessage(content=system_prompt), HumanMessage(content=question)]
        response = await self._llm.ainvoke(messages)
        answer = response.content if hasattr(response, "content") else str(response)

        new_history = list(state.get("chat_history", []))
        new_history.append({"role": "user", "content": question})
        new_history.append({"role": "assistant", "content": answer, "agent": "explainer"})

        return {
            "agent_response": answer,
            "chat_history": new_history,
            "current_agent": "explainer",
            "rag_chunks": [c.text for c in chunks],
        }
