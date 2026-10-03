"use client";

import { useCallback, useState } from "react";

import { AnalysisProgress } from "@/components/AnalysisProgress";
import { CalendarExport } from "@/components/CalendarExport";
import { ChatPanel } from "@/components/ChatPanel";
import { ImagePreview } from "@/components/ImagePreview";
import {
  ConflictMark,
  DeadlineRow,
  EventRow,
  PlanRow,
  TaskRow,
} from "@/components/Rows";
import { SourcePreview } from "@/components/SourcePreview";
import { UploadZone, type SelectedImage } from "@/components/UploadZone";
import { analyzeImages, calendarExportUrl } from "@/lib/api";
import type { AppState, LifeOSAnalysis } from "@/lib/types";

/** Maps a source filename to its frame position, so citations read as numbers. */
function useFrameIndex(images: SelectedImage[]) {
  return useCallback(
    (source: string) =>
      images.findIndex((image) => image.file.name === source) >= 0
        ? images.findIndex((image) => image.file.name === source)
        : undefined,
    [images],
  );
}

export default function Page() {
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [analysis, setAnalysis] = useState<LifeOSAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeSource, setActiveSource] = useState<string | null>(null);

  const frameIndexOf = useFrameIndex(images);

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

  const handleRemove = useCallback((index: number) => {
    setImages((current) => {
      const target = current[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  }, []);

  const isBusy = state === "ANALYZING";

  // The nav link is hidden when nothing is exportable, so it never offers a
  // download that would fail. See CalendarExport for the in-page control.
  const datedEventCount =
    analysis?.events.filter((event) => event.date).length ?? 0;
  const calendarUrl = analysis
    ? calendarExportUrl(analysis.events)
    : null;

  return (
    <main className="min-h-screen bg-paper">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="border-b-2 border-ink pb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-5xl font-semibold tracking-tight text-ink">
              LifeOS
            </h1>

            {/*
              Calendar export sits beside the wordmark so it is reachable
              without scrolling past four sections. It is a link rather than a
              button because it hands the browser a file to download.
            */}
            {calendarUrl && (
              <a
                href={calendarUrl}
                download="lifeos.ics"
                className="sleeve-label border-2 border-ink px-4 py-2.5 text-ink transition hover:bg-ink hover:text-paper"
              >
                Export calendar
                <span className="ml-2 tabular-nums opacity-60">
                  {datedEventCount}
                </span>
              </a>
            )}
          </div>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">
            Lay your screenshots on one sheet. Gemma reads every frame at once,
            marks what is due, and circles the clashes. The plan is then worked out
            in Python, so the order is arithmetic rather than a guess.
          </p>
        </header>

        {state !== "RESULT" && (
          <section className="mt-10">
            <UploadZone images={images} onChange={setImages} disabled={isBusy} />

            <ImagePreview
              images={images}
              onRemove={handleRemove}
              activeSource={activeSource}
              onSelectSource={setActiveSource}
              disabled={isBusy}
            />

            {images.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => void handleAnalyze()}
                  disabled={isBusy}
                  className="sleeve-label border-2 border-ink bg-ink px-6 py-3 text-paper transition hover:bg-transparent hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBusy
                    ? "Reading"
                    : `Read ${images.length} frame${images.length === 1 ? "" : "s"}`}
                </button>

                {!isBusy && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="sleeve-label text-ink-2 underline-offset-4 hover:text-grease hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {isBusy && <AnalysisProgress />}

            {error && (
              <div
                role="alert"
                className="mt-8 border-l-2 border-grease bg-grease-wash py-4 pl-5"
              >
                <p className="font-semibold text-ink">Could not read the sheet</p>
                <p className="mt-1 text-sm text-ink-2">{error}</p>
                <p className="mt-2 text-sm text-ink-2">
                  Check that the API is running on port 8000 and that
                  GEMINI_API_KEY is set in backend/.env.
                </p>
              </div>
            )}
          </section>
        )}

        {state === "RESULT" && analysis && (
          <div className="mt-12">
            {/* The caption: what this sheet collectively represents. */}
            <section className="border-b-2 border-ink pb-8">
              <h2 className="sleeve-label mb-4 text-ink-3">What this says</h2>
              <p className="max-w-3xl text-xl leading-relaxed text-ink">
                {analysis.summary}
              </p>

              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                {(
                  [
                    ["Tasks", analysis.tasks.length],
                    ["Deadlines", analysis.deadlines.length],
                    ["Events", analysis.events.length],
                    ["Conflicts", analysis.conflicts.length],
                  ] as const
                ).map(([label, count]) => (
                  <div key={label} className="flex items-baseline gap-2">
                    <dt className="sleeve-label text-ink-3">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-ink">
                      {count}
                    </dd>
                  </div>
                ))}
              </dl>

              <button
                type="button"
                onClick={handleReset}
                className="sleeve-label mt-6 border border-rule px-3 py-1.5 text-ink-2 transition hover:border-ink hover:text-ink"
              >
                Start a new sheet
              </button>
            </section>

            {analysis.conflicts.length > 0 && (
              <section className="mt-12">
                <h2 className="sleeve-label mb-4 text-ink-3">
                  Circled on the sheet
                </h2>
                <ul className="space-y-4">
                  {analysis.conflicts.map((conflict, index) => (
                    <ConflictMark
                      key={`${conflict.title}-${index}`}
                      conflict={conflict}
                    />
                  ))}
                </ul>
              </section>
            )}

            {analysis.plan.length > 0 && (
              <section className="mt-12">
                <h2 className="sleeve-label mb-1 text-ink-3">The order</h2>
                <p className="mb-4 text-sm text-ink-2">
                  Sorted in Python by priority and deadline. The model extracted
                  the facts; it did not choose this sequence.
                </p>
                <ol>
                  {analysis.plan.map((item) => (
                    <PlanRow key={item.order} item={item} />
                  ))}
                </ol>
              </section>
            )}

            <div className="mt-12 space-y-10">
              {analysis.tasks.length > 0 && (
                <section>
                  <h2 className="sleeve-label mb-3 text-ink-3">Tasks</h2>
                  <ul>
                    {analysis.tasks.map((task, index) => (
                      <TaskRow
                        key={`${task.title}-${index}`}
                        task={task}
                        frameIndex={frameIndexOf(task.source)}
                        activeSource={activeSource}
                        onSelectSource={setActiveSource}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {analysis.deadlines.length > 0 && (
                <section>
                  <h2 className="sleeve-label mb-3 text-ink-3">Deadlines</h2>
                  <ul>
                    {analysis.deadlines.map((deadline, index) => (
                      <DeadlineRow
                        key={`${deadline.title}-${index}`}
                        deadline={deadline}
                        frameIndex={frameIndexOf(deadline.source)}
                        activeSource={activeSource}
                        onSelectSource={setActiveSource}
                      />
                    ))}
                  </ul>
                </section>
              )}

              {analysis.events.length > 0 && (
                <section>
                  <h2 className="sleeve-label mb-3 text-ink-3">Events</h2>
                  <ul>
                    {analysis.events.map((event, index) => (
                      <EventRow
                        key={`${event.title}-${index}`}
                        event={event}
                        frameIndex={frameIndexOf(event.source)}
                        activeSource={activeSource}
                        onSelectSource={setActiveSource}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <div className="mt-12 space-y-10">
              {/*
                The download link lives in the header beside the wordmark.
                This explains why an event may be missing from it.
              */}
              <CalendarExport events={analysis.events} />
              <ChatPanel context={analysis} />
            </div>
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