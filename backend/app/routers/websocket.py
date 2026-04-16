"""WebSocket router — real-time streaming chat with AI agents."""

import json
import uuid

import structlog
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.utils.security import decode_token
from app.utils.exceptions import UnauthorizedException

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/chat/{tp_id}")
async def chat_endpoint(
    websocket: WebSocket,
    tp_id: uuid.UUID,
    token: str = Query(...),
) -> None:
    """Stream AI agent responses over WebSocket.

    Protocol:
    - Client sends : {"question": "...", "agent": "tuteur"|"explicateur"}
    - Server sends chunks: {"type": "chunk", "content": "..."}
    - Server sends done:   {"type": "done"}
    """
    await websocket.accept()

    # Authenticate via query-param token
    try:
        payload = decode_token(token)
        student_id: str = payload.get("sub", "")
        if not student_id:
            await websocket.send_text(json.dumps({"type": "error", "content": "Token invalide"}))
            await websocket.close(code=4001)
            return
    except Exception:
        await websocket.send_text(json.dumps({"type": "error", "content": "Non autorisé"}))
        await websocket.close(code=4001)
        return

    # Load session history from Redis
    from app.redis_client import get_redis

    redis = await get_redis()
    history_key = f"chat_history:{student_id}:{tp_id}"
    raw_history = await redis.get(history_key)
    chat_history: list[dict] = json.loads(raw_history) if raw_history else []

    # Load TP info from DB to get teacher_id and context
    from app.database import AsyncSessionLocal
    from app.models.tp import GeneratedTP
    from sqlalchemy import select

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(GeneratedTP).where(GeneratedTP.id == tp_id))
        tp = result.scalar_one_or_none()

    if not tp:
        await websocket.send_text(json.dumps({"type": "error", "content": "TP introuvable"}))
        await websocket.close(code=4004)
        return

    # Get the graph from app state
    from fastapi import Request

    graph = websocket.app.state.graph if hasattr(websocket.app.state, "graph") else None

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"type": "error", "content": "JSON invalide"}))
                continue

            question: str = msg.get("question", "").strip()
            agent_type: str = msg.get("agent", "explicateur")

            if not question:
                continue

            # Build AgentState
            from ai_engine.state import AgentState
            from app.database import AsyncSessionLocal
            from app.models.student_profile import StudentProfile

            async with AsyncSessionLocal() as db:
                import uuid as _uuid
                profile_res = await db.execute(
                    select(StudentProfile).where(
                        StudentProfile.student_id == _uuid.UUID(student_id)
                    )
                )
                profile = profile_res.scalar_one_or_none()

            state: AgentState = {
                "student_id": student_id,
                "teacher_id": str(tp.teacher_id),
                "tp_id": str(tp_id),
                "session_id": f"{student_id}:{tp.teacher_id}:{tp_id}",
                "topic_id": str(tp.topic_id),
                "topic_title": None,
                "topic_description": None,
                "student_level": profile.niveau if profile else 1,
                "student_weak_points": list(profile.points_faibles or []) if profile else [],
                "student_concepts_maitrisés": list(profile.concepts_maitrises or []) if profile else [],
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
                "chat_history": chat_history,
                "current_question": question,
                "agent_response": None,
                "current_agent": None,
                "hint_level": 0,
                "action": "answer_question",
                "error_message": None,
            }

            # Stream response via the explainer agent directly for low latency
            from ai_engine.llm_factory import get_llm
            from ai_engine.prompts.explainer_prompts import SYSTEM_EXPLAINER
            from rag_pipeline.retriever import RAGRetriever
            from langchain_core.messages import HumanMessage, SystemMessage

            retriever = RAGRetriever()
            chunks = await retriever.search(
                query=question,
                teacher_id=str(tp.teacher_id),
                topic_id=str(tp.topic_id),
                top_k=3,
            )
            rag_context = retriever.format_context(chunks)

            system_prompt = SYSTEM_EXPLAINER.format(
                student_level=profile.niveau if profile else 1,
                question=question,
                rag_context=rag_context,
            )

            llm = get_llm()
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=question),
            ]

            full_response = ""
            async for chunk in llm.astream(messages):
                content = chunk.content if hasattr(chunk, "content") else str(chunk)
                if content:
                    full_response += content
                    await websocket.send_text(
                        json.dumps({"type": "chunk", "content": content})
                    )

            await websocket.send_text(json.dumps({"type": "done"}))

            # Update chat history
            chat_history.append({"role": "user", "content": question})
            chat_history.append({
                "role": "assistant",
                "content": full_response,
                "agent": agent_type,
            })

            # Persist to Redis (TTL 24h) and DB
            await redis.set(history_key, json.dumps(chat_history[-20:]), ex=86400)

            async with AsyncSessionLocal() as db:
                from app.models.chat import ChatMessage
                import uuid as _uuid

                db.add(ChatMessage(
                    student_id=_uuid.UUID(student_id),
                    tp_id=tp_id,
                    teacher_id=tp.teacher_id,
                    role="user",
                    agent_type=agent_type,
                    content=question,
                ))
                db.add(ChatMessage(
                    student_id=_uuid.UUID(student_id),
                    tp_id=tp_id,
                    teacher_id=tp.teacher_id,
                    role="assistant",
                    agent_type=agent_type,
                    content=full_response,
                ))
                await db.commit()

            logger.info(
                "ws_message_processed",
                student_id=student_id,
                tp_id=str(tp_id),
                agent=agent_type,
            )

    except WebSocketDisconnect:
        logger.info("ws_disconnected", student_id=student_id, tp_id=str(tp_id))
        # Final persistence of history
        await redis.set(history_key, json.dumps(chat_history[-20:]), ex=86400)
    except Exception as exc:
        logger.error("ws_error", error=str(exc))
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(exc)}))
        except Exception:
            pass
