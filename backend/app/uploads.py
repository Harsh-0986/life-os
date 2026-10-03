"""Upload validation shared by the analyze endpoint (SPEC §21).

FastAPI's UploadFile will happily buffer a 2 GB file. These checks reject
bad input before it reaches the model or the base64 encoder.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException, UploadFile, status

from app.config import Settings

_EXTENSIONS = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}


class UploadRejected(Exception):
    """Raised when an upload violates the documented limits."""


@dataclass
class ValidatedUpload:
    filename: str
    mime_type: str
    content: bytes


def validate_uploads(files: list[UploadFile], settings: Settings) -> list[ValidatedUpload]:
    """Enforce count, MIME type, per-file size, and total size."""
    if not files:
        raise UploadRejected("Attach at least one image.")

    if len(files) > settings.max_files:
        raise UploadRejected(
            f"Too many images: {len(files)}. The limit is {settings.max_files}."
        )

    validated: list[ValidatedUpload] = []
    total = 0

    for upload in files:
        content_type = (upload.content_type or "").split(";")[0].strip().lower()
        if content_type not in settings.allowed_mime_types:
            allowed = ", ".join(sorted(settings.allowed_mime_types))
            raise UploadRejected(
                f"{upload.filename or 'That file'} is {content_type or 'an unknown type'}. "
                f"Supported formats: {allowed}."
            )

        content = upload.file.read()
        size = len(content)
        if size == 0:
            raise UploadRejected(f"{upload.filename} is empty.")
        if size > settings.max_file_bytes:
            limit_mb = settings.max_file_bytes // (1024 * 1024)
            raise UploadRejected(
                f"{upload.filename} is {size // (1024 * 1024)} MB. The limit is {limit_mb} MB."
            )

        total += size
        if total > settings.max_request_bytes:
            limit_mb = settings.max_request_bytes // (1024 * 1024)
            raise UploadRejected(f"Total upload exceeds {limit_mb} MB.")

        validated.append(
            ValidatedUpload(
                filename=upload.filename or f"image.{_EXTENSIONS[content_type].lstrip('.')}",
                mime_type=content_type,
                content=content,
            )
        )

    return validated


def to_http_error(exc: UploadRejected) -> HTTPException:
    """Map a rejection onto a 400 with a message the UI can show verbatim."""
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))