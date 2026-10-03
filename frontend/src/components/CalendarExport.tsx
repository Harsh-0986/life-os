"use client";

import { calendarExportUrl } from "@/lib/api";
import type { Event } from "@/lib/types";

/**
 * Calendar export.
 *
 * Produces a real iCalendar file the user imports into Google, Apple, or
 * Outlook Calendar. This is deliberately a file rather than a direct API
 * write: OAuth would mean a Cloud project, a consent screen, and somewhere to
 * keep a per-user token, and SPEC §32 rules out a database.
 *
 * Only dated events are exported, and the button is hidden when there are
 * none, so it never offers a download that will fail.
 */
export function CalendarExport({ events }: { events: Event[] }) {
  const dated = events.filter((event) => event.date);
  const assumed = dated.filter((event) => !event.time).length;
  const url = calendarExportUrl(events);

  if (!url) return null;

  return (
    <section className="border-t border-rule pt-6">
      <h3 className="sleeve-label mb-1 text-ink-3">Calendar</h3>
      <p className="mb-4 text-sm text-ink-2">
        {dated.length} dated {dated.length === 1 ? "event" : "events"} ready to import.
        {assumed > 0 && ` ${assumed} had no time in the source and are set to 09:00.`}
      </p>

      <a
        href={url}
        download="lifeos.ics"
        className="sleeve-label inline-block border-2 border-ink px-5 py-3 text-ink transition hover:bg-ink hover:text-paper"
      >
        Download calendar file
      </a>

      <p className="mt-3 text-xs leading-relaxed text-ink-3">
        Open the file and your calendar app will offer to import it. Nothing is sent
        to Google or any other service.
      </p>
    </section>
  );
}