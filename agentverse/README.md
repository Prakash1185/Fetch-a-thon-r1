# ScoutR Commander — Agentverse integration

This folder contains the uAgent that puts ScoutR in front of **ASI:One**. It receives
chat messages through the **Agent Chat Protocol (ACP)** and forwards the intent to the
Next.js `/api/scout` endpoint. GitHub, arXiv, Hacker News, Gemini and Gmail all stay in
Next.js — the agent only routes and formats.

Commander is the only Almanac-registered uAgent. CodeRadar, SciPulse, Strategist and
Enforcer are tool workers inside the Next.js pipeline, not separate registered agents.

```
ASI:One / Agentverse chat
  -> Commander_uAgent (this file)
  -> POST https://<your-app>/api/scout { topic, alertEmail, mode }
  -> CodeRadar + SciPulse + Strategist + Enforcer
  -> battlecard reply in chat
```

## 1. Create the secrets

Open the agent on [Agentverse](https://agentverse.ai) → **Build** → **Agent Secrets**:

| Secret | Required | Example |
| --- | --- | --- |
| `SCOUT_API_URL` | yes | `https://scoutr.vercel.app` |
| `SCOUT_DEFAULT_EMAIL` | optional | `you@gmail.com` |
| `SCOUT_MODE` | optional | `recon` (`rapid`, `recon`, `deep-dive`) |

`SCOUT_API_URL` may be the app root or the full `/api/scout` URL; both work.
Hosted agents **cannot** reach `localhost` — use Vercel or a tunnel for demos.

## 2. Paste the agent code

1. Agentverse → your agent → **Build**.
2. Replace `agent.py` with [`agent.py`](./agent.py).
3. Click **Run**.
4. Open **Agent Logs** and confirm the agent starts without import errors.

The code is written for the hosted template: `Agent()` receives the platform identity
(seed/name/address) automatically, and `agent.include(chat_protocol, publish_manifest=True)`
registers ACP + the Almanac manifest.

## 3. Test it

From the agent dashboard click **Chat with Agent**, or find it in **ASI:One**:

```
scout vector databases
autonomous browser agents mode:deep-dive
AI code review and email me at you@example.com
```

Expected reply contains: threat score, sentiment, “Don't build”, “Your opening”,
“What changed”, top repos, and email status.

If the agent replies `could not reach the Next.js API`, the public URL or deployment
is wrong. If it replies with an API error, check the Next.js function logs.

## 4. Run locally (optional)

For local mailbox testing you need the registered agent seed:

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt

$env:AGENT_SEED="<the agent seed>"
$env:AGENT_MAILBOX="true"
$env:SCOUT_API_URL="http://localhost:3000"
python agent.py
```

Running a **second** agent with the same seed while the hosted one is live will fight
over the mailbox. Stop the hosted agent first, or use a separate test agent.

## 5. Submission profile copy

- **Name:** ScoutR Commander
- **Tagline:** Competitive and research intel from code, science and market chatter.
- **Description:** ScoutR triangulates GitHub repositories, arXiv pre-prints and Hacker
  News discussions, then returns a threat score, the saturated kill-zone, the white-space
  opening, and a delta alert. Optional email battlecard via Gmail SMTP.
- **Keywords:** competitive intelligence, market research, github, arxiv, hacker news,
  startup validation, research agent, agent orchestration
- **Example prompts:**
  - `Scout the vector database market`
  - `What is happening in autonomous browser agents?`
  - `Is AI code review crowded? mode:rapid`

## 6. Addressing notes

The registered address lives in the dashboard card in `app/page.tsx`:

```
agent1qtkkfmpgt38yqccqazt2nkua9sffylcvkc6ryfg4mknnml5nxm6lx8txkxy
```

Keep it in sync if the agent is recreated. Agentverse hosts the identity; this repo
does **not** store the seed or private key.
