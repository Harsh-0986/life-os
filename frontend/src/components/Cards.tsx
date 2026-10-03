"use client";

import { cn, formatDate, priorityStyle } from "@/lib/utils";
import type { Conflict, Deadline, Event, PlanItem, Task } from "@/lib/types";

/** Clickable chip that reveals the image an item was extracted from (SPEC §30). */
function SourceChip({
  source,
  activeSource,
  onSelect,
}: {
  source: string;
  activeSource: string | null;
  onSelect: (filename: string) => void;
}) {
  if (!source) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(source)}
      title={`View ${source}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[11px] transition",
        activeSource === source
          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/50"
          : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200",
      )}
    >
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-3 w-3"
        aria-hidden="true"
      >
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
        <path d="M1.5 10.5l3.5-3 3 2.5 3-3.5 3.5 4" strokeLinejoin="round" />
      </svg>
      {source}
    </button>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 transition hover:border-neutral-700",
        className,
      )}
    >
      {children}
    </article>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ring-1",
        priorityStyle(value),
      )}
    >
      {value}
    </span>
  );
}

interface CardProps {
  activeSource: string | null;
  onSelectSource: (filename: string) => void;
}

export function TaskCard({
  task,
  activeSource,
  onSelectSource,
}: { task: Task } & CardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-medium text-neutral-100">{task.title}</h4>
        <Badge value={task.priority} />
      </div>

      {task.description && (
        <p className="mt-1.5 text-sm text-neutral-400">{task.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {task.deadline && (
          <span className="text-neutral-500">Due {formatDate(task.deadline)}</span>
        )}
        <SourceChip
          source={task.source}
          activeSource={activeSource}
          onSelect={onSelectSource}
        />
      </div>
    </Card>
  );
}

export function DeadlineCard({
  deadline,
  activeSource,
  onSelectSource,
}: { deadline: Deadline } & CardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-medium text-neutral-100">{deadline.title}</h4>
        <span className="shrink-0 text-sm tabular-nums text-neutral-400">
          {formatDate(deadline.date)}
        </span>
      </div>
      <div className="mt-3">
        <SourceChip
          source={deadline.source}
          activeSource={activeSource}
          onSelect={onSelectSource}
        />
      </div>
    </Card>
  );
}

export function EventCard({
  event,
  activeSource,
  onSelectSource,
}: { event: Event } & CardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-medium text-neutral-100">{event.title}</h4>
        <span className="shrink-0 text-sm text-neutral-400">
          {event.time ?? formatDate(event.date)}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
        {event.time && event.date && <span>{formatDate(event.date)}</span>}
        {event.location && <span>{event.location}</span>}
      </div>

      <div className="mt-3">
        <SourceChip
          source={event.source}
          activeSource={activeSource}
          onSelect={onSelectSource}
        />
      </div>
    </Card>
  );
}

export function ConflictCard({ conflict }: { conflict: Conflict }) {
  const isHigh = conflict.severity === "high";

  return (
    <Card className={cn(isHigh && "border-rose-500/30 bg-rose-500/5")}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-medium text-neutral-100">{conflict.title}</h4>
        <Badge value={conflict.severity} />
      </div>

      <p className="mt-1.5 text-sm text-neutral-400">{conflict.explanation}</p>

      {conflict.related_items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {conflict.related_items.map((item) => (
            <li key={item} className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">↳</span>
              <span className="text-neutral-300">{item}</span>
            </li>
          ))}
        </ul>
      )}

      {/* A conflict spans two or more items, so it has no single source image
          to link to. The referenced titles trace back via the chips above. */}
    </Card>
  );
}

export function PlanCard({
  item,
  total,
}: {
  item: PlanItem;
  total: number;
}) {
  return (
    <li className="flex gap-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold tabular-nums text-neutral-900">
        {item.order}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h4 className="font-medium text-neutral-100">{item.action}</h4>
          <Badge value={item.priority} />
        </div>

        <p className="mt-1.5 text-sm text-neutral-400">{item.reason}</p>

        {item.deadline && (
          <p className="mt-2 text-xs text-neutral-500">
            Due {formatDate(item.deadline)}
          </p>
        )}
      </div>

      <span className="sr-only">
        Step {item.order} of {total}
      </span>
    </li>
  );
}