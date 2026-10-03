"""Calendar export via RFC 5545 (``.ics``).

Extracted events are written to a standards-compliant calendar file the user
can import into Google Calendar, Apple Calendar, or Outlook in one click.

Why a file instead of Google Calendar API write-back:

- No OAuth. Writing to a real calendar needs a Cloud project, a consent
  screen, a client secret, and a per-user refresh token, plus somewhere to keep
  the token. SPEC §32 rules out a database, so there is nowhere to keep it.
- No third-party writes. The user's calendar data never leaves their machine.
- Works offline and is testable without credentials.

Scope: only items that actually carry a date or time are exported. An event
with no date has nowhere to sit on a calendar, and inventing one is exactly
the guessing the deterministic planner exists to avoid.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.schemas import Event, LifeOSAnalysis

# Field separators and escapes are fixed by RFC 5545 §3.1.
_ESCAPE = str.maketrans(
    {
        "\\": "\\\\",
        ";": "\\;",
        ",": "\\,",
        "\n": "\\n",
    }
)
_UNSAFE = re.compile(r"[\r\n]")

# Products cap line length at 75 octets; fold with CRLF + space per §3.1.
_MAX_LINE = 75


@dataclass
class CalendarEvent:
    """One VEVENT, already reduced to calendar-shaped fields."""

    uid: str
    summary: str
    start: datetime
    end: datetime
    description: str
    location: str
    source: str


def _escape(value: str | None) -> str:
    return _UNSAFE.sub(" ", value or "").translate(_ESCAPE)


def _fold(line: str) -> str:
    """Fold an over-long content line per RFC 5545 §3.1."""
    if len(line.encode("utf-8")) <= _MAX_LINE:
        return line
    # Fold on character boundaries; good enough for the short lines here.
    out, current = [], ""
    for char in line:
        if len((current + char).encode("utf-8")) > _MAX_LINE:
            out.append(current)
            current = " " + char
        else:
            current += char
    out.append(current)
    return "\r\n".join(out)


def _stamp(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%S")


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    match = re.match(r"^(\d{4})-(\d{2})-(\d{2})", value.strip())
    if not match:
        return None
    year, month, day = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _parse_time(value: str | None) -> tuple[int, int] | None:
    """Minutes past midnight, tolerating the formats models emit."""
    if not value:
        return None
    text = value.strip().lower()
    for fmt in ("%H:%M", "%I:%M%p", "%I:%M %p", "%I%p", "%I %M%p"):
        try:
            parsed = datetime.strptime(text, fmt)
        except ValueError:
            continue
        return parsed.hour * 60 + parsed.minute
    match = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?$", text)
    if not match:
        return None
    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    if match.group(3):
        if hour == 12:
            hour = 0
        if match.group(3) == "pm":
            hour += 12
    if not 0 <= hour <= 23 or not 0 <= minute <= 59:
        return None
    return hour * 60 + minute


def _stable_uid(index: int, event: Event) -> str:
    """Deterministic UID so re-importing updates rather than duplicates."""
    seed = f"{index}:{event.title}:{event.date or ''}:{event.source}"
    digest = abs(hash(seed))
    return f"{digest:x}-lifeos-{index}@lifeos.local"


def to_calendar_events(analysis: LifeOSAnalysis) -> list[CalendarEvent]:
    """Reduce extracted events to those with a usable date.

    Defaults to a one-hour block starting at 09:00 when the source gave a date
    but no time. That is a stated default, not an inference about the user's
    schedule, and the UI says so.
    """
    results: list[CalendarEvent] = []

    for index, event in enumerate(analysis.events):
        day = _parse_date(event.date)
        if day is None:
            # No date means no place on a calendar.
            continue

        minutes = _parse_time(event.time)
        assumed = minutes is None
        if minutes is None:
            minutes = 9 * 60

        start = datetime(day.year, day.month, day.day) + timedelta(minutes=minutes)
        end = start + timedelta(hours=1)

        notes = [f"Extracted by LifeOS from {event.source}."]
        if event.location:
            notes.insert(0, f"Location: {event.location}")
        if assumed:
            notes.append("No time was given in the source; this was set to 09:00.")

        results.append(
            CalendarEvent(
                uid=_stable_uid(index, event),
                summary=event.title,
                start=start,
                end=end,
                description="\n".join(notes),
                location=event.location or "",
                source=event.source,
            )
        )

    results.sort(key=lambda item: item.start)
    return results


def build_ics(analysis: LifeOSAnalysis, generated_at: datetime | None = None) -> str:
    """Render a VCALENDAR containing every dated event."""
    now = generated_at or datetime.now()
    lines: list[str] = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LifeOS//Multimodal Planner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:LifeOS {now:%Y-%m-%d}",
    ]

    for item in to_calendar_events(analysis):
        lines += [
            "BEGIN:VEVENT",
            f"UID:{item.uid}",
            # DTSTAMP is when this file was made, not when the event happens.
            f"DTSTAMP:{_stamp(now)}",
            f"DTSTART:{_stamp(item.start)}",
            f"DTEND:{_stamp(item.end)}",
            f"SUMMARY:{_escape(item.summary)}",
            f"DESCRIPTION:{_escape(item.description)}",
        ]
        if item.location:
            lines.append(f"LOCATION:{_escape(item.location)}")
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"