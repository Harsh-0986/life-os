"use client";

import { cn, frameNumber } from "@/lib/utils";
import type { SelectedImage } from "./UploadZone";

interface ImagePreviewProps {
  images: SelectedImage[];
  onRemove: (index: number) => void;
  /** Filename of the frame currently open in SourcePreview. */
  activeSource?: string | null;
  onSelectSource?: (filename: string | null) => void;
  disabled?: boolean;
}

/**
 * The laid-out frames.
 *
 * Numbered because the images are a genuine sequence: they are read in order,
 * and the numerals are how a caption later refers back to a specific frame.
 */
export function ImagePreview({
  images,
  onRemove,
  activeSource,
  onSelectSource,
  disabled,
}: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <div className="mt-6">
      {/* Sprocket edge above the strip, as on a real sheet of film. */}
      <div className="sprocket-edge mb-2 opacity-25" aria-hidden="true" />

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {images.map((image, index) => {
          const isActive = activeSource === image.file.name;

          return (
            <li key={`${image.file.name}-${index}`} className="group relative">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelectSource?.(isActive ? null : image.file.name)}
                aria-pressed={isActive}
                className={cn(
                  "block w-full border bg-paper-raised text-left transition",
                  isActive
                    ? "border-grease ring-1 ring-grease/40"
                    : "border-rule hover:border-ink-3",
                )}
              >
                <span className="block border-b border-rule px-2 py-1">
                  <span className="sleeve-label text-ink-2">
                    {frameNumber(index)}
                  </span>
                </span>

                {/* Object URLs are pre-validated to png/jpeg/webp upstream. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={image.file.name}
                  className="h-24 w-full object-cover"
                />

                <span className="block truncate px-2 py-1.5 text-xs text-ink-2">
                  {image.file.name}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={`Remove frame ${index + 1}, ${image.file.name}`}
                className="absolute right-1 top-1 border border-rule bg-paper-raised px-1.5 py-0.5 text-ink-3 opacity-0 transition hover:border-grease hover:text-grease group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none"
              >
                Remove
              </button>
            </li>
          );
        })}
      </ul>

      <div className="sprocket-edge mt-2 opacity-25" aria-hidden="true" />
    </div>
  );
}