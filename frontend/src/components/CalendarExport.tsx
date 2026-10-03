"use client";

import type { Event } from "@/lib/types";

/**
 * Explains what the calendar export will and will not contain.
 *
 * The download link itself lives in the header beside the wordmark. This
 * section sits under the events so it can answer the question the link
 * raises: why is my event not in there?
 */
export function CalendarExport({ events }: { events: Event[] }) {
  const dated = events.filter((event) => event.date);
  const undated = events.filter((event) => !event.date);
  const noTime = dated.filter((event) => !event.time);

  // Nothing dated at all: say why rather than showing an inert section.
  if (dated.length === 0) {
    return (
      <section className="border-t border-rule pt-6">
        <h3 className="sleeve-label mb-1 text-ink-3">Calendar</h3>
        <p className="text-sm leading-relaxed text-ink-2">
          {undated.length === 0
            ? "No events were found on this sheet."
            : `None of the ${undated.length} ${
                undated.length === 1 ? "event has" : "events have"
              } a readable date, so there is nothing to put on a calendar. LifeOS will not guess a date — if the source said something like "tomorrow" or "next week", the exact date has to come from you.`}
        </p>
        {undated.length > 0 && (
          <ul className="mt-3 space-y-1">
            {undated.map((event, index) => (
              <li key={`${event.title}-${index}`} className="text-sm text-ink-2">
                <span className="text-ink-3">{event.title}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="border-t border-rule pt-6">
      <h3 className="sleeve-label mb-1 text-ink-3">Calendar</h3>
      <p className="text-sm leading-relaxed text-ink-2">
        {dated.length} dated {dated.length === 1 ? "event" : "events"} will be
        exported from the header link.{" "}
        {noTime.length > 0 &&
          `${noTime.length} ${
            noTime.length === 1 ? "has" : "have"
          } no time in the source and will be placed at 09:00, marked as an assumption in the entry.`}
      </p>

      {undated.length > 0 && (
        <p className="mt-2 text-sm text-ink-3">
          {undated.length} without a date{" "}
          {undated.length === 1 ? "is" : "are"} left out:{" "}
          {undated.map((event) => event.title).join(", ")}.
        </p>
      )}
    </section>
  );
}