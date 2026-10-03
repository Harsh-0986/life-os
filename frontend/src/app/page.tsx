"use client";

import { useCallback, useState } from "react";

import { AnalysisProgress } from "@/components/AnalysisProgress";
import { ChatPanel } from "@/components/ChatPanel";
import {
  ConflictCard,
  DeadlineCard,
  EventCard,
  PlanCard,
  TaskCard,
} from "@/components/Cards";
import { ImagePreview } from "@/components/ImagePreview";
import { SourcePreview } from "@/components/SourcePreview";
import { UploadZone, type SelectedImage } from "@/components/UploadZone";
import { analyzeImages } from "@/lib/api";
import type { AppState, LifeOSAnalysis } from "@/lib/types";

export default function Page() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [analysis, setAnalysis] = useState<LifeOSAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // SPEC §29 state machine, derived rather than stored so it cannot drift.
  const state: AppState = loading
    ? "ANALYZING"
    : error
      ? "ERROR"
      : analysis
        ? "RESULT"
        : images.length > 0
          ? "READY"
          : "EMPTY";

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      const { analysis: result } = await analyzeImages(
        images.map((image) => image.file),
      );
      setAnalysis(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Analysis failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [images]);

  const handleReset = useCallback(() => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setAnalysis(null);
    setError(null);
    setActiveSource(null);
  }, [images]);

  const isBusy = state === "ANALYZING";

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold tracking-tight">LifeOS</h1>
          <p className="mt-2 max-w-2xl text-neutral-400">
            Drop in screenshots of your assignments, calendar, and messages.
            Gemma reads them all together, pulls out what matters, and a
            deterministic planner turns it into an ordered action plan.
          </p>
        </header>

        {state !== "RESULT" && (
          <section className="space-y-6">
            <UploadZone images={images} onChange={setImages} disabled={isBusy} />

            <ImagePreview
              images={images}
              onRemove={(index) =>
                setImages((current) =>
                  current.filter((_, i) => i !== index),
                )
              }
              activeSource={activeSource}
              onSelectSource={setActiveSource}
              disabled={isBusy}
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void handleAnalyze()}
                disabled={images.length === 0 || isBusy}
                className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isBusy ? "Analyzing…" : `Analyze ${images.length || ""} image${images.length === 1 ? "" : "s"}`}
              </button>

              {images.length > 0 && !isBusy && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-neutral-400 underline-offset-4 hover:text-neutral-200 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            {isBusy && <AnalysisProgress />}

            {error && (
              <div
                role="alert"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
              >
                <p className="font-medium text-rose-300">Analysis failed</p>
                <p className="mt-1 text-sm text-rose-200/80">{error}</p>
                <p className="mt-2 text-xs text-rose-200/60">
                  Check that the backend is running on port 8000 and that
                  GEMINI_API_KEY is set.
                </p>
              </div>
            )}
          </section>
        )}

        {state === "RESULT" && analysis && (
          <div className="space-y-10">
            <section>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-medium">Your analysis</h2>
                  <p className="mt-2 max-w-3xl text-neutral-400">
                    {analysis.summary}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-500"
                >
                  Start over
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                {(
                  [
                    ["Tasks", analysis.tasks.length],
                    ["Deadlines", analysis.deadlines.length],
                    ["Events", analysis.events.length],
                    ["Conflicts", analysis.conflicts.length],
                  ] as const
                ).map(([label, count]) => (
                  <span
                    key={label}
                    className="rounded-full bg-neutral-800 px-3 py-1 text-neutral-300"
                  >
                    {count} {label.toLowerCase()}
                  </span>
                ))}
              </div>
            </section>

            {analysis.conflicts.length > 0 && (
              <section>
                <h3 className="mb-3 text-lg font-medium text-neutral-100">
                  Conflicts detected
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {analysis.conflicts.map((conflict, index) => (
                    <ConflictCard
                      key={`${conflict.title}-${index}`}
                      conflict={conflict}
                      activeSource={activeSource}
                      onSelectSource={setActiveSource}
                    />
                  ))}
                </div>
              </section>
            )}

            {analysis.plan.length > 0 && (
              <section>
                <h3 className="mb-1 text-lg font-medium text-neutral-100">
                  Action plan
                </h3>
                <p className="mb-3 text-sm text-neutral-500">
                  Ordered in Python, not by the model.
                </p>
                <ol className="space-y-3">
                  {analysis.plan.map((item) => (
                    <PlanCard
                      key={item.order}
                      item={item}
                      total={analysis.plan.length}
                    />
                  ))}
                </ol>
              </section>
            )}

            <div className="grid gap-8 lg:grid-cols-2">
              {analysis.tasks.length > 0 && (
                <section>
                  <h3 className="mb-3 text-lg font-medium text-neutral-100">
                    Tasks
                  </h3>
                  <div className="space-y-3">
                    {analysis.tasks.map((task, index) => (
                      <TaskCard
                        key={`${task.title}-${index}`}
                        task={task}
                        activeSource={activeSource}
                        onSelectSource={setActiveSource}
                      />
                    ))}
                  </div>
                </section>
              )}

              <div className="space-y-8">
                {analysis.deadlines.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-lg font-medium text-neutral-100">
                      Deadlines
                    </h3>
                    <div className="space-y-3">
                      {analysis.deadlines.map((deadline, index) => (
                        <DeadlineCard
                          key={`${deadline.title}-${index}`}
                          deadline={deadline}
                          activeSource={activeSource}
                          onSelectSource={setActiveSource}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {analysis.events.length > 0 && (
                  <section>
                    <h3 className="mb-3 text-lg font-medium text-neutral-100">
                      Events
                    </h3>
                    <div className="space-y-3">
                      {analysis.events.map((event, index) => (
                        <EventCard
                          key={`${event.title}-${index}`}
                          event={event}
                          activeSource={activeSource}
                          onSelectSource={setActiveSource}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>

            <ChatPanel context={analysis} />
          </div>
        )}
      </div>

      <SourcePreview
        images={images}
        activeSource={activeSource}
        onClose={() => setActiveSource(null)}
      />
    </main>
  );
}