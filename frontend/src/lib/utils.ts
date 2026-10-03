import { clsx, type ClassValue } from "clsx";

/** Merge conditional class names. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
  medium: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  low: "bg-sky-500/10 text-sky-300 ring-sky-500/30",
};

/** Badge styling for a priority or severity value. */
export function priorityStyle(value: string): string {
  return PRIORITY_STYLES[value] ?? PRIORITY_STYLES.low;
}

/**
 * Render an ISO date as a short human string.
 *
 * Returns the input unchanged when it cannot be parsed, so an ambiguous date
 * read off a screenshot is shown as-is rather than being silently mangled.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "No date";

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

/** Bytes to a human-readable size. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}