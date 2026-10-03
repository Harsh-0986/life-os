"""POST /api/analyze — multimodal extraction (SPEC §20, §21, §22).

One request carries every image, Gemma returns structured output, and the
deterministic planner overwrites the plan and merges the conflicts before
the response leaves the backend.
"""

from __future__ import annotations

import logging
from typing import Annotated

import anyio
from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.config import get_settings
from app.llm import AnalysisError, analyze_images, build_image_blocks
from app.planner import enrich
from app.schemas import AnalyzeResponse, LifeOSAnalysis
from app.uploads import UploadRejected, to_http_error, validate_uploads

logger = logging.getLogger(__name__)
router = APIRouter(tags=["analysis"])


@router.post(
    "/api/analyze",
    response_model=AnalyzeResponse,
    summary="Analyze screenshots and produce an action plan",
)
async def analyze(files: Annotated[
        list[UploadFile],
        File(description="PNG / JPEG / WEBP screenshots to analyze together."),
    ] = [],
) -> AnalyzeResponse:
    """Extract tasks, deadlines, and events from images, then plan them.

    All images travel to Gemma in a single multimodal request, so it can reason
    across them. Rejects bad uploads with 400 before spending a model call.
    Model failures surface as 502, letting the client tell "your upload was
    bad" apart from "the model was unavailable".
    """
    settings = get_settings()

    try:
        uploads = validate_uploads(files, settings)
    except UploadRejected as exc:
        raise to_http_error(exc) from exc

    filenames = [upload.filename for upload in uploads]
    logger.info("Analyzing %d image(s): %s", len(uploads), ", ".join(filenames))

    image_blocks = build_image_blocks(
        [upload.content for upload in uploads],
        [upload.mime_type for upload in uploads],
    )

    try:
        raw = await analyze_images_async(image_blocks, filenames)
    except AnalysisError as exc:
        logger.error("Analysis failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The model could not produce a valid analysis. Try again.",
        ) from exc

    # Deterministic pass: conflicts and plan come from Python, not the model.
    analysis = enrich(raw)

    # Re-validate. The planner produced these, so this is a cheap guarantee
    # that the response body matches the declared schema (SPEC §22).
    return AnalyzeResponse(
        success=True,
        analysis=LifeOSAnalysis.model_validate(analysis.model_dump()),
    )


async def analyze_images_async(image_blocks, filenames):
    """Run the blocking LangChain call off the event loop."""
    return await anyio.to_thread.run_sync(
        lambda: analyze_images(image_blocks, filenames)
    )