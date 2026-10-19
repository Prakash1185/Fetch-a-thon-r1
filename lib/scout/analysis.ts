import {
  GoogleGenerativeAI,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import type {
  DiscussionSignal,
  PaperSignal,
  RepoSignal,
  ScoutAnalysis,
} from "./types";

export interface AnalysisResult {
  analysis: ScoutAnalysis;
  engine: "gemini" | "heuristic";
  model: string;
  latencyMs: number;
  note?: string;
}

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

const RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    threatScore: {
      type: SchemaType.NUMBER,
      description:
        "Integer 0-100. 0 = wide open market, 100 = fully saturated by funded incumbents.",
    },
    sentiment: {
      type: SchemaType.STRING,
      description:
        "Two to four words, uppercase, e.g. 'CAUTIOUSLY OPTIMISTIC' or 'HOSTILE / SATURATED'.",
    },
    killZone: {
      type: SchemaType.STRING,
      description:
        "2-4 sentences naming concrete repos/products that already own this space and what specifically must NOT be rebuilt.",
    },
    whiteSpaceMoat: {
      type: SchemaType.STRING,
      description:
        "2-4 sentences on research gaps visible in the arXiv results and the defensible wedge a new entrant could own.",
    },
    deltaAlert: {
      type: SchemaType.STRING,
      description:
        "1-3 sentences on the most recent movement (recent pushes, fresh preprints, active threads) and the single action to take this week.",
    },
  },
  required: [
    "threatScore",
    "sentiment",
    "killZone",
    "whiteSpaceMoat",
    "deltaAlert",
  ],
};

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function buildPrompt(
  topic: string,
  mode: string,
  repos: RepoSignal[],
  papers: PaperSignal[],
  discussions: DiscussionSignal[],
) {
  const repoBlock =
    repos.length === 0
      ? "NONE FOUND"
      : repos
          .map(
            (repo, index) =>
              `${index + 1}. ${repo.fullName} — ★${repo.stars} / forks ${repo.forks} / issues ${repo.openIssues}` +
              ` / lang ${repo.language ?? "n/a"} / pushed ${repo.pushedAt}` +
              `\n   ${truncate(repo.description, 260)}` +
              (repo.topics.length ? `\n   topics: ${repo.topics.join(", ")}` : ""),
          )
          .join("\n");

  const paperBlock =
    papers.length === 0
      ? "NONE FOUND"
      : papers
          .map(
            (paper, index) =>
              `${index + 1}. ${truncate(paper.title, 180)} (${paper.published || "n/a"})` +
              `\n   ${truncate(paper.summary, 320)}` +
              (paper.categories.length ? `\n   cats: ${paper.categories.join(", ")}` : ""),
          )
          .join("\n");

  const threadBlock =
    discussions.length === 0
      ? "NONE FOUND"
      : discussions
          .map(
            (thread, index) =>
              `${index + 1}. ${truncate(thread.title, 160)} — ${thread.points} points, ${thread.comments} comments (${thread.createdAt})`,
          )
          .join("\n");

  return `You are SCOUT, a ruthless competitive-intelligence analyst for a solo technical founder deciding what to build next.

TOPIC: "${topic}"
SCAN MODE: ${mode}

=== GITHUB REPOSITORIES (sorted by stars) ===
${repoBlock}

=== ARXIV PREPRINTS (newest first) ===
${paperBlock}

=== HACKER NEWS THREADS ===
${threadBlock}

TASK
Produce a battlecard. Be concrete, name names, quote numbers. No filler, no hedging, no markdown, no bullet characters. Plain sentences only.

RULES
- threatScore must reflect star concentration and repo maturity. A few huge repos => high score. Only toy/demo repos => low score.
- killZone must explicitly say which of the listed repos already solve the obvious idea and what not to build.
- whiteSpaceMoat must be derived from the preprints + unmet needs in threads, not generic advice.
- deltaAlert must reference the freshest signal you were given.
- If a source returned nothing, say so and adapt instead of inventing data.

Return only the JSON object matching the schema.`;
}

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function fallbackAnalysis(
  topic: string,
  repos: RepoSignal[],
  papers: PaperSignal[],
  discussions: DiscussionSignal[],
): ScoutAnalysis {
  const totalStars = repos.reduce((sum, repo) => sum + repo.stars, 0);
  const totalPoints = discussions.reduce((sum, thread) => sum + thread.points, 0);
  const top = repos[0];
  const score = clampScore(
    8 +
      Math.min(52, Math.log10(totalStars + 1) * 14) +
      Math.min(16, repos.length * 1.5) +
      Math.min(10, totalPoints / 90) +
      (papers.length > 0 ? 4 : 0),
  );

  const sentiment =
    score >= 70
      ? "HOSTILE / SATURATED"
      : score >= 45
        ? "CROWDED BUT BREAKABLE"
        : score >= 20
          ? "CAUTIOUSLY OPEN"
          : "BLUE OCEAN / UNPROVEN";

  const leaders = repos
    .slice(0, 3)
    .map((repo) => `${repo.fullName} (★${repo.stars})`)
    .join(", ");

  return {
    threatScore: score,
    sentiment,
    killZone: top
      ? `Do not rebuild a generic ${topic} tool: ${leaders} already own distribution and mindshare, with ${totalStars.toLocaleString()} combined stars. Any thin wrapper around the same workflow is dead on arrival.`
      : `No credible open-source incumbent surfaced for "${topic}", which usually means the demand is either unproven or locked inside closed SaaS. Do not assume the absence of repos is a green light.`,
    whiteSpaceMoat: papers.length
      ? `The newest preprints — "${truncate(papers[0].title, 120)}" — are ahead of the shipped tooling. Own the evaluation layer and the reproducibility story before the incumbents productise it.`
      : `No fresh preprints matched, so the technical moat has to come from proprietary data or workflow depth rather than novel research.`,
    deltaAlert: discussions.length
      ? `Most active thread: "${truncate(discussions[0].title, 120)}" with ${discussions[0].points} points and ${discussions[0].comments} comments. Read it end-to-end this week and extract the top three complaints.`
      : `No community chatter detected. Validate demand with five customer interviews before writing code.`,
  };
}

function coerceAnalysis(raw: unknown): ScoutAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const text = (key: string) =>
    typeof value[key] === "string" ? (value[key] as string).trim() : "";

  const analysis: ScoutAnalysis = {
    threatScore: clampScore(Number(value.threatScore)),
    sentiment: text("sentiment") || "UNSCORED",
    killZone: text("killZone"),
    whiteSpaceMoat: text("whiteSpaceMoat"),
    deltaAlert: text("deltaAlert"),
  };

  if (!analysis.killZone || !analysis.whiteSpaceMoat || !analysis.deltaAlert) {
    return null;
  }
  return analysis;
}

export async function analyzeSignals(
  topic: string,
  mode: string,
  repos: RepoSignal[],
  papers: PaperSignal[],
  discussions: DiscussionSignal[],
): Promise<AnalysisResult> {
  const started = Date.now();
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return {
      analysis: fallbackAnalysis(topic, repos, papers, discussions),
      engine: "heuristic",
      model: "local-heuristic",
      latencyMs: Date.now() - started,
      note: "GEMINI_API_KEY not configured — deterministic scoring model used.",
    };
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.55,
        maxOutputTokens: 1400,
      },
      systemInstruction:
        "You are SCOUT, a competitive intelligence engine. You output only schema-valid JSON. You are blunt, specific and never generic.",
    });

    const result = await model.generateContent(
      buildPrompt(topic, mode, repos, papers, discussions),
    );

    const analysis = coerceAnalysis(JSON.parse(result.response.text()));

    if (!analysis) {
      throw new Error("Model returned an incomplete analysis object");
    }

    return {
      analysis,
      engine: "gemini",
      model: MODEL,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      analysis: fallbackAnalysis(topic, repos, papers, discussions),
      engine: "heuristic",
      model: MODEL,
      latencyMs: Date.now() - started,
      note: `Gemini unavailable (${
        error instanceof Error ? error.message : "unknown error"
      }) — deterministic scoring model used.`,
    };
  }
}
