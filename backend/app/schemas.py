"""Pydantic models shared by the model, the planner, and the HTTP layer.

``LifeOSAnalysis`` is the structured contract Gemma must satisfy (SPEC §7).
The same models validate the response before it leaves the backend
(SPEC §22), so a malformed model response can never reach the UI.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["high", "medium", "low"]


class Task(BaseModel):
    """An action the user needs to take."""

    title: str
    description: str | None = None
    deadline: str | None = None
    priority: Priority
    source: str = Field(description="Filename of the image this came from.")


class Event(BaseModel):
    """A scheduled, time-bound occurrence."""

    title: str
    date: str | None = None
    time: str | None = None
    location: str | None = None
    source: str = Field(description="Filename of the image this came from.")


class Deadline(BaseModel):
    """A hard cut-off date extracted from a source image."""

    title: str
    date: str
    source: str = Field(description="Filename of the image this came from.")


class Conflict(BaseModel):
    """A scheduling clash detected deterministically by the planner."""

    title: str
    explanation: str
    related_items: list[str]
    severity: Priority


class PlanItem(BaseModel):
    """One ordered step of the action plan."""

    order: int
    action: str
    reason: str
    priority: Priority
    deadline: str | None = None


class LifeOSAnalysis(BaseModel):
    """The complete structured output of a single multimodal analysis."""

    summary: str
    tasks: list[Task] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    deadlines: list[Deadline] = Field(default_factory=list)
    conflicts: list[Conflict] = Field(default_factory=list)
    plan: list[PlanItem] = Field(default_factory=list)


# --------------------------------------------------------------------------
# HTTP request / response envelopes (SPEC §22, §23)
# --------------------------------------------------------------------------


class AnalyzeResponse(BaseModel):
    success: bool = True
    analysis: LifeOSAnalysis


class ChatContext(BaseModel):
    """The subset of the analysis the assistant is allowed to reason over.

    Raw images are deliberately excluded: chat reasons over structured
    facts only (SPEC §14).
    """

    summary: str | None = None
    tasks: list[Task] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    deadlines: list[Deadline] = Field(default_factory=list)
    conflicts: list[Conflict] = Field(default_factory=list)
    plan: list[PlanItem] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    context: ChatContext


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = Field(default_factory=list)