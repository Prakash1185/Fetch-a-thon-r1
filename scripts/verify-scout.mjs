#!/usr/bin/env node
/**
 * ScoutR end-to-end verifier
 *
 * Checks the Next.js API contract against a running server:
 *   1. GET is rejected (405)
 *   2. Empty payload is rejected (400)
 *   3. Bad email is rejected (422)
 *   4. Real scan succeeds and returns the full battlecard shape
 *
 * Usage:
 *   node scripts/verify-scout.mjs
 *   node scripts/verify-scout.mjs --url http://localhost:3116
 *   node scripts/verify-scout.mjs --topic "vector database" --mode recon
 *   node scripts/verify-scout.mjs --email you@example.com   # actually sends mail
 *
 * Exit code 0 = all checks passed.
 */

const args = process.argv.slice(2);

function flag(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

const baseUrl = flag("url", process.env.SCOUT_API_URL ?? "http://localhost:3000")
  .replace(/\/+$/, "")
  .replace(/\/api\/scout$/, "");
const endpoint = `${baseUrl}/api/scout`;
const topic = flag("topic", "vector database");
const mode = flag("mode", "recon");
const email = flag("email", "");

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(body, timeout = 90_000) {
  const started = Date.now();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { response, payload, ms: Date.now() - started };
}

async function main() {
  console.log(`ScoutR verifier -> ${endpoint}\n`);

  // 1. GET should be 405 -----------------------------------------------------
  try {
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
    record("GET is rejected", response.status === 405, `HTTP ${response.status}`);
  } catch (error) {
    record("GET is rejected", false, error.message);
  }

  // 2. Empty payload should be 400 ------------------------------------------
  try {
    const { response, payload } = await post({}, 20_000);
    record(
      "Empty topic is rejected",
      response.status === 400 && payload?.success === false,
      `HTTP ${response.status} · ${payload?.error ?? "no error body"}`,
    );
  } catch (error) {
    record("Empty topic is rejected", false, error.message);
  }

  // 3. Bad email should be 422 ----------------------------------------------
  try {
    const { response, payload } = await post(
      { topic: "vector database", alertEmail: "not-an-email" },
      20_000,
    );
    record(
      "Bad email is rejected",
      response.status === 422 && payload?.success === false,
      `HTTP ${response.status} · ${payload?.error ?? "no error body"}`,
    );
  } catch (error) {
    record("Bad email is rejected", false, error.message);
  }

  // 4. Real scan -------------------------------------------------------------
  const body = { topic, mode };
  if (email) body.alertEmail = email;

  console.log(
    `\nRunning live scan: topic="${topic}" mode=${mode}` +
      (email ? ` email=${email} (this will send a real email)` : " email=off") +
      "\n",
  );

  let scan = null;
  try {
    scan = await post(body, 120_000);
  } catch (error) {
    record("Live scan responds", false, error.message);
  }

  if (scan) {
    const { response, payload, ms } = scan;
    const isSuccess = response.status === 200 && payload?.success === true;
    record("Live scan responds", isSuccess, `HTTP ${response.status} in ${ms}ms`);

    if (isSuccess) {
      const items = payload.items ?? {};
      const analysis = payload.analysis ?? {};
      const stats = payload.stats ?? {};
      const ai = payload.ai ?? {};
      const sources = payload.sources ?? {};
      const emailStatus = payload.email ?? {};

      console.log(
        `\n  engine=${ai.engine ?? "?"} model=${ai.model ?? "?"} ` +
          `threat=${analysis.threatScore ?? "?"} signals=${stats.totalSignals ?? "?"} ` +
          `stars=${stats.combinedStars ?? "?"} ` +
          `repos=${items.repositories?.length ?? 0} papers=${items.papers?.length ?? 0} ` +
          `threads=${items.discussions?.length ?? 0}`,
      );
      if (ai.note) console.log(`  ai note: ${ai.note}`);
      console.log(
        `  github=${sources.github?.count ?? "?"} arxiv=${sources.arxiv?.count ?? "?"} ` +
          `hn=${sources.hackernews?.count ?? "?"} email=${
            emailStatus.requested ? (emailStatus.sent ? "sent" : "failed") : "off"
          }\n`,
      );

      record(
        "Battlecard shape",
        typeof analysis.threatScore === "number" &&
          analysis.threatScore >= 0 &&
          analysis.threatScore <= 100 &&
          typeof analysis.sentiment === "string" &&
          typeof analysis.killZone === "string" &&
          analysis.killZone.length > 0 &&
          typeof analysis.whiteSpaceMoat === "string" &&
          analysis.whiteSpaceMoat.length > 0 &&
          typeof analysis.deltaAlert === "string" &&
          analysis.deltaAlert.length > 0,
        `threat=${analysis.threatScore} sentiment=${analysis.sentiment}`,
      );

      record(
        "Live signals present",
        (stats.totalSignals ?? 0) > 0 &&
          Array.isArray(items.repositories) &&
          Array.isArray(items.papers) &&
          Array.isArray(items.discussions),
        `${stats.totalSignals ?? 0} signals`,
      );

      record(
        "Source telemetry present",
        ["github", "arxiv", "hackernews"].every(
          (key) =>
            sources[key] &&
            typeof sources[key].ok === "boolean" &&
            typeof sources[key].count === "number" &&
            typeof sources[key].latencyMs === "number",
        ),
        `github ${sources.github?.latencyMs ?? "?"}ms · arxiv ${
          sources.arxiv?.latencyMs ?? "?"
        }ms · hn ${sources.hackernews?.latencyMs ?? "?"}ms`,
      );

      record(
        "Trace returned",
        Array.isArray(payload.trace) && payload.trace.length >= 5,
        `${payload.trace?.length ?? 0} steps`,
      );

      if (email) {
        record(
          "Email requested and dispatched",
          emailStatus.requested === true && emailStatus.sent === true,
          emailStatus.sent ? `sent to ${emailStatus.to}` : emailStatus.error ?? "not sent",
        );
      }
    } else {
      console.log(`  error: ${payload?.error ?? "no JSON body"} — ${payload?.detail ?? ""}`);
      record("Battlecard shape", false, "scan did not succeed");
      record("Live signals present", false, "scan did not succeed");
      record("Source telemetry present", false, "scan did not succeed");
      record("Trace returned", false, "scan did not succeed");
    }
  }

  // summary -----------------------------------------------------------------
  const passed = results.filter((result) => result.ok).length;
  const failed = results.length - passed;
  console.log(`\n${passed}/${results.length} checks passed${failed ? ` · ${failed} failed` : ""}`);

  if (failed) {
    console.log("\nFailed checks:");
    for (const result of results.filter((item) => !item.ok)) {
      console.log(`  - ${result.name}: ${result.detail}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nVerifier crashed:", error);
  process.exitCode = 1;
});
