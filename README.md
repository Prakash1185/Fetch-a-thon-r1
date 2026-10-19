# ScoutR

Agent-led competitive & research intelligence for **Fetch-A-Thon 3.0**.
ScoutR triangulates **GitHub**, **arXiv** and **Hacker News**, runs the evidence through
**Gemini 2.5 Flash**, and returns a battlecard: threat score, the saturated kill-zone,
the white-space opening, and what changed. Optional HTML battlecard delivery via Gmail.

The same pipeline is reachable from the web dashboard and from **ASI:One** through
**Commander_uAgent** on Agentverse. Commander is the registered uAgent; CodeRadar,
SciPulse, Strategist and Enforcer are tool workers inside the Next.js execution layer.

```
Dashboard / ASI:One
        |
        v
Commander_uAgent  (agentverse/agent.py, ACP)
        |
        v
POST /api/scout
        |
        +--> CodeRadar  : GitHub REST search (stars)
        +--> SciPulse   : arXiv Atom + HN Algolia
        +--> Strategist : Gemini 2.5 Flash (strict JSON)
        +--> Enforcer   : Nodemailer / Gmail SMTP
        |
        v
Battlecard response + HTML email + trace log
```

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. Environment variables live in `.env` (Next.js loads it
automatically):

| Key | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | yes | Strategist analysis |
| `GEMINI_MODEL` | no | Defaults to `gemini-2.5-flash` |
| `GITHUB_TOKEN` | no | Raises GitHub rate limit 10 -> 30 req/min |
| `GMAIL_USER` | for email | Gmail address |
| `GMAIL_APP_PASSWORD` | for email | Gmail App Password (not the login password) |

Without Gemini the API falls back to a deterministic local scorer. Without Gmail the
scan still succeeds and reports `email.sent: false`. No paid scraper APIs are used.

## API

`POST /api/scout`

```json
{
  "topic": "vector database",
  "alertEmail": "you@example.com",
  "mode": "recon"
}
```

- `topic` — 2–200 characters (required)
- `alertEmail` — optional; when present the HTML battlecard is emailed
- `mode` — `rapid` | `recon` | `deep-dive` (defaults to `recon`)

Returns `success`, normalized items (`repositories`, `papers`, `discussions`), the
`analysis` (`threatScore`, `sentiment`, `killZone`, `whiteSpaceMoat`, `deltaAlert`),
source telemetry, stats, AI engine info, email status and a trace.

`GET /api/scout` returns `405` with usage details.

## Verify end-to-end

With the server running:

```bash
node scripts/verify-scout.mjs --url http://localhost:3000
```

Checks the 405/400/422 guards, then runs a real scan and validates the battlecard shape,
signals, source telemetry and trace. Pass `--email you@example.com` to exercise Gmail
delivery (sends a real email), and `--topic` / `--mode` to change the scan.

## Agentverse (ASI:One)

See [`agentverse/README.md`](./agentverse/README.md) for the full setup. In short:

1. Open the hosted agent on Agentverse -> **Build**.
2. Paste [`agentverse/agent.py`](./agentverse/agent.py).
3. Add secrets: `SCOUT_API_URL` (public deployment), optional `SCOUT_DEFAULT_EMAIL`,
   optional `SCOUT_MODE`.
4. Run and chat: `scout vector databases` or
   `autonomous browser agents and email me at you@example.com`.

Registered address shown in the dashboard:

```
agent1qtkkfmpgt38yqccqazt2nkua9sffylcvkc6ryfg4mknnml5nxm6lx8txkxy
```

Hosted agents cannot call `localhost`; deploy to Vercel (or expose a tunnel) and point
`SCOUT_API_URL` there.

## Stack

Next.js App Router + TypeScript, Tailwind v4, shadcn UI, Gemini 2.5 Flash,
Nodemailer, `uagents` + Agent Chat Protocol.

## Notes

- `next.config.ts` enables `cacheComponents`, so route-segment `runtime` / `dynamic`
  exports are not allowed. `maxDuration = 60` is set on the scout route.
- Scans are partial-failure tolerant: each source reports `ok`, `count`, `latencyMs`
  and an optional `error` instead of failing the whole request.
- The Agentverse agent holds no secrets beyond `SCOUT_API_URL`; Gemini and Gmail keys
  stay in the Next.js deployment.
