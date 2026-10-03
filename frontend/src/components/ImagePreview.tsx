"use client";

import { cn } from "@/lib/utils";
import type { SelectedImage } from "./UploadZone";

interface ImagePreviewProps {
  images: SelectedImage[];
  onRemove: (index: number) => void;
  /** Filename to highlight as the currently viewed source image. */
  activeSource?: string | null;
  onSelectSource?: (filename: string | null) => void;
  disabled?: boolean;
}

export function ImagePreview({
  images,
  onRemove,
  activeSource,
  onSelectSource,
  disabled,
}: ImagePreviewProps) {
  if (images.length === 0) return null;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
                "block w-full overflow-hidden rounded-lg border text-left transition",
                isActive
                  ? "border-emerald-400 ring-2 ring-emerald-400/40"
                  : "border-neutral-800 hover:border-neutral-600",
              )}
            >
              {/* Object URLs are already validated to png/jpeg/webp by the zone. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt={image.file.name}
                className="h-28 w-full object-cover"
              />
              <span className="block truncate px-2 py-1.5 text-xs text-neutral-400">
                {image.file.name}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={disabled}
              aria-label={`Remove ${image.file.name}`}
              className="absolute right-1.5 top-1.5 rounded-full bg-neutral-950/80 p-1 text-neutral-300 opacity-0 transition group-hover:opacity-100 hover:text-rose-400 focus-visible:opacity-100 disabled:pointer-events-none"
            >
              <svg
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        );
      })}
    </ul>
  );
}