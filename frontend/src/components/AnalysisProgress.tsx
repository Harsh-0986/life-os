"use client";

import { useEffect, useRef, useState } from "react";

/*
  The annotation pass.

  A contact sheet is only useful once someone has marked it up, so this reads
  as the marking-up step. SPEC §29 requires these five labels, and they are
  driven by a timer rather than extra model calls: the request is a single
  Gemma call, so a progress bar that reflected real stages would be lying.
*/

const STAGES = [
  "Frames received",
  "Reading the sheet",
  "Marking dates and tasks",
  "Circling clashes",
  "Writing the caption",
] as const;

export function AnalysisProgress() {
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    // Set inside the effect rather than during render to keep render pure.
    startedAt.current = Date.now();

    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);
      // Ramp toward the last label but never complete it, so the indicator
      // stays honest about work still in flight.
      setStage((current) =>
        Math.max(current, Math.min(STAGES.length - 1, Math.floor(seconds / 7))),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="mt-10 border-y-2 border-ink/15 py-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Reading your sheet
        </h2>
        <span className="sleeve-label text-ink-2 tabular-nums">
          {elapsed}s elapsed
        </span>
      </div>

      <ol className="mt-5 space-y-0">
        {STAGES.map((label, index) => {
          const done = index < stage;
          const active = index === stage;

          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-4 border-t border-rule py-2.5 text-sm",
                done && "text-ink-3",
                active && "font-semibold text-ink",
                !done && !active && "text-ink-3/60",
              )}
            >
              <span
                className={cn(
                  "sleeve-label w-6 shrink-0 tabular-nums",
                  done && "text-ink-3",
                  active && "text-grease",
                  !done && !active && "text-ink-3/50",
                )}
                aria-hidden="true"
              >
                {String(index + 1).padStart(2, "0")}
              </span>

              <span className="flex-1">{label}</span>

              {active && (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full bg-grease"
                  aria-hidden="true"
                />
              )}
              {done && <span className="sleeve-label text-ink-3">done</span>}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-sm text-ink-2">
        One request, every frame at once. Priorities and conflicts are then worked
        out in Python, not guessed at.
      </p>
    </section>
  );
}

/* Kept local: only this file needs the merge helper. */
function cn(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}