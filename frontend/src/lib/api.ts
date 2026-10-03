/**
 * Thin HTTP client for the LifeOS API.
 *
 * The browser only ever talks to FastAPI. The Gemini key stays on the
 * backend (SPEC §24), so there is deliberately no AI SDK here.
 */

import type { AnalyzeResponse, ChatContext, ChatResponse } from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

/** An error whose message is safe to show the user verbatim. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status}).`;

  try {
    const body = await response.json();
    const detail = body?.detail;

    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      // FastAPI validation errors arrive as a list of field problems.
      message = detail
        .map((item: { msg?: string }) => item.msg)
        .filter(Boolean)
        .join(" ");
    }
  } catch {
    // Non-JSON error body; keep the generic message.
  }

  return new ApiError(message, response.status);
}

/**
 * Upload images for analysis.
 *
 * The request has no timeout: SPEC §31 targets under 30 seconds for a normal
 * 3-5 image batch, and aborting a slow-but-progressing Gemma call would be
 * worse than waiting.
 */
export async function analyzeImages(files: File[]): Promise<AnalyzeResponse> {
  const body = new FormData();
  files.forEach((file) => body.append("files", file));

  const response = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    body,
  });

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as AnalyzeResponse;
}

/** Ask a question about a completed analysis. */
export async function askQuestion(
  question: string,
  context: ChatContext,
): Promise<ChatResponse> {
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });

  if (!response.ok) throw await toApiError(response);
  return (await response.json()) as ChatResponse;
}

/** Confirm the backend is up before attempting an upload. */
export async function checkHealth(): Promise<{
  status: string;
  model: string;
}> {
  const response = await fetch(`${BASE_URL}/api/health`);
  if (!response.ok) throw await toApiError(response);
  return response.json();
}