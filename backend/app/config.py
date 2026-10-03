"""Application settings.

The model identifier lives here and ONLY here (SPEC §25). It is read from
``GEMMA_MODEL`` and never hardcoded anywhere else in the codebase.

Credentials stay server-side: this module is imported exclusively by the
FastAPI backend and its values are never returned over HTTP (SPEC §24).
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, loaded from the environment / backend ``.env``."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Required -----------------------------------------------------------
    gemini_api_key: str
    """Server-side Gemini credential. Never exposed to the browser."""

    gemma_model: str
    """The Gemma model identifier. Single source of truth (SPEC §25)."""

    # --- Networking ---------------------------------------------------------
    cors_origin: str = "http://localhost:3000"

    # --- Model behaviour ----------------------------------------------------
    analysis_temperature: float = 0.0
    """Extraction must be deterministic, not creative (SPEC §11)."""

    chat_temperature: float = 0.2
    """Slightly looser so chat answers read naturally (SPEC §11)."""

    structured_output_method: str = "prompt_json"
    """How to obtain structured output from the model.

    ``prompt_json`` embeds the JSON Schema in the prompt and asks for
    ``response_mime_type=application/json``, then validates with Pydantic.
    It is the default because it is the widest-supported mechanism: the
    ``json_schema`` / ``json_mode`` methods of ``langchain-google-genai``
    always send Gemini's strict ``response_json_schema``, which Gemma does
    not implement, and ``function_calling`` loses nested models because
    Gemma's schema validator ignores ``$defs``.

    On the second and final attempt ``llm.py`` switches to function calling.
    """

    # --- Upload limits (SPEC §21) -------------------------------------------
    max_files: int = 5
    max_file_bytes: int = 10 * 1024 * 1024
    max_request_bytes: int = 30 * 1024 * 1024
    allowed_mime_types: tuple[str, ...] = (
        "image/png",
        "image/jpeg",
        "image/webp",
    )

    # --- Reliability (SPEC §12) --------------------------------------------
    max_analysis_attempts: int = 2
    request_timeout_seconds: float = 120.0

    @property
    def cors_origins(self) -> list[str]:
        """Allow comma-separated origins so the Vercel preview URL can be added."""
        return [origin.strip() for origin in self.cors_origin.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Cached accessor so ``.env`` is parsed once per process."""
    return Settings()