import { NextResponse } from "next/server";
import { analyzeSignals } from "@/lib/scout/analysis";
import { sendBattlecard } from "@/lib/scout/email";
import {
  fetchArxivPapers,
  fetchGitHubRepos,
  fetchHackerNews,
} from "@/lib/scout/sources";
import type {
  ScoutErrorResponse,
  ScoutRequest,
  ScoutResponse,
  ScoutStats,
  ScoutTraceEntry,
} from "@/lib/scout/types";

// `cacheComponents` is enabled in next.config.ts, so route-segment `runtime`
// and `dynamic` exports are rejected. POST handlers are always dynamic.
export const maxDuration = 60;

const MODES = new Set(["rapid", "recon", "deep-dive"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function jsonError(
  error: string,
  status: number,
  detail?: string,
  trace?: ScoutTraceEntry[],
) {
  return NextResponse.json<ScoutErrorResponse>(
    { success: false, error, detail, trace },
    { status },
  );
}

function daysSince(iso: string): number | null {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function buildStats(
  repos: ScoutResponse["items"]["repositories"],
  papers: ScoutResponse["items"]["papers"],
  discussions: ScoutResponse["items"]["discussions"],
): ScoutStats {
  const totalSignals = repos.length + papers.length + discussions.length;
  const combinedStars = repos.reduce((sum, repo) => sum + repo.stars, 0);
  const avgPoints =
    discussions.length === 0
      ? 0
      : discussions.reduce((sum, thread) => sum + thread.points, 0) /
        discussions.length;

  const dates = [
    ...repos.map((repo) => repo.pushedAt),
    ...papers.map((paper) => paper.published),
    ...discussions.map((thread) => thread.createdAt),
  ]
    .map(daysSince)
    .filter((value): value is number => value !== null);

  return {
    totalSignals,
    combinedStars,
    avgPoints: Number(avgPoints.toFixed(1)),
    freshestSignalDays: dates.length ? Math.min(...dates) : null,
  };
}

export async function POST(request: Request) {
  const trace: ScoutTraceEntry[] = [];
  const bootStart = Date.now();

  let payload: ScoutRequest;
  try {
    payload = (await request.json()) as ScoutRequest;
  } catch {
    return jsonError("Malformed JSON body", 400, "Body must be valid JSON.");
  }

  const topic = typeof payload?.topic === "string" ? payload.topic.trim() : "";
  const rawMode = typeof payload?.mode === "string" ? payload.mode.trim() : "";
  const mode = MODES.has(rawMode) ? rawMode : "recon";
  const alertEmail =
    typeof payload?.alertEmail === "string" ? payload.alertEmail.trim() : "";

  if (topic.length < 2) {
    return jsonError(
      "Topic is required",
      400,
      "Provide a topic of at least 2 characters.",
    );
  }
  if (topic.length > 200) {
    return jsonError(
      "Topic is too long",
      422,
      "Keep the topic under 200 characters.",
    );
  }
  if (alertEmail && !EMAIL_RE.test(alertEmail)) {
    return jsonError(
      "Invalid alert email",
      422,
      "alertEmail must be a valid address or omitted.",
    );
  }

  trace.push({
    step: "ingest",
    status: "ok",
    detail: `topic="${topic}" mode=${mode} alert=${alertEmail ? "on" : "off"}`,
    ms: Date.now() - bootStart,
  });

  /* --- concurrent scrape ------------------------------------------- */
  const scrapeStart = Date.now();
  const [github, arxiv, hackernews] = await Promise.all([
    fetchGitHubRepos(topic),
    fetchArxivPapers(topic),
    fetchHackerNews(topic),
  ]);

  const sources = {
    github: {
      ok: github.ok,
      count: github.items.length,
      latencyMs: github.latencyMs,
      error: github.error,
    },
    arxiv: {
      ok: arxiv.ok,
      count: arxiv.items.length,
      latencyMs: arxiv.latencyMs,
      error: arxiv.error,
    },
    hackernews: {
      ok: hackernews.ok,
      count: hackernews.items.length,
      latencyMs: hackernews.latencyMs,
      error: hackernews.error,
    },
  };

  for (const [name, source] of Object.entries(sources)) {
    trace.push({
      step: `scrape:${name}`,
      status: source.ok ? (source.count > 0 ? "ok" : "warn") : "error",
      detail: source.error ?? `${source.count} signals`,
      ms: source.latencyMs,
    });
  }

  const stats = buildStats(github.items, arxiv.items, hackernews.items);

  if (stats.totalSignals === 0) {
    trace.push({
      step: "scrape:total",
      status: "error",
      detail: "All upstream sources returned zero signals",
      ms: Date.now() - scrapeStart,
    });
    return jsonError(
      "No live signals found",
      502,
      `GitHub, arXiv and Hacker News returned nothing usable for "${topic}". Try a broader or differently-worded topic.`,
      trace,
    );
  }

  /* --- AI analysis -------------------------------------------------- */
  const analysisStart = Date.now();
  const result = await analyzeSignals(
    topic,
    mode,
    github.items,
    arxiv.items,
    hackernews.items,
  );

  const aiDetail = result.note ?? `${result.model} · threat ${result.analysis.threatScore}`;
  trace.push({
    step: `ai:${result.engine}`,
    status: result.engine === "gemini" ? "ok" : "warn",
    detail: aiDetail.length > 240 ? `${aiDetail.slice(0, 239)}…` : aiDetail,
    ms: Date.now() - analysisStart,
  });

  const analysis = result.analysis;

  /* --- email dispatch ---------------------------------------------- */
  const generatedAt = new Date().toISOString();
  const email = alertEmail
    ? await sendBattlecard({
        to: alertEmail,
        topic,
        mode,
        analysis,
        repos: github.items,
        papers: arxiv.items,
        discussions: hackernews.items,
        stats,
        generatedAt,
      })
    : { requested: false, sent: false, to: null };

  if (email.requested) {
    trace.push({
      step: "email",
      status: email.sent ? "ok" : "error",
      detail: email.error ?? `delivered to ${email.to}`,
      ms: 0,
    });
  }

  trace.push({
    step: "complete",
    status: "ok",
    detail: `${stats.totalSignals} signals · ${stats.combinedStars.toLocaleString()} stars`,
    ms: Date.now() - bootStart,
  });

  return NextResponse.json<ScoutResponse>(
    {
      success: true,
      topic,
      mode,
      generatedAt,
      items: {
        repositories: github.items,
        papers: arxiv.items,
        discussions: hackernews.items,
      },
      analysis,
      ai: {
        model: result.model,
        engine: result.engine,
        latencyMs: result.latencyMs,
        note: result.note,
      },
      email,
      sources,
      stats,
      trace,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Scout-Engine": result.engine,
      },
    },
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "Method not allowed",
      detail: "POST { topic, alertEmail?, mode? } to this endpoint.",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
