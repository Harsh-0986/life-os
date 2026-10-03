"""LifeOS API entrypoint.

Next.js calls this service; this service is the only caller of the Gemini
API (SPEC §24). Credentials are read from the environment and never leave
the process.
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import analyze, chat

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)

settings = get_settings()

app = FastAPI(
    title="LifeOS API",
    version="1.0.0",
    summary="Multimodal personal planning powered by Gemma.",
    description=(
        "Upload screenshots of assignments, calendars, and messages. Gemma reads "
        "them together in a single multimodal request, returns structured "
        "extraction, and a deterministic Python planner turns those facts into a "
        "prioritized action plan with conflict detection.\n\n"
        "Use **Try it out** below: `/api/analyze` takes `multipart/form-data` with "
        "one or more `files[]` entries (PNG, JPEG, or WEBP; up to 5 files, 10 MB "
        "each, 30 MB total)."
    ),
    openapi_tags=[
        {"name": "analysis", "description": "Multimodal extraction and planning."},
        {"name": "chat", "description": "Questions answered from the structured analysis."},
        {"name": "meta", "description": "Liveness and configuration."},
    ],
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# The browser is a different origin than the API, so CORS is required. The
# allowlist is env-driven to keep the Vercel preview URL working.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(chat.router)


@app.get("/api/health", tags=["meta"], summary="Liveness and model check")
async def health() -> dict[str, object]:
    """Confirms the service is up and which model it will call.

    Reports the model name only. The API key is never echoed back.
    """
    return {
        "status": "ok",
        "model": settings.gemma_model,
        "max_files": settings.max_files,
        "max_file_mb": settings.max_file_bytes // (1024 * 1024),
    }