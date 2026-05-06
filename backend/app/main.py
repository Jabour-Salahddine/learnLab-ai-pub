"""LearnLab AI — FastAPI application entry point."""

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import auth, rag, student, teacher, websocket
from app.utils.exceptions import LearnLabException

# ── Logging setup ──────────────────────────────────────────────────────────────

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer()
        if settings.environment == "development"
        else structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(20),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)

logger = structlog.get_logger(__name__)

# ── Application ────────────────────────────────────────────────────────────────

app = FastAPI(
    title="LearnLab AI",
    description="Plateforme pédagogique intelligente de simulation de TPs",
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────

_cors_origins = settings.cors_origins + ["http://localhost:8080", "http://localhost:5173"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Exception handlers ─────────────────────────────────────────────────────────


@app.exception_handler(LearnLabException)
async def learnlab_exception_handler(request: Request, exc: LearnLabException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "type": type(exc).__name__},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_exception", error=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erreur interne du serveur", "type": "InternalServerError"},
    )


# ── Routers ────────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(teacher.router)
app.include_router(student.router)
app.include_router(rag.router)
app.include_router(websocket.router)

# ── Health check ───────────────────────────────────────────────────────────────


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "learnlab-api"}


# ── APScheduler — weekly reports ───────────────────────────────────────────────

_scheduler = AsyncIOScheduler()


async def _generate_weekly_reports() -> None:
    """Every Sunday at 18:00 — generate AI reports for active students."""
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import select

    from app.database import AsyncSessionLocal
    from app.models.submission import Submission
    from ai_engine.agents.analyst import AnalystAgent
    from ai_engine.llm_factory import get_llm

    logger.info("weekly_reports_started")
    count = 0
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    async with AsyncSessionLocal() as db:
        # Find (student_id, teacher_id) pairs with submissions this week
        result = await db.execute(
            select(Submission.student_id, Submission.teacher_id)
            .where(Submission.created_at >= week_ago)
            .distinct()
        )
        pairs = result.all()

    for student_id, teacher_id in pairs:
        try:
            async with AsyncSessionLocal() as db:
                analyst = AnalystAgent(get_llm(), db)
                await analyst.generate_report(str(student_id), str(teacher_id), db)
                count += 1
        except Exception as exc:
            logger.error(
                "weekly_report_failed",
                student_id=str(student_id),
                error=str(exc),
            )

    logger.info("weekly_reports_done", count=count)


# ── Startup / shutdown ─────────────────────────────────────────────────────────


async def _ensure_python_runtime() -> None:
    """Check Piston for Python runtime; install it automatically if absent."""
    import httpx

    piston_url = settings.piston_url
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{piston_url}/api/v2/runtimes", timeout=10.0)
            installed = [r["language"].lower() for r in resp.json()]
            if "python" not in installed:
                logger.info("piston_python_not_found_installing")
                install_resp = await client.post(
                    f"{piston_url}/api/v2/packages",
                    json={"language": "python", "version": "3.10.0"},
                    timeout=180.0,
                )
                if install_resp.status_code == 200:
                    logger.info("piston_python_installed_success")
                else:
                    logger.warning(
                        "piston_python_install_failed",
                        status=install_resp.status_code,
                    )
            else:
                logger.info("piston_python_already_installed")
    except httpx.ConnectError:
        logger.warning("piston_unreachable_at_startup", url=piston_url)
    except Exception as e:
        logger.warning("piston_check_failed", error=str(e))


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("learnlab_api_starting", environment=settings.environment)

    # ── Création automatique des tables ──────────────────────
    from app.database import engine
    from app.models.user import Base
    import app.models as _models  # noqa — enregistre tous les modèles
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("database_tables_ready")
    # ─────────────────────────────────────────────────────────

    # Vérifie et installe Python dans Piston
    await _ensure_python_runtime()

    # Initialise LangGraph
    from ai_engine.graph import create_graph
    from ai_engine.llm_factory import get_llm
    from app.database import AsyncSessionLocal
    from rag_pipeline.retriever import RAGRetriever

    async with AsyncSessionLocal() as db:
        app.state.graph = create_graph(get_llm(), RAGRetriever(), db)
    logger.info("langgraph_initialised")

    # Start APScheduler
    _scheduler.add_job(
        _generate_weekly_reports,
        trigger="cron",
        day_of_week="sun",
        hour=18,
        id="weekly_reports",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("apscheduler_started")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    _scheduler.shutdown(wait=False)
    logger.info("learnlab_api_stopping")
