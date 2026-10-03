"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const STAGES = [
  "Images received",
  "Understanding context",
  "Extracting information",
  "Detecting conflicts",
  "Building action plan",
] as const;

interface AnalysisProgressProps {
  /** Total analysis time in seconds; drives the elapsed counter. */
  estimateSeconds?: number;
}

export function AnalysisProgress({ estimateSeconds = 30 }: AnalysisProgressProps) {
  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number>(0);

  // SPEC §29: these are presentation states driven by a timer, not extra
  // model calls. The request itself is a single Gemma call.
  useEffect(() => {
    // Set inside the effect rather than during render to keep render pure.
    startedAt.current = Date.now();

    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(seconds);

      // Ramp toward the final stage but never complete it, so the indicator
      // stays honest about work that is still in flight.
      const target = Math.min(STAGES.length - 1, Math.floor(seconds / 8));
      setStage((current) => Math.max(current, target));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const remaining = Math.max(0, estimateSeconds - elapsed);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-6">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="font-medium text-neutral-100">Analyzing your images</h3>
        <span className="text-sm tabular-nums text-neutral-500">
          {elapsed}s
          {remaining > 0 && ` · ~${remaining}s left`}
        </span>
      </div>

      <ol className="space-y-2.5">
        {STAGES.map((label, index) => {
          const state =
            index < stage ? "done" : index === stage ? "active" : "pending";

          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 text-sm transition-colors",
                state === "done" && "text-neutral-400",
                state === "active" && "text-neutral-100",
                state === "pending" && "text-neutral-600",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  state === "done" && "bg-emerald-500/20 text-emerald-400",
                  state === "active" && "bg-neutral-100 text-neutral-900",
                  state === "pending" && "bg-neutral-800 text-neutral-500",
                )}
                aria-hidden="true"
              >
                {state === "done" ? (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    className="h-3 w-3"
                  >
                    <path d="M3 8.5l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : state === "active" ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-900" />
                ) : (
                  index + 1
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 text-xs text-neutral-500">
        One multimodal request. Gemma reads every image together.
      </p>
    </div>
  );
}