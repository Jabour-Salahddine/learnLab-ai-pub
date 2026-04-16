"""Shared state passed between all LangGraph nodes."""

from typing import Optional
from typing_extensions import TypedDict


class AgentState(TypedDict):
    # Identifiers
    student_id: str
    teacher_id: str
    tp_id: Optional[str]
    session_id: str

    # TP context
    topic_id: Optional[str]
    topic_title: Optional[str]
    topic_description: Optional[str]
    student_level: int               # 1-5
    student_weak_points: list[str]
    student_concepts_maitrisés: list[str]

    # Submitted code
    code_submitted: Optional[str]
    stdout: Optional[str]
    stderr: Optional[str]
    exit_code: Optional[int]

    # Agent outputs
    generated_enonce: Optional[str]
    generated_starter_code: Optional[str]
    generated_tests: Optional[list[dict]]
    generated_hints: Optional[dict]   # {"1": hint1, "2": hint2, "3": hint3}
    score: Optional[int]
    errors_categorized: Optional[list[dict]]
    tests_results: Optional[list[dict]]

    # RAG context
    rag_chunks: Optional[list[str]]

    # Chat
    chat_history: list[dict]          # [{"role": "user"|"assistant", "content": "..."}]
    current_question: Optional[str]
    agent_response: Optional[str]

    # Flow control
    current_agent: Optional[str]
    hint_level: int                   # 1, 2, or 3
    action: str   # "generate_tp" | "answer_question" | "evaluate" | "hint" | "analyze"
    error_message: Optional[str]
