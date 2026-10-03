import { clsx, type ClassValue } from "clsx";

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Severity treatment.
 *
 * Ink density carries the scale, not colour. Only genuine conflicts are
 * allowed to use grease pencil, so `high` stays reserved for them and the
 * rest step down through weight and shade.
 */
export function severityStyle(value: string): string {
  switch (value) {
    case "high":
      return "text-grease border-grease/40 bg-grease-wash font-semibold";
    case "medium":
      return "text-ink-2 border-rule-strong bg-paper-sunk font-semibold";
    default:
      return "text-ink-3 border-rule bg-transparent font-medium";
  }
}

/**
 * Render an ISO date as a short human string.
 *
 * Returns the input unchanged when it cannot be parsed, so an ambiguous date
 * read off a screenshot is shown as the model wrote it rather than being
 * silently mangled.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "No date";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Bytes as a human-readable size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Zero-padded frame number, as printed on a contact sheet. */
export function frameNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}