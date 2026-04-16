"""LangGraph orchestrator — routes between agents based on AgentState.action."""

import structlog
from langgraph.graph import END, StateGraph

from ai_engine.agents.analyst import AnalystAgent
from ai_engine.agents.evaluator import EvaluatorAgent
from ai_engine.agents.explainer import ExplainerAgent
from ai_engine.agents.tutor import TutorAgent
from ai_engine.state import AgentState
from rag_pipeline.retriever import RAGRetriever

logger = structlog.get_logger(__name__)


# ── Router node ────────────────────────────────────────────────────────────────


def _route(state: AgentState) -> str:
    """Dispatch to the correct agent based on state['action']."""
    action = state.get("action", "answer_question")
    routing = {
        "generate_tp": "tutor_generate",
        "answer_question": "explainer",
        "evaluate": "evaluator",
        "hint": "tutor_hint",
        "analyze": "analyst",
    }
    target = routing.get(action, "explainer")
    logger.info("graph_routing", action=action, target=target)
    return target


def _route_after_eval(state: AgentState) -> str:
    """After evaluation, route to hint if score < 70, else to analyst."""
    score = state.get("score") or 0
    if score < 70:
        return "tutor_hint"
    return "analyst"


# ── Graph factory ──────────────────────────────────────────────────────────────


def create_graph(llm, retriever: RAGRetriever, db):
    """Build and compile the LearnLab multi-agent LangGraph."""
    tutor = TutorAgent(llm, retriever)
    evaluator = EvaluatorAgent(llm)
    explainer = ExplainerAgent(llm, retriever)
    analyst = AnalystAgent(llm, db)

    workflow = StateGraph(AgentState)

    # ── Nodes ──────────────────────────────────────────────────────────────────
    workflow.add_node("router", lambda s: s)          # pass-through routing node
    workflow.add_node("tutor_generate", tutor.generate_tp)
    workflow.add_node("tutor_hint", tutor.give_hint)
    workflow.add_node("evaluator", evaluator.evaluate)
    workflow.add_node("explainer", explainer.explain)
    workflow.add_node("analyst", analyst.update_profile)

    # ── Entry point ────────────────────────────────────────────────────────────
    workflow.set_entry_point("router")

    # ── Router → agent ─────────────────────────────────────────────────────────
    workflow.add_conditional_edges(
        "router",
        _route,
        {
            "tutor_generate": "tutor_generate",
            "tutor_hint": "tutor_hint",
            "evaluator": "evaluator",
            "explainer": "explainer",
            "analyst": "analyst",
        },
    )

    # ── After evaluation: conditional ──────────────────────────────────────────
    workflow.add_conditional_edges(
        "evaluator",
        _route_after_eval,
        {
            "tutor_hint": "tutor_hint",
            "analyst": "analyst",
        },
    )

    # ── Terminal edges ─────────────────────────────────────────────────────────
    workflow.add_edge("tutor_generate", END)
    workflow.add_edge("tutor_hint", END)
    workflow.add_edge("explainer", END)
    workflow.add_edge("analyst", END)

    return workflow.compile()
