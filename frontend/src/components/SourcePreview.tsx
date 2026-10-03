"use client";

import { useEffect } from "react";

import type { SelectedImage } from "./UploadZone";

interface SourcePreviewProps {
  images: SelectedImage[];
  activeSource: string | null;
  onClose: () => void;
}

/**
 * Full-size view of the frame an item was read from.
 *
 * This is the trust surface of the whole product: every extracted task,
 * deadline, and event can be traced back to the exact screenshot it came
 * from (SPEC §30). It opens over the sheet like a loupe on a light table.
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
    // Stop the page behind the loupe from scrolling.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [activeSource, onClose]);

  const image = images.find((entry) => entry.file.name === activeSource);

  if (!activeSource || !image) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Frame ${activeSource}`}
      className="fixed inset-0 z-50 flex flex-col bg-film/95"
      onClick={onClose}
    >
      <div className="flex items-center justify-between border-b border-paper/15 px-5 py-3">
        <div className="min-w-0">
          <p className="sleeve-label text-paper/50">Source frame</p>
          <p className="truncate text-sm text-paper">{activeSource}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="sleeve-label border border-paper/30 px-3 py-1.5 text-paper transition hover:border-grease hover:text-grease"
        >
          Close
        </button>
      </div>

      <div
        className="flex flex-1 items-center justify-center overflow-auto p-5"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Object URL from the validated upload; a plain img is correct here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.previewUrl}
          alt={image.file.name}
          className="max-h-full max-w-full border border-paper/20 object-contain"
        />
      </div>
    </div>
  );
}