import type {
  DiscussionSignal,
  PaperSignal,
  RepoSignal,
} from "./types";

const USER_AGENT = "SCOUT-OS/1.0 (competitive-intel; +https://github.com)";
const TIMEOUT_MS = 12_000;

// Curated "awesome" repos are useful reading lists, not competitors.
const LIST_NAME_RE = /^awesome(?:[-_.]|$)/i;
const LIST_DESC_RE =
  /\b(?:awesome|curated)\s+list\b|\blist of (?:awesome|resources|tools|links)\b|\bcollection of (?:awesome|resources|tools|links)\b/i;

export interface SourceResult<T> {
  ok: boolean;
  items: T[];
  latencyMs: number;
  error?: string;
}

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function cleanTopic(topic: string) {
  return topic.replace(/[<>"'`]/g, " ").replace(/\s+/g, " ").trim();
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}`);
  }
  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/* GitHub                                                              */
/* ------------------------------------------------------------------ */

interface GitHubSearchResponse {
  total_count?: number;
  message?: string;
  items?: Array<{
    id: number;
    name: string;
    full_name: string;
    html_url: string;
    description: string | null;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    language: string | null;
    topics?: string[];
    pushed_at: string;
    created_at: string;
    owner?: { login?: string };
    license?: { spdx_id?: string | null } | null;
  }>;
}

export async function fetchGitHubRepos(
  topic: string,
  limit = 10,
): Promise<SourceResult<RepoSignal>> {
  const started = nowMs();
  const query = cleanTopic(topic);
  // Name/description keeps the results relevant. For niche topics this can be
  // too strict, so we retry with README matching only when results are sparse.
  const primaryQuery = `${query} in:name,description stars:>2`;
  const fallbackQuery = `${query} in:name,description,readme stars:>2`;

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": USER_AGENT,
      "X-GitHub-Api-Version": "2022-11-28",
    };
    if (process.env.GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const search = async (q: string) => {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(
        q,
      )}&sort=stars&order=desc&per_page=${limit}`;
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      return readJson<GitHubSearchResponse>(res);
    };

    let json = await search(primaryQuery);

    if (Array.isArray(json.items) && json.items.length < 4) {
      try {
        const fallback = await search(fallbackQuery);
        if (
          Array.isArray(fallback.items) &&
          fallback.items.length > json.items.length
        ) {
          json = fallback;
        }
      } catch {
        // Keep the primary result if the fallback is rate-limited or fails.
      }
    }

    if (!Array.isArray(json.items)) {
      throw new Error(json.message ?? "Unexpected GitHub response shape");
    }

    const items: RepoSignal[] = json.items
      .map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        description: repo.description ?? "No description provided.",
        stars: repo.stargazers_count ?? 0,
        forks: repo.forks_count ?? 0,
        openIssues: repo.open_issues_count ?? 0,
        language: repo.language ?? null,
        topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 8) : [],
        pushedAt: repo.pushed_at,
        createdAt: repo.created_at,
        owner: repo.owner?.login ?? repo.full_name.split("/")[0] ?? "unknown",
        license: repo.license?.spdx_id ?? null,
      }))
      .filter((repo) => {
        if (LIST_NAME_RE.test(repo.name)) return false;
        if (repo.topics.some((tag) => /^awesome(?:-list)?$/i.test(tag))) return false;
        if (LIST_DESC_RE.test(repo.description)) return false;
        return true;
      });

    return { ok: true, items, latencyMs: Math.round(nowMs() - started) };
  } catch (error) {
    return {
      ok: false,
      items: [],
      latencyMs: Math.round(nowMs() - started),
      error: error instanceof Error ? error.message : "GitHub fetch failed",
    };
  }
}

/* ------------------------------------------------------------------ */
/* ArXiv                                                               */
/* ------------------------------------------------------------------ */

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => XML_ENTITIES[name] ?? match);
}

function pickTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"),
  );
  return match ? decodeXml(match[1]).replace(/\s+/g, " ").trim() : "";
}

export async function fetchArxivPapers(
  topic: string,
  limit = 8,
): Promise<SourceResult<PaperSignal>> {
  const started = nowMs();
  const words = cleanTopic(topic)
    .split(" ")
    .filter((word) => word.length > 2)
    .slice(0, 5);
  const search = (words.length ? words : [cleanTopic(topic)])
    .map((word) => `all:${encodeURIComponent(word)}`)
    .join("+AND+");

  const url =
    `https://export.arxiv.org/api/query?search_query=${search}` +
    `&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/atom+xml" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();

    const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)].map(
      (match) => match[1],
    );

    const items: PaperSignal[] = entries.map((entry, index) => {
      const rawId = pickTag(entry, "id");
      const id = rawId.replace(/^https?:\/\/arxiv\.org\/abs\//, "").replace(/v\d+$/, "");
      const linkMatch = entry.match(
        /<link[^>]*rel="alternate"[^>]*href="([^"]+)"[^>]*\/?>/i,
      );
      const authors = [...entry.matchAll(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/gi)]
        .map((m) => decodeXml(m[1]).trim())
        .filter(Boolean);
      const categories = [...entry.matchAll(/<category[^>]*term="([^"]+)"/gi)].map(
        (m) => m[1],
      );

      return {
        id: id || `arxiv-${index}`,
        title: pickTag(entry, "title") || "Untitled preprint",
        summary: pickTag(entry, "summary") || "No abstract available.",
        url: linkMatch?.[1] ?? (id ? `https://arxiv.org/abs/${id}` : "https://arxiv.org"),
        published: pickTag(entry, "published"),
        updated: pickTag(entry, "updated"),
        authors: authors.slice(0, 6),
        categories: [...new Set(categories)].slice(0, 4),
      };
    });

    return { ok: true, items, latencyMs: Math.round(nowMs() - started) };
  } catch (error) {
    return {
      ok: false,
      items: [],
      latencyMs: Math.round(nowMs() - started),
      error: error instanceof Error ? error.message : "ArXiv fetch failed",
    };
  }
}

/* ------------------------------------------------------------------ */
/* Hacker News (Algolia)                                               */
/* ------------------------------------------------------------------ */

interface HnSearchResponse {
  hits?: Array<{
    objectID: string;
    title?: string | null;
    story_title?: string | null;
    url?: string | null;
    story_url?: string | null;
    author?: string | null;
    points?: number | null;
    num_comments?: number | null;
    created_at?: string | null;
    created_at_i?: number | null;
  }>;
}

export async function fetchHackerNews(
  topic: string,
  limit = 10,
): Promise<SourceResult<DiscussionSignal>> {
  const started = nowMs();
  const url =
    `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(cleanTopic(topic))}` +
    `&tags=story&hitsPerPage=${limit}`;

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const json = await readJson<HnSearchResponse>(res);

    const items: DiscussionSignal[] = (json.hits ?? [])
      .filter((hit) => hit.title || hit.story_title)
      .map((hit) => {
        const objectId = hit.objectID;
        return {
          id: objectId,
          title: hit.title ?? hit.story_title ?? "Untitled discussion",
          url:
            hit.url ??
            hit.story_url ??
            `https://news.ycombinator.com/item?id=${objectId}`,
          author: hit.author ?? "unknown",
          points: hit.points ?? 0,
          comments: hit.num_comments ?? 0,
          createdAt:
            hit.created_at ??
            (hit.created_at_i
              ? new Date(hit.created_at_i * 1000).toISOString()
              : new Date().toISOString()),
        };
      });

    return { ok: true, items, latencyMs: Math.round(nowMs() - started) };
  } catch (error) {
    return {
      ok: false,
      items: [],
      latencyMs: Math.round(nowMs() - started),
      error: error instanceof Error ? error.message : "Hacker News fetch failed",
    };
  }
}
