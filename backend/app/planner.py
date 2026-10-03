"""Deterministic planning and conflict detection (SPEC §18, §19).

Everything in this module is plain Python arithmetic and date comparison.
The model extracts *facts*; this module decides *what to do about them*.
Keeping priority ordering and conflict detection out of the LLM is what stops
the action plan from hallucinating a schedule the user never committed to.

No model call happens anywhere in this file — that is the point.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from app.schemas import Conflict, Deadline, Event, LifeOSAnalysis, PlanItem, Priority, Task

_RANK: dict[Priority, int] = {"high": 0, "medium": 1, "low": 2}
_SEVERITY_RANK: dict[Priority, int] = {"high": 0, "medium": 1, "low": 2}

# An event is treated as occupying the whole day when no time is given, so a
# timed item always collides with a date-only item on the same day.
_ALL_DAY = (0, 0)
_FULL_DAY_MINUTES = 24 * 60


def _parse_date(value: str | None) -> date | None:
    """Parse an ISO date, tolerating the sloppy formats models sometimes emit."""
    if not value:
        return None
    text = value.strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _parse_minutes(value: str | None) -> int | None:
    """Minutes since midnight for an ``HH:MM`` time string."""
    if not value:
        return None
    text = value.strip().lower()
    for fmt in ("%H:%M", "%I:%M%p", "%I %M%p", "%I%p", "%I:%M %p"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.hour * 60 + parsed.minute
        except ValueError:
            continue
    return None


def _event_window(event: Event) -> tuple[date, int, int] | None:
    """Return ``(day, start_minute, end_minute)`` for an event, if datable."""
    day = _parse_date(event.date)
    if day is None:
        return None
    start = _parse_minutes(event.time)
    if start is None:
        # Date-only event: occupies the full day.
        return (day, *_ALL_DAY, _FULL_DAY_MINUTES)
    return (day, start, min(start + 60, _FULL_DAY_MINUTES))


def _minutes_until(deadline_date: date, today: date) -> int:
    return int((deadline_date - today).total_seconds() // 60)


def _urgency(hours_left: float | None) -> Priority:
    """Map remaining time to a priority band. Pure function of the clock."""
    if hours_left is None:
        return "low"
    if hours_left < 0:
        return "high"
    if hours_left <= 24:
        return "high"
    if hours_left <= 72:
        return "medium"
    return "low"


# --------------------------------------------------------------------------
# Conflict detection (SPEC §19)
# --------------------------------------------------------------------------


def detect_conflicts(
    events: list[Event],
    deadlines: list[Deadline],
    tasks: list[Task],
    today: date | None = None,
) -> list[Conflict]:
    """Run every deterministic conflict rule and collect the hits."""
    today = today or date.today()
    conflicts: list[Conflict] = []
    conflicts += _event_event_overlaps(events)
    conflicts += _event_deadline_clashes(events, deadlines, today)
    conflicts += _deadline_pressure(deadlines, today)
    conflicts += _task_deadline_mismatch(tasks, deadlines, today)

    conflicts.sort(key=lambda c: _SEVERITY_RANK[c.severity])
    return conflicts


def _event_event_overlaps(events: list[Event]) -> list[Conflict]:
    """Rule 1 — two events occupying the same time."""
    found: list[Conflict] = []
    windows = [(e, _event_window(e)) for e in events]
    dated = [(e, w) for e, w in windows if w is not None]

    for i in range(len(dated)):
        left_event, left = dated[i]
        for j in range(i + 1, len(dated)):
            right_event, right = dated[j]
            if left[0] != right[0]:
                continue
            overlap = min(left[2], right[2]) - max(left[1], right[1])
            if overlap > 0:
                found.append(
                    Conflict(
                        title=f"Double-booked: {left_event.title} and {right_event.title}",
                        explanation=(
                            f"Both are scheduled on {left[0].isoformat()} and their "
                            f"times overlap by {overlap} minutes."
                        ),
                        related_items=[left_event.title, right_event.title],
                        severity="high",
                    )
                )
    return found


def _event_deadline_clashes(
    events: list[Event], deadlines: list[Deadline], today: date
) -> list[Conflict]:
    """Rule 2 — an event sitting on the same day as a deadline."""
    found: list[Conflict] = []
    for event in events:
        window = _event_window(event)
        if window is None:
            continue
        for deadline in deadlines:
            deadline_date = _parse_date(deadline.date)
            if deadline_date is None or deadline_date != window[0]:
                continue
            found.append(
                Conflict(
                    title=f"{deadline.title} due during {event.title}",
                    explanation=(
                        f"{deadline.title} is due on {window[0].isoformat()}, the same "
                        f"day as {event.title}"
                        + (f" at {event.time}." if event.time else ".")
                    ),
                    related_items=[deadline.title, event.title],
                    severity="high",
                )
            )
    return found


def _deadline_pressure(
    deadlines: list[Deadline], today: date
) -> list[Conflict]:
    """Rule 3 — two or more deadlines within the same 24-hour window."""
    found: list[Conflict] = []
    dated = [
        (d, _parse_date(d.date))
        for d in deadlines
    ]
    dated = [(d, day) for d, day in dated if day is not None]
    dated.sort(key=lambda pair: pair[1])

    for i in range(len(dated)):
        anchor, anchor_day = dated[i]
        cluster = [
            (d, day) for d, day in dated[i + 1 :] if (day - anchor_day) <= timedelta(days=1)
        ]
        if not cluster:
            continue
        titles = [anchor.title] + [d.title for d, _ in cluster]
        latest = min(anchor_day, *(day for _, day in cluster))
        found.append(
            Conflict(
                title=f"{len(titles)} deadlines land within 24 hours",
                explanation=(
                    "Due by "
                    + latest.isoformat()
                    + ": "
                    + "; ".join(titles)
                    + ". Work through them in order of course weight, not upload order."
                ),
                related_items=titles,
                severity="high" if len(titles) >= 3 else "medium",
            )
        )
    return found


def _task_deadline_mismatch(
    tasks: list[Task], deadlines: list[Deadline], today: date
) -> list[Conflict]:
    """Rule 4 — a task due after a deadline it clearly feeds into."""
    found: list[Conflict] = []
    dated = [(d, _parse_date(d.date)) for d in deadlines]
    dated = [(d, day) for d, day in dated if day is not None]

    for task in tasks:
        task_date = _parse_date(task.deadline)
        if task_date is None:
            continue
        for deadline, deadline_day in dated:
            # The task lands after the deadline it names as work for it.
            if 0 < (task_date - deadline_day).days <= 7 and _related(task, deadline):
                found.append(
                    Conflict(
                        title=f"{task.title} is due after {deadline.title}",
                        explanation=(
                            f"{task.title} is due {task_date.isoformat()}, but "
                            f"{deadline.title} closes on {deadline_day.isoformat()}. "
                            "Finishing the task after the deadline does not satisfy it."
                        ),
                        related_items=[task.title, deadline.title],
                        severity="high" if task.priority == "high" else "medium",
                    )
                )
    return found


def _related(task: Task, deadline: Deadline) -> bool:
    """True when a task and a deadline plausibly describe the same piece of work.

    Models routinely emit the same obligation twice — once as a task
    ("Write ML report") and once as a deadline ("ML report"). Showing both
    in the plan reads as padding, so the planner collapses them.
    """
    stop = {
        "the", "a", "an", "for", "to", "of", "and", "in", "on", "by", "at",
        "due", "submit", "submission", "complete", "finish", "final",
    }
    left = {t for t in task.title.lower().split() if t not in stop}
    right = {t for t in deadline.title.lower().split() if t not in stop}
    if not left or not right:
        return False
    shared = left & right
    # Either a clear token match, or one title fully contained in the other.
    if shared:
        return True
    return task.title.lower().strip() in deadline.title.lower() or (
        deadline.title.lower().strip() in task.title.lower()
    )


# --------------------------------------------------------------------------
# Planning (SPEC §18)
# --------------------------------------------------------------------------


@dataclass
class _Candidate:
    action: str
    reason: str
    priority: Priority
    deadline: str | None
    deadline_date: date | None
    source: str | None = None


def _deadline_candidates(deadlines: list[Deadline], today: date) -> list[_Candidate]:
    out: list[_Candidate] = []
    for deadline in deadlines:
        day = _parse_date(deadline.date)
        hours = _minutes_until(day, today) / 60 if day else None
        if day is None:
            reason = "No readable date; confirm the deadline yourself."
        elif hours < 0:
            reason = f"Overdue since {day.isoformat()}."
        elif hours <= 24:
            reason = f"Due within 24 hours ({day.isoformat()})."
        elif hours <= 72:
            reason = f"Due within 3 days ({day.isoformat()})."
        else:
            reason = f"Due {day.isoformat()}."
        out.append(
            _Candidate(
                action=f"Finish: {deadline.title}",
                reason=reason,
                priority=_urgency(hours),
                deadline=deadline.date,
                deadline_date=day,
                source=deadline.source,
            )
        )
    return out


def _task_candidates(
    tasks: list[Task],
    today: date,
    fallback_dates: dict[int, str] | None = None,
) -> list[_Candidate]:
    out: list[_Candidate] = []
    fallback_dates = fallback_dates or {}
    for index, task in enumerate(tasks):
        # A task frequently omits its date while the matching deadline
        # carries it. Borrow it rather than losing the urgency signal.
        deadline = task.deadline or fallback_dates.get(index)
        day = _parse_date(deadline)
        hours = _minutes_until(day, today) / 60 if day else None
        reason = task.description or (
            f"Marked {task.priority} priority"
            + (f", due {day.isoformat()}" if day else ", no date given")
            + "."
        )
        # A stated priority can only be raised by the clock, never lowered.
        priority = task.priority
        clock = _urgency(hours)
        if _RANK[clock] < _RANK[priority]:
            priority = clock
        out.append(
            _Candidate(
                action=task.title,
                reason=reason,
                priority=priority,
                deadline=deadline,
                deadline_date=day,
                source=task.source,
            )
        )
    return out


def _collapse_duplicates(
    tasks: list[Task], deadlines: list[Deadline]
) -> tuple[dict[int, str], list[Deadline]]:
    """Reconcile obligations the model reported as both a task and a deadline.

    Gemma frequently emits the same real-world obligation twice — once as a
    task ("Write ML report") and once as a deadline ("ML report"). Listing
    both in the plan looks like padding, so the task wins (it carries the
    richer description) and absorbs the deadline's date.

    Returns:
        ``(task_index -> borrowed date, deadlines with no matching task)``
    """
    borrowed: dict[int, str] = {}
    unmatched: list[Deadline] = []

    for deadline in deadlines:
        match = next((i for i, task in enumerate(tasks) if _related(task, deadline)), None)
        if match is None:
            unmatched.append(deadline)
            continue
        current = borrowed.get(match)
        # Keep the earliest date: that is the binding constraint.
        if current is None or _date_key(deadline.date) < _date_key(current):
            borrowed[match] = deadline.date

    return borrowed, unmatched


def _date_key(value: str | None) -> tuple[bool, date]:
    """Sort key that pushes undated values last."""
    parsed = _parse_date(value)
    return (parsed is None, parsed or date.max)


def build_plan(
    analysis: LifeOSAnalysis,
    conflicts: list[Conflict],
    today: date | None = None,
) -> list[PlanItem]:
    """Order every actionable item by urgency and deadline.

    Sort key, in order:

    1. priority band (high → low)
    2. nearest deadline (undated items sink to the end)
    3. title, so the order is stable across runs

    Conflicts are folded in as reasons so the plan reflects clashes rather
    than a flat to-do list.
    """
    today = today or date.today()

    borrowed, unmatched = _collapse_duplicates(analysis.tasks, analysis.deadlines)

    candidates = [
        *_task_candidates(analysis.tasks, today, borrowed),
        *_deadline_candidates(unmatched, today),
    ]

    # Key conflicts by every title they mention so a task that absorbed its
    # deadline still inherits that deadline's clash.
    conflict_reasons: dict[str, str] = {}
    for conflict in conflicts:
        for item in conflict.related_items:
            conflict_reasons.setdefault(item.strip().lower(), conflict.explanation)

    for candidate in candidates:
        clash = conflict_reasons.get(
            candidate.action.removeprefix("Finish: ").strip().lower()
        )
        if clash:
            candidate.reason = f"{candidate.reason} Conflict: {clash}"

    candidates.sort(
        key=lambda c: (
            _RANK[c.priority],
            c.deadline_date or date.max,
            c.action,
        )
    )

    return [
        PlanItem(
            order=index,
            action=candidate.action,
            reason=candidate.reason,
            priority=candidate.priority,
            deadline=candidate.deadline,
        )
        for index, candidate in enumerate(candidates, start=1)
    ]


def enrich(analysis: LifeOSAnalysis, today: date | None = None) -> LifeOSAnalysis:
    """Replace the model's plan and conflicts with deterministic ones.

    Gemma is asked to leave ``plan`` empty; conflicts it does report are kept
    as additional signal and merged with the rules detected here.
    """
    today = today or date.today()

    detected = detect_conflicts(
        events=analysis.events,
        deadlines=analysis.deadlines,
        tasks=analysis.tasks,
        today=today,
    )

    # Deterministic rules win on duplicates; model-reported clashes are kept
    # because they can see semantics (e.g. "prep exam" vs "final exam").
    seen = {(c.title, tuple(sorted(c.related_items))) for c in detected}
    merged = list(detected)
    for conflict in analysis.conflicts:
        key = (conflict.title, tuple(sorted(conflict.related_items)))
        if key not in seen:
            seen.add(key)
            merged.append(conflict)

    merged.sort(key=lambda c: _SEVERITY_RANK[c.severity])

    return analysis.model_copy(
        update={
            "conflicts": merged,
            "plan": build_plan(analysis, merged, today=today),
        }
    )