# ScoutR Commander — Agentverse uAgent

`Commander_uAgent` is the only registered uAgent in this project. It speaks the
**Agent Chat Protocol (ACP)**, parses a free-form chat message, calls the public
Next.js `/api/scout` endpoint, and returns the battlecard in the chat.

GitHub, arXiv, Hacker News, Gemini and Gmail all run inside Next.js. The agent holds no
Gemini or Gmail keys.

```text
Agentverse chat / ACP client
  -> Commander_uAgent (agentverse/agent.py)
  -> POST https://scoutr-nine.vercel.app/api/scout
  -> GitHub + arXiv + Hacker News + Gemini + optional Gmail
  -> battlecard reply in chat
```

The names CodeRadar, SciPulse, Strategist and Enforcer are workers inside the Next.js
pipeline. They are not separately registered agents.

---

## 1. Agent secrets

Open the hosted agent on [Agentverse](https://agentverse.ai) → **Build** → **Agent
Secrets**:

| Secret | Required | Example |
| --- | --- | --- |
| `SCOUT_API_URL` | Yes | `https://scoutr-nine.vercel.app` |
| `SCOUT_DEFAULT_EMAIL` | No | `you@gmail.com` |
| `SCOUT_MODE` | No | `recon` (`rapid`, `recon`, `deep-dive`) |

`SCOUT_API_URL` may be the app root or the full `/api/scout` URL; both work.

Hosted agents **cannot** reach `localhost`. Use the Vercel deployment or a public tunnel.

---

## 2. Paste and run

1. Agentverse → your agent → **Build**.
2. Replace the editor contents with [`agent.py`](./agent.py).
3. Click **Stop**, then **Run**.
4. Open **Agent Logs** and confirm there are no import errors.

The code is written for the hosted template. `Agent()` receives the platform identity
(seed, name, address) automatically, and `agent.include(chat_protocol,
publish_manifest=True)` registers ACP and the Almanac manifest.

---

## 3. Test it

Use **Chat with Agent** on the Agentverse agent page. If the agent profile has been
indexed, it can also be reached from ASI:One.

```text
scout vector databases
autonomous browser agents mode:deep-dive
AI code review and email me at you@example.com
```

The reply should contain the threat score, sentiment, “Don't build”, “Your opening”,
“What changed”, the strongest repos, and the email status.

Healthy logs look like this:

```text
ScoutR Commander online | address=agent1qtkk...
ACP ready | scout endpoint=https://scoutr-nine.vercel.app/api/scout
dispatching scout | topic=vector databases | mode=recon | email=off | endpoint=https://scoutr-nine.vercel.app/api/scout
scout complete | topic=vector databases | signals=28 | engine=gemini | email=off
```

If the reply says it could not reach the Next.js API, check `SCOUT_API_URL` and the
deployment. If the API returns an error, open the Vercel function logs.

---

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

Running a second agent with the same seed while the hosted one is live will fight over the
mailbox. Stop the hosted agent first, or use a separate test agent.

---

## 5. Address

```text
agent1qtkkfmpgt38yqccqazt2nkua9sffylcvkc6ryfg4mknnml5nxm6lx8txkxy
```

The same address is shown in the dashboard card in `app/page.tsx`. Keep them in sync if
the agent is recreated. This repository does not store the seed or private key.

---

## 6. Agentverse profile (factual copy)

- **Name:** ScoutR Commander
- **Tagline:** Competitive and research intelligence from GitHub, arXiv and Hacker News.
- **Description:** ScoutR fetches live repositories, pre-prints and community threads,
  then returns a threat score, what not to build, the defensible opening and the newest
  signal. Optional email battlecard via Gmail SMTP.
- **Keywords:** competitive intelligence, market research, github, arxiv, hacker news,
  startup validation
- **Example prompts:**
  - `scout vector databases`
  - `what is happening in autonomous browser agents?`
  - `is AI code review crowded? mode:rapid`

---

## Limitations

- Only Commander is a registered uAgent; the four workers are code inside Next.js.
- There is no background scheduler, watchdog or automatic re-scan.
- The agent does not stream logs to the dashboard. Agentverse logs and the dashboard
  trace are separate.
- ASI:One discovery depends on Agentverse indexing; Agentverse chat works without it.
- Scans are limited by GitHub's unauthenticated search rate and Gemini's API quota.
