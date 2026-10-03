"use client";

import { useCallback, useRef, useState } from "react";

import { formatBytes, cn } from "@/lib/utils";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

export interface SelectedImage {
  file: File;
  /** Object URL for the preview; revoked on removal. */
  previewUrl: string;
}

interface UploadZoneProps {
  images: SelectedImage[];
  onChange: (images: SelectedImage[]) => void;
  disabled?: boolean;
}

export function UploadZone({ images, onChange, disabled }: UploadZoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming?.length) return;
      setError(null);

      const next = [...images];

      for (const file of Array.from(incoming)) {
        if (next.length >= MAX_FILES) {
          setError(`You can upload ${MAX_FILES} images at a time.`);
          break;
        }
        if (!ACCEPTED.includes(file.type)) {
          setError(`${file.name} is not a PNG, JPEG, or WEBP.`);
          continue;
        }
        if (file.size > MAX_FILE_BYTES) {
          setError(`${file.name} is ${formatBytes(file.size)}; the limit is 10 MB.`);
          continue;
        }
        // Guard against the same file being added twice.
        if (next.some((existing) => existing.file.name === file.name)) continue;

        next.push({
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }

      onChange(next);
    },
    [images, onChange],
  );

  const removeAt = useCallback(
    (index: number) => {
      setError(null);
      onChange(
        images
          .filter((_, i) => i !== index)
          .map((image) => {
            URL.revokeObjectURL(image.previewUrl);
            return image;
          }),
      );
    },
    [images, onChange],
  );

  const clearAll = useCallback(() => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setError(null);
    onChange([]);
  }, [images, onChange]);

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border-2 border-dashed px-6 py-12 text-center transition",
          dragging
            ? "border-emerald-400/70 bg-emerald-500/10"
            : "border-neutral-700 bg-neutral-900/40",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);
            // Reset so re-picking the same file still fires a change event.
            event.target.value = "";
          }}
        />

        <div className="space-y-3">
          <p className="text-lg font-medium text-neutral-100">
            {images.length > 0
              ? "Add more screenshots"
              : "Drop screenshots here"}
          </p>
          <p className="mx-auto max-w-md text-sm text-neutral-400">
            Assignments, calendars, group chats, invoices. Up to {MAX_FILES}{" "}
            images, 10 MB each. Gemma reads them all together.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || images.length >= MAX_FILES}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Browse files
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-400">
            {images.length} of {MAX_FILES} images selected
          </p>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="text-sm text-neutral-400 underline-offset-4 transition hover:text-neutral-200 hover:underline disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}