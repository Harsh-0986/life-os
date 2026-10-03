"use client";

import { cn, formatDate, frameNumber, severityStyle } from "@/lib/utils";
import type { Conflict, Deadline, Event, PlanItem, Task } from "@/lib/types";

/**
 * Source reference, printed the way a caption cites its frames.
 *
 * Clicking opens the originating image so a user can check an extraction
 * against the screenshot it came from (SPEC §30). The whole point of the
 * product is trusting what the model read, and that requires being able to
 * look.
 */
function FrameRef({
  source,
  index,
  onSelect,
}: {
  source: string;
  index?: number;
  onSelect: (filename: string) => void;
}) {
  if (!source) return null;

  return (
    <button
      type="button"
      onClick={() => onSelect(source)}
      title={`View ${source}`}
      className="sleeve-label inline-flex items-center gap-1.5 text-ink-3 underline-offset-4 transition hover:text-signal hover:underline"
    >
      <span className="border border-rule px-1 py-px text-ink-2">
        {index !== undefined ? frameNumber(index) : "··"}
      </span>
      <span className="max-w-40 truncate normal-case tracking-normal">
        {source}
      </span>
    </button>
  );
}

/** Severity chip: ink density for low, grease pencil reserved for high. */
function Severity({ value }: { value: string }) {
  return (
    <span
      className={cn(
        "sleeve-label shrink-0 border px-1.5 py-0.5",
        severityStyle(value),
      )}
    >
      {value}
    </span>
  );
}

interface RefProps {
  activeSource: string | null;
  onSelectSource: (filename: string) => void;
  /** Position of this item's source frame, when known. */
  frameIndex?: number;
}

/*
  Rows, not cards. A contact sheet is one continuous surface; the hairline
  between rows does the dividing. Identical bordered boxes would flatten
  tasks, deadlines, and events into the same visual object and destroy the
  hierarchy that makes the sheet readable.
*/

export function TaskRow({ task, ...refProps }: { task: Task } & RefProps) {
  return (
    <li className="border-t border-rule py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-ink">{task.title}</h4>
          {task.description && (
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              {task.description}
            </p>
          )}
        </div>
        <Severity value={task.priority} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {task.deadline && (
          <span className="text-xs text-ink-2">Due {formatDate(task.deadline)}</span>
        )}
        <FrameRef
          source={task.source}
          index={refProps.frameIndex}
          onSelect={refProps.onSelectSource}
        />
      </div>
    </li>
  );
}

export function DeadlineRow({
  deadline,
  ...refProps
}: { deadline: Deadline } & RefProps) {
  return (
    <li className="border-t border-rule py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="font-medium text-ink">{deadline.title}</h4>
        <span className="shrink-0 text-sm tabular-nums text-ink">
          {formatDate(deadline.date)}
        </span>
      </div>
      <div className="mt-2">
        <FrameRef
          source={deadline.source}
          index={refProps.frameIndex}
          onSelect={refProps.onSelectSource}
        />
      </div>
    </li>
  );
}

export function EventRow({ event, ...refProps }: { event: Event } & RefProps) {
  return (
    <li className="border-t border-rule py-3 first:border-t-0">
      <div className="flex items-baseline justify-between gap-4">
        <h4 className="font-medium text-ink">{event.title}</h4>
        <span className="shrink-0 text-sm text-ink-2">
          {event.time ?? formatDate(event.date)}
        </span>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {event.time && event.date && <span>{formatDate(event.date)}</span>}
        {event.location && <span>{event.location}</span>}
      </div>

      <div className="mt-2">
        <FrameRef
          source={event.source}
          index={refProps.frameIndex}
          onSelect={refProps.onSelectSource}
        />
      </div>
    </li>
  );
}

/**
 * A conflict, ringed in grease pencil.
 *
 * This is the only element in the design allowed to use that colour, which is
 * why it lands. A card with a red border would just be another card; a
 * hand-drawn circle is a person saying "look here".
 */
export function ConflictMark({ conflict }: { conflict: Conflict }) {
  return (
    <li className="border-l-2 border-grease bg-grease-wash py-4 pl-5">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-semibold text-ink">{conflict.title}</h4>
        <Severity value={conflict.severity} />
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
        {conflict.explanation}
      </p>

      {conflict.related_items.length > 0 && (
        <ul className="mt-3 space-y-1">
          {conflict.related_items.map((item) => (
            <li key={item} className="flex items-baseline gap-2 text-xs text-ink-2">
              <span aria-hidden="true" className="text-grease">
                —
              </span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * The plan, as a numbered ledger.
 *
 * Numbering is warranted here because the plan is a real ordered sequence,
 * not a decorative list. Each row states its reason so the ordering can be
 * argued with rather than merely obeyed.
 */
export function PlanRow({ item }: { item: PlanItem }) {
  return (
    <li className="grid grid-cols-[2.5rem_1fr] gap-x-4 border-t border-rule py-4 first:border-t-0">
      <span className="sleeve-label pt-1 text-ink-2 tabular-nums">
        {String(item.order).padStart(2, "0")}
      </span>

      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <h4 className="font-medium text-ink">{item.action}</h4>
          <Severity value={item.priority} />
        </div>

        <p className="mt-1 text-sm leading-relaxed text-ink-2">{item.reason}</p>

        {item.deadline && (
          <p className="mt-1.5 text-xs text-ink-3">
            Due {formatDate(item.deadline)}
          </p>
        )}
      </div>
    </li>
  );
}