/**
 * Shared contracts for the SCOUT intel pipeline.
 * Used by the route handler, the email builder and the dashboard.
 */

export type ScoutMode = "rapid" | "recon" | "deep-dive";

export interface ScoutRequest {
  topic: string;
  alertEmail?: string;
  mode?: ScoutMode | string;
}

export interface RepoSignal {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  topics: string[];
  pushedAt: string;
  createdAt: string;
  owner: string;
  license: string | null;
}

export interface PaperSignal {
  id: string;
  title: string;
  summary: string;
  url: string;
  published: string;
  updated: string;
  authors: string[];
  categories: string[];
}

export interface DiscussionSignal {
  id: string;
  title: string;
  url: string;
  author: string;
  points: number;
  comments: number;
  createdAt: string;
}

export interface SourceStatus {
  ok: boolean;
  count: number;
  latencyMs: number;
  error?: string;
}

export interface ScoutAnalysis {
  /** 0 = wide open, 100 = fully saturated */
  threatScore: number;
  sentiment: string;
  /** What not to build — already owned by incumbents */
  killZone: string;
  /** Unbuilt research gaps / defensible wedge */
  whiteSpaceMoat: string;
  /** What changed in the last window */
  deltaAlert: string;
}

export interface ScoutEmailStatus {
  requested: boolean;
  sent: boolean;
  to: string | null;
  messageId?: string;
  error?: string;
}

export interface ScoutTraceEntry {
  step: string;
  status: "ok" | "warn" | "error";
  detail: string;
  ms: number;
}

export interface ScoutStats {
  totalSignals: number;
  combinedStars: number;
  avgPoints: number;
  freshestSignalDays: number | null;
}

export interface ScoutResponse {
  success: true;
  topic: string;
  mode: string;
  generatedAt: string;
  items: {
    repositories: RepoSignal[];
    papers: PaperSignal[];
    discussions: DiscussionSignal[];
  };
  analysis: ScoutAnalysis;
  ai: {
    model: string;
    engine: "gemini" | "heuristic";
    latencyMs: number;
    note?: string;
  };
  email: ScoutEmailStatus;
  sources: {
    github: SourceStatus;
    arxiv: SourceStatus;
    hackernews: SourceStatus;
  };
  stats: ScoutStats;
  trace: ScoutTraceEntry[];
}

export interface ScoutErrorResponse {
  success: false;
  error: string;
  detail?: string;
  trace?: ScoutTraceEntry[];
}


/* ---------- Autonomous Task Engine ---------- */

export type TaskStatus =
  | "pending"
  | "running"
  | "testing"
  | "completed"
  | "failed"
  | "blocked";

export type JobStatus =
  | "queued"
  | "researching"
  | "planning"
  | "executing"
  | "completed"
  | "failed"
  | "blocked";

export interface ScoutTask {
  id: string;
  jobId: string;
  title: string;
  description: string;
  priority: number;
  status: TaskStatus;
  dependencies: string[];
  acceptanceCriteria: string[];
  attempts: number;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScoutExecutionLog {
  id: string;
  jobId: string;
  taskId?: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export interface ScoutJob {
  id: string;
  topic: string;
  status: JobStatus;
  tasks: ScoutTask[];
  logs: ScoutExecutionLog[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface CreateScoutJobRequest {
  topic: string;
  mode?: ScoutMode;
  alertEmail?: string;
}

export interface ScoutJobResponse {
  success: boolean;
  job?: ScoutJob;
  error?: string;
}
