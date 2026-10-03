"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";
import type { SelectedImage } from "./UploadZone";

interface SourcePreviewProps {
  images: SelectedImage[];
  activeSource: string | null;
  onClose: () => void;
}

/**
 * Full-size view of the image an extracted item came from (SPEC §30).
 *
 * Rendered as a dialog so the user can trace any task or deadline back to the
 * screenshot it was read from — the check that the extraction is trustworthy.
 */
export function SourcePreview({
  images,
  activeSource,
  onClose,
}: SourcePreviewProps) {
  useEffect(() => {
    if (!activeSource) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    // Prevent the page behind the overlay from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [activeSource, onClose]);

  const image = images.find((entry) => entry.file.name === activeSource);

  if (!activeSource || !image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Source image ${activeSource}`}
      className="fixed inset-0 z-50 flex flex-col bg-neutral-950/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm text-neutral-200">
            {activeSource}
          </p>
          <p className="text-xs text-neutral-500">Source image</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className={cn(
            "rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100",
          )}
          aria-label="Close source preview"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-auto p-4"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Object URL from the validated upload; a plain img is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.previewUrl}
          alt={image.file.name}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
      </div>
    </div>
  );
}