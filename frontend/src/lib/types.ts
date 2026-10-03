/**
 * Types mirroring the backend Pydantic schemas (SPEC §7, §22, §23).
 *
 * Kept hand-written rather than generated so the frontend stays a thin HTTP
 * client with no code-generation step in a 2-hour build.
 */

export type Priority = "high" | "medium" | "low";

export interface Task {
  title: string;
  description: string | null;
  deadline: string | null;
  priority: Priority;
  source: string;
}

export interface Event {
  title: string;
  date: string | null;
  time: string | null;
  location: string | null;
  source: string;
}

export interface Deadline {
  title: string;
  date: string;
  source: string;
}

export interface Conflict {
  title: string;
  explanation: string;
  related_items: string[];
  severity: Priority;
}

export interface PlanItem {
  order: number;
  action: string;
  reason: string;
  priority: Priority;
  deadline: string | null;
}

export interface LifeOSAnalysis {
  summary: string;
  tasks: Task[];
  events: Event[];
  deadlines: Deadline[];
  conflicts: Conflict[];
  plan: PlanItem[];
}

export interface AnalyzeResponse {
  success: boolean;
  analysis: LifeOSAnalysis;
}

/** The subset of the analysis the assistant may reason over (SPEC §14). */
export type ChatContext = Omit<LifeOSAnalysis, never>;

export interface ChatResponse {
  answer: string;
  sources: string[];
}

/** UI state machine (SPEC §29). */
export type AppState = "EMPTY" | "READY" | "ANALYZING" | "RESULT" | "ERROR";