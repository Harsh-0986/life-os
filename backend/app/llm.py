"""The one and only AI integration point (SPEC §16, §17).

Nothing else in the application may import ``ChatGoogleGenerativeAI`` or
construct a model. Routers call the chains built here, which keeps the
provider swappable and makes it obvious where credentials are used.

Two chains are exposed:

* :func:`create_analysis_chain` — multimodal, one request carrying every
  image, returning a validated :class:`~app.schemas.LifeOSAnalysis`.
* :func:`create_chat_chain` — text only, reasoning over the structured
  analysis (SPEC §14).

Structured output uses Gemma's function-calling path by default. Gemma does
not implement Gemini's strict ``response_json_schema`` parameter, so the
``json_schema`` / ``json_mode`` methods of ``langchain-google-genai`` cannot
be relied on here. :func:`analyze_images` therefore falls back to
prompt-embedded JSON mode on its second and final attempt (SPEC §12).
"""

from __future__ import annotations

import base64
import json
import logging
from functools import lru_cache
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import PydanticOutputParser, StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import Runnable
from langchain_google_genai import ChatGoogleGenerativeAI

from app.config import Settings, get_settings
from app.prompts import (
    ANALYSIS_SYSTEM,
    CHAT_PROMPT,
    CHAT_SYSTEM,
    build_analysis_instruction,
)
from app.schemas import ChatContext, LifeOSAnalysis

logger = logging.getLogger(__name__)

# Image content blocks use the LangChain v1 multimodal format:
#   {"type": "image", "base64": ..., "mime_type": ...}
# The older Chat Completions `image_url` format is still accepted by
# langchain-google-genai but is explicitly a compatibility path (SPEC §9).
ImageBlock = dict[str, Any]


class AnalysisError(RuntimeError):
    """Raised when the model fails to produce a valid analysis."""


# --------------------------------------------------------------------------
# Model
# --------------------------------------------------------------------------


@lru_cache(maxsize=8)
def _model_for(temperature: float, api_key: str, model_name: str) -> ChatGoogleGenerativeAI:
    """Build (and cache) a Gemma chat model.

    Cached so repeated requests reuse one client. The model identifier is
    supplied by ``GEMMA_MODEL`` and is never hardcoded here (SPEC §25).
    """
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=api_key,
    )


def create_model(temperature: float | None = None) -> ChatGoogleGenerativeAI:
    """Public factory for the Gemma model."""
    settings: Settings = get_settings()
    return _model_for(
        settings.analysis_temperature if temperature is None else temperature,
        settings.gemini_api_key,
        settings.gemma_model,
    )


# --------------------------------------------------------------------------
# Analysis chain
# --------------------------------------------------------------------------


def _analysis_prompt(instruction: str, image_blocks: list[ImageBlock]) -> ChatPromptTemplate:
    """Prompt template carrying the instruction *and* every image.

    All images live in one ``HumanMessage`` (SPEC §8). The blocks are baked
    into the template because LangChain v1 cannot interpolate a list of
    multimodal blocks from a template variable — doing so stringifies them.
    """
    return ChatPromptTemplate.from_messages(
        [
            ("system", ANALYSIS_SYSTEM),
            (
                "human",
                [
                    {"type": "text", "text": instruction},
                    *image_blocks,
                ],
            ),
        ]
    )


def _json_mode_instruction() -> str:
    """Schema the model must satisfy when function calling is unavailable."""
    schema = LifeOSAnalysis.model_json_schema()
    return (
        "\n\nReturn your entire response as a single JSON object conforming to "
        "the JSON Schema below. Output raw JSON only: no prose, no explanation, "
        "no markdown code fences.\n\n"
        f"{json.dumps(schema, indent=2)}"
    )


def create_analysis_chain(
    image_blocks: list[ImageBlock],
    filenames: list[str],
    *,
    method: str | None = None,
) -> Runnable:
    """Build the multimodal analysis chain.

    Args:
        image_blocks: base64 image blocks, one per uploaded file.
        filenames: original filenames, used for source attribution.
        method: structured-output strategy; defaults to the configured value.

    Returns:
        An LCEL runnable taking ``{"instruction": ...}`` and returning a
        validated :class:`LifeOSAnalysis`.
    """
    settings = get_settings()
    instruction = build_analysis_instruction(filenames)

    if method == "prompt_json":
        parser = PydanticOutputParser(pydantic_object=LifeOSAnalysis)
        llm = create_model(settings.analysis_temperature).bind(
            response_mime_type="application/json"
        )
        prompt = _analysis_prompt(instruction + _json_mode_instruction(), image_blocks)
        return prompt | llm | parser

    llm = create_model(settings.analysis_temperature).with_structured_output(
        LifeOSAnalysis,
        method=method or settings.structured_output_method,
    )
    return _analysis_prompt(instruction, image_blocks) | llm


def analyze_images(image_blocks: list[ImageBlock], filenames: list[str]) -> LifeOSAnalysis:
    """Run the analysis, with at most two attempts (SPEC §12, §13).

    Attempt 1 uses the configured structured-output method. Attempt 2 falls
    back to prompt-embedded JSON mode, which only depends on
    ``response_mime_type`` and works across model families. There is no
    unbounded loop and no retry middleware.
    """
    settings = get_settings()
    # Attempt 1 = configured method. Attempt 2 = model-agnostic JSON mode.
    attempts: tuple[str | None, ...] = (None, "prompt_json")

    last_error: Exception | None = None
    for override in attempts:
        try:
            chain = create_analysis_chain(image_blocks, filenames, method=override)
            return chain.invoke({})
        except Exception as exc:  # noqa: BLE001 - re-raised below
            last_error = exc
            logger.warning(
                "Analysis attempt failed (method=%s): %s",
                override or settings.structured_output_method,
                exc,
            )

    raise AnalysisError(f"Model did not return a valid analysis: {last_error}") from last_error


# --------------------------------------------------------------------------
# Chat chain
# --------------------------------------------------------------------------


def create_chat_chain() -> Runnable:
    """Text-only chat chain over the structured analysis (SPEC §14, §15)."""
    settings = get_settings()
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", CHAT_SYSTEM),
            ("human", CHAT_PROMPT),
        ]
    )
    return prompt | create_model(settings.chat_temperature) | StrOutputParser()


def ask(question: str, context: ChatContext) -> str:
    """Answer a question about a completed analysis."""
    analysis_blob = context.model_dump_json(indent=2)
    return create_chat_chain().invoke(
        {"analysis": analysis_blob, "question": question}
    ).strip()


def collect_sources(context: ChatContext) -> list[str]:
    """Filenames backing the analysis, for the chat response (SPEC §23)."""
    sources: list[str] = []
    for group in (context.tasks, context.events, context.deadlines):
        for item in group:
            if item.source not in sources:
                sources.append(item.source)
    return sources


def build_image_blocks(payloads: list[bytes], mime_types: list[str]) -> list[ImageBlock]:
    """Turn raw uploads into LangChain v1 image content blocks."""
    return [
        {
            "type": "image",
            "base64": base64.b64encode(payload).decode("ascii"),
            "mime_type": mime_type,
        }
        for payload, mime_type in zip(payloads, mime_types, strict=True)
    ]


__all__ = [
    "AnalysisError",
    "HumanMessage",
    "analyze_images",
    "ask",
    "build_image_blocks",
    "collect_sources",
    "create_analysis_chain",
    "create_chat_chain",
    "create_model",
]