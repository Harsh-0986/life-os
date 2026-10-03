"use client";

import { useCallback, useRef, useState } from "react";

import { cn, formatBytes } from "@/lib/utils";

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
          setError(`A sheet holds ${MAX_FILES} frames.`);
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
        if (next.some((existing) => existing.file.name === file.name)) continue;

        next.push({ file, previewUrl: URL.createObjectURL(file) });
      }

      onChange(next);
    },
    [images, onChange],
  );

  const clearAll = useCallback(() => {
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setError(null);
    onChange([]);
  }, [images, onChange]);

  const full = images.length >= MAX_FILES;

  return (
    <div>
      {/*
        Dashed rule rather than a filled dropzone. The sheet is the surface;
        this is an empty area waiting for frames, not a separate object.
      */}
      <label
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
          "block cursor-pointer border-y-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging
            ? "border-grease bg-grease-wash"
            : "border-rule-strong bg-paper-raised hover:border-ink-3",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          multiple
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            addFiles(event.target.files);
            // Reset so re-picking the same file still fires a change event.
            event.target.value = "";
          }}
        />

        <p className="text-lg font-semibold tracking-tight text-ink">
          {images.length > 0 ? "Add more frames" : "Lay your screenshots on the sheet"}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-2">
          Assignments, calendars, group chats, anything you are juggling. Up to{" "}
          {MAX_FILES} images, 10 MB each. Gemma reads every frame at once, so it
          can find the clashes between them.
        </p>
        <span className="sleeve-label mt-5 inline-block border border-ink px-4 py-2 text-ink">
          Choose files
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-grease">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="sleeve-label text-ink-2">
            {images.length} of {MAX_FILES} frames
          </p>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled}
            className="sleeve-label text-ink-2 underline-offset-4 hover:text-grease hover:underline disabled:opacity-40"
          >
            Clear sheet
          </button>
        </div>
      )}

      {full && (
        <p className="mt-1 text-xs text-ink-3">
          The sheet is full. Remove a frame to swap one out.
        </p>
      )}
    </div>
  );
}