"""GET /api/calendar — export extracted events as an importable calendar file.

Returns RFC 5545 iCalendar text. The user imports it into any calendar app,
which is the whole integration: no OAuth, no credential storage, no writes to
a third-party account (SPEC §32 rules out a database for token storage).
"""

from __future__ import annotations

import json
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field, ValidationError

from app.calendar import build_ics, to_calendar_events
from app.schemas import Event, LifeOSAnalysis

router = APIRouter(tags=["calendar"])


class ExportableEvent(BaseModel):
    """An event as it arrives for export.

    Deliberately not ``schemas.Event``. That model requires ``source``, which
    is provenance for the UI. A calendar file has no notion of which
    screenshot an entry came from, and making the caller invent one would be
    noise in the export URL.
    """

    title: str
    date: str | None = None
    time: str | None = None
    location: str | None = None


class EventList(BaseModel):
    """Validates the JSON blob the frontend sends as a query parameter.

    FastAPI cannot bind a ``list[Model]`` query parameter, so the events arrive
    as one JSON string and are parsed and validated here. A GET is the right
    verb for a download, and this keeps the parameter working.
    """

    events: list[ExportableEvent] = Field(default_factory=list)


def _parse_events(events: str | None = None) -> EventList:
    """Parse and validate the ``events`` query parameter.

    The parameter name must match the query key the frontend sends; FastAPI
    binds by the dependency callable's parameter name.
    """
    if not events:
        return EventList()
    try:
        parsed = json.loads(events)
        # Accept either a bare array or {"events": [...]} so the endpoint is
        # forgiving about how a caller wraps the payload.
        if isinstance(parsed, dict):
            return EventList.model_validate(parsed)
        return EventList(events=parsed)
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not read the events to export: {exc}",
        ) from exc


@router.get(
    "/api/calendar",
    summary="Export dated events as an iCalendar file",
    response_class=Response,
    responses={
        200: {
            "description": "An iCalendar file. Import it into any calendar app.",
            "content": {"text/calendar": {}},
        },
        404: {"description": "No events with a readable date."},
    },
)
async def export_calendar(
    payload: Annotated[EventList, Depends(_parse_events)],
) -> Response:
    """Return the given events as a downloadable ``.ics``.

    Only dated events are included: an event with no date has nowhere to sit
    on a calendar, and inventing a date is the kind of guessing the
    deterministic planner exists to avoid.
    """
    analysis = LifeOSAnalysis(
        summary="",
        events=[
            Event(
                title=event.title,
                date=event.date,
                time=event.time,
                location=event.location,
                # Provenance is unknown at export time and unused by the file.
                source="LifeOS import",
            )
            for event in payload.events
        ],
    )

    if not to_calendar_events(analysis):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No events with a readable date were found, so there is nothing to export.",
        )

    stamp = datetime.now()
    filename = f"lifeos-{stamp:%Y-%m-%d}.ics"

    return Response(
        content=build_ics(analysis, generated_at=stamp),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            # Dated events reflect the user's actual schedule; do not let a
            # shared cache hold them.
            "Cache-Control": "no-store",
        },
    )

