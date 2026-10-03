"""POST /api/chat — question answering over the structured analysis (SPEC §20, §23).

The model receives the structured analysis, never the raw images (§14).
"""

from __future__ import annotations

import logging

import anyio
from fastapi import APIRouter, HTTPException, status

from app.llm import ask, collect_sources
from app.schemas import ChatRequest, ChatResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["chat"])


@router.post(
    "/api/chat",
    response_model=ChatResponse,
    summary="Ask a question about a completed analysis",
)
async def chat(payload: ChatRequest) -> ChatResponse:
    """Answer strictly from the structured context supplied by the client."""
    try:
        answer = await anyio.to_thread.run_sync(
            lambda: ask(payload.question, payload.context)
        )
    except Exception as exc:  # noqa: BLE001 - surfaced as a gateway failure
        logger.error("Chat failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The assistant could not answer that. Try rephrasing.",
        ) from exc

    return ChatResponse(answer=answer, sources=collect_sources(payload.context))