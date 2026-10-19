import nodemailer from "nodemailer";
import type {
  DiscussionSignal,
  PaperSignal,
  RepoSignal,
  ScoutAnalysis,
  ScoutEmailStatus,
  ScoutStats,
} from "./types";

const ACCENT = "#22d3ee";
const INK = "#0b1220";
const PANEL = "#111a2b";
const LINE = "#1f2c42";
const MUTED = "#8ea1bd";

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function threatColor(score: number) {
  if (score >= 70) return "#f87171";
  if (score >= 45) return "#fbbf24";
  return "#34d399";
}

function sectionTitle(label: string, count: number) {
  return `<tr><td style="padding:22px 0 8px 0;border-bottom:1px solid ${LINE};">
    <span style="font:600 11px/1.4 'Courier New',monospace;letter-spacing:.14em;color:${ACCENT};text-transform:uppercase;">${esc(
      label,
    )}</span>
    <span style="font:400 11px/1.4 'Courier New',monospace;color:${MUTED};"> · ${count}</span>
  </td></tr>`;
}

function row(title: string, meta: string, url: string, body?: string) {
  return `<tr><td style="padding:12px 0;border-bottom:1px solid ${LINE};">
    <a href="${esc(url)}" style="font:600 13px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#e8f1ff;text-decoration:none;">${esc(
      title,
    )}</a>
    <div style="font:400 11px/1.6 'Courier New',monospace;color:${MUTED};padding-top:3px;">${esc(
      meta,
    )}</div>
    ${
      body
        ? `<div style="font:400 12px/1.65 -apple-system,Segoe UI,Arial,sans-serif;color:#a9bad3;padding-top:6px;">${esc(
            body,
          )}</div>`
        : ""
    }
  </td></tr>`;
}

function block(label: string, text: string, color: string) {
  return `<tr><td style="padding:14px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border-left:3px solid ${color};">
      <tr><td style="padding:14px 16px;">
        <div style="font:700 10px/1.4 'Courier New',monospace;letter-spacing:.16em;color:${color};text-transform:uppercase;">${esc(
          label,
        )}</div>
        <div style="font:400 13px/1.7 -apple-system,Segoe UI,Arial,sans-serif;color:#dbe6f5;padding-top:7px;">${esc(
          text,
        )}</div>
      </td></tr>
    </table>
  </td></tr>`;
}

export function buildBattlecardHtml(input: {
  topic: string;
  mode: string;
  analysis: ScoutAnalysis;
  repos: RepoSignal[];
  papers: PaperSignal[];
  discussions: DiscussionSignal[];
  stats: ScoutStats;
  generatedAt: string;
}) {
  const { topic, mode, analysis, repos, papers, discussions, stats } = input;
  const score = Math.round(analysis.threatScore);
  const color = threatColor(score);
  const width = Math.max(2, Math.min(100, score));

  const metrics = [
    ["SIGNALS", stats.totalSignals.toLocaleString()],
    ["STARS", stats.combinedStars.toLocaleString()],
    ["AVG PTS", stats.avgPoints.toFixed(1)],
    [
      "FRESHEST",
      stats.freshestSignalDays === null ? "n/a" : `${stats.freshestSignalDays}d`,
    ],
  ]
    .map(
      ([label, value]) => `<td width="25%" style="padding:0 4px;">
        <div style="background:${PANEL};border:1px solid ${LINE};padding:10px 12px;">
          <div style="font:400 9px/1.4 'Courier New',monospace;letter-spacing:.14em;color:${MUTED};">${esc(
            label,
          )}</div>
          <div style="font:700 18px/1.3 'Courier New',monospace;color:#e8f1ff;padding-top:2px;">${esc(
            value,
          )}</div>
        </div>
      </td>`,
    )
    .join("");

  const repoRows =
    repos.length === 0
      ? `<tr><td style="padding:14px 0;font:400 12px/1.6 'Courier New',monospace;color:${MUTED};">NO REPOSITORY SIGNALS RETURNED</td></tr>`
      : repos
          .slice(0, 6)
          .map((repo) =>
            row(
              repo.fullName,
              `★ ${repo.stars.toLocaleString()} · forks ${repo.forks.toLocaleString()} · issues ${repo.openIssues} · ${
                repo.language ?? "n/a"
              } · pushed ${repo.pushedAt.slice(0, 10)}`,
              repo.url,
              repo.description,
            ),
          )
          .join("");

  const paperRows =
    papers.length === 0
      ? `<tr><td style="padding:14px 0;font:400 12px/1.6 'Courier New',monospace;color:${MUTED};">NO PREPRINTS RETURNED</td></tr>`
      : papers
          .slice(0, 4)
          .map((paper) =>
            row(
              paper.title,
              `${paper.published.slice(0, 10) || "n/a"} · ${paper.categories.join(" / ") || "uncategorised"}`,
              paper.url,
              paper.summary.slice(0, 220) + (paper.summary.length > 220 ? "…" : ""),
            ),
          )
          .join("");

  const threadRows =
    discussions.length === 0
      ? `<tr><td style="padding:14px 0;font:400 12px/1.6 'Courier New',monospace;color:${MUTED};">NO DISCUSSIONS RETURNED</td></tr>`
      : discussions
          .slice(0, 5)
          .map((thread) =>
            row(
              thread.title,
              `${thread.points} points · ${thread.comments} comments · ${thread.createdAt.slice(0, 10)}`,
              thread.url,
            ),
          )
          .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SCOUT battlecard · ${esc(
    topic,
  )}</title></head>
<body style="margin:0;padding:0;background:${INK};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${INK};padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#0e1626;border:1px solid ${LINE};">

  <tr><td style="padding:20px 24px;border-bottom:1px solid ${LINE};">
    <table role="presentation" width="100%"><tr>
      <td>
        <div style="font:700 13px/1.4 'Courier New',monospace;letter-spacing:.32em;color:${ACCENT};">SCOUT</div>
        <div style="font:400 10px/1.5 'Courier New',monospace;letter-spacing:.14em;color:${MUTED};padding-top:2px;">COMPETITIVE INTELLIGENCE TERMINAL</div>
      </td>
      <td align="right">
        <div style="font:400 10px/1.5 'Courier New',monospace;color:${MUTED};">MODE</div>
        <div style="font:700 11px/1.5 'Courier New',monospace;color:#e8f1ff;text-transform:uppercase;">${esc(
          mode,
        )}</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:24px 24px 0 24px;">
    <div style="font:400 10px/1.5 'Courier New',monospace;letter-spacing:.16em;color:${MUTED};">TARGET TOPIC</div>
    <div style="font:700 24px/1.3 -apple-system,Segoe UI,Arial,sans-serif;color:#ffffff;padding-top:4px;">${esc(
      topic,
    )}</div>
    <div style="font:400 10px/1.6 'Courier New',monospace;color:${MUTED};padding-top:6px;">GENERATED ${esc(
      input.generatedAt,
    )}</div>
  </td></tr>

  <tr><td style="padding:20px 24px 0 24px;">
    <table role="presentation" width="100%" style="background:${PANEL};border:1px solid ${LINE};">
      <tr><td style="padding:16px 16px 18px 16px;">
        <table role="presentation" width="100%"><tr>
          <td>
            <div style="font:400 10px/1.5 'Courier New',monospace;letter-spacing:.16em;color:${MUTED};">THREAT SCORE</div>
            <div style="font:700 40px/1.1 'Courier New',monospace;color:${color};padding-top:4px;">${score}<span style="font:400 14px/1 'Courier New',monospace;color:${MUTED};">/100</span></div>
          </td>
          <td align="right" valign="bottom">
            <div style="font:400 10px/1.5 'Courier New',monospace;letter-spacing:.16em;color:${MUTED};">SENTIMENT</div>
            <div style="font:700 12px/1.5 'Courier New',monospace;color:${color};padding-top:4px;">${esc(
              analysis.sentiment,
            )}</div>
          </td>
        </tr></table>
        <div style="height:6px;background:#0a1120;margin-top:14px;">
          <div style="height:6px;width:${width}%;background:${color};"></div>
        </div>
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:12px 20px 0 20px;">
    <table role="presentation" width="100%"><tr>${metrics}</tr></table>
  </td></tr>

  <tr><td style="padding:8px 24px 0 24px;">
    <table role="presentation" width="100%">
      ${block("KILL ZONE · DO NOT BUILD", analysis.killZone, "#f87171")}
      ${block("WHITE SPACE MOAT", analysis.whiteSpaceMoat, "#34d399")}
      ${block("DELTA ALERT", analysis.deltaAlert, "#fbbf24")}
    </table>
  </td></tr>

  <tr><td style="padding:8px 24px 0 24px;">
    <table role="presentation" width="100%">
      ${sectionTitle("Repository incumbents", repos.length)}
      ${repoRows}
      ${sectionTitle("Research frontier", papers.length)}
      ${paperRows}
      ${sectionTitle("Community signal", discussions.length)}
      ${threadRows}
    </table>
  </td></tr>

  <tr><td style="padding:22px 24px 26px 24px;">
    <div style="border-top:1px solid ${LINE};padding-top:14px;font:400 10px/1.7 'Courier New',monospace;color:${MUTED};">
      SCOUT OS · automated battlecard · sources: GitHub REST, arXiv Atom, HN Algolia<br/>
      Threat scores are directional, not investment advice.
    </div>
  </td></tr>

</table>
</td></tr>
</table>
</body></html>`;
}

export async function sendBattlecard(input: {
  to: string;
  topic: string;
  mode: string;
  analysis: ScoutAnalysis;
  repos: RepoSignal[];
  papers: PaperSignal[];
  discussions: DiscussionSignal[];
  stats: ScoutStats;
  generatedAt: string;
}): Promise<ScoutEmailStatus> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!user || !pass) {
    return {
      requested: true,
      sent: false,
      to: input.to,
      error: "GMAIL_USER / GMAIL_APP_PASSWORD are not configured on the server.",
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"SCOUT OS" <${user}>`,
      to: input.to,
      subject: `[SCOUT] ${input.topic} — threat ${Math.round(
        input.analysis.threatScore,
      )}/100 · ${input.analysis.sentiment}`,
      text: [
        `SCOUT BATTLE CARD — ${input.topic}`,
        `Mode: ${input.mode}`,
        `Threat score: ${Math.round(input.analysis.threatScore)}/100`,
        `Sentiment: ${input.analysis.sentiment}`,
        "",
        `KILL ZONE: ${input.analysis.killZone}`,
        "",
        `WHITE SPACE MOAT: ${input.analysis.whiteSpaceMoat}`,
        "",
        `DELTA ALERT: ${input.analysis.deltaAlert}`,
        "",
        `Signals: ${input.stats.totalSignals} · Stars: ${input.stats.combinedStars}`,
      ].join("\n"),
      html: buildBattlecardHtml(input),
    });

    return {
      requested: true,
      sent: true,
      to: input.to,
      messageId: info.messageId,
    };
  } catch (error) {
    return {
      requested: true,
      sent: false,
      to: input.to,
      error: error instanceof Error ? error.message : "SMTP dispatch failed",
    };
  }
}
