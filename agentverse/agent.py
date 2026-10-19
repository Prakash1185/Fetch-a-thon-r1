"""
ScoutR Commander uAgent
=======================

Agent Chat Protocol (ACP) front door for the ScoutR swarm.

Flow:
    ASI:One / Agentverse chat
        -> this agent parses the intent
        -> POST {SCOUT_API_URL}/api/scout
        -> Next.js runs GitHub + arXiv + Hacker News + Gemini + Gmail
        -> this agent sends the battlecard back into the chat

Hosted on Agentverse: paste this file into the agent's Build tab.
Local testing:       set AGENT_SEED and AGENT_MAILBOX=true, then run it.

Environment (Agentverse -> Build -> Agent Secrets):
    SCOUT_API_URL        Public URL of the Next.js app. Defaults to
                         http://localhost:3000 (append /api/scout automatically).
    SCOUT_DEFAULT_EMAIL  Optional. Send the battlecard here when the chat
                         message does not include an email address.
    SCOUT_MODE           Optional. rapid | recon | deep-dive. Default: recon.

The agent never sees Gmail or Gemini keys - those stay inside Next.js.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    EndSessionContent,
    TextContent,
    chat_protocol_spec,
)

# --------------------------------------------------------------------------- #
# config
# --------------------------------------------------------------------------- #

MODES = {"rapid", "recon", "deep-dive"}

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
MODE_RE = re.compile(r"\bmode\s*[:=]\s*(rapid|recon|deep[- ]?dive)\b", re.IGNORECASE)
PREFIX_RE = re.compile(
    r"^(?:please\s+)?(?:can you\s+|could you\s+|would you\s+|i want you to\s+|"
    r"i need you to\s+)?(?:scan|scout|research|analy[sz]e|investigate|explore|"
    r"track|watch|check|find|search(?:\s+for)?|look\s+into|tell\s+me\s+about|"
    r"what(?:'s| is)\s+happening\s+(?:in|with)|how\s+crowded\s+is|"
    r"what\s+about|how\s+about|is|are)\s+",
    re.IGNORECASE,
)
TRAILING_RE = re.compile(r"[\s,.;:!?\-]+$")
HELP_WORDS = {
    "hi",
    "hello",
    "hey",
    "help",
    "/help",
    "/start",
    "what can you do",
    "what can you do?",
    "who are you",
    "who are you?",
}

HELP_TEXT = """**ScoutR Commander** — competitive & research intel swarm.

Ask me to scout a market and I will check GitHub, arXiv and Hacker News, then return:

• **Threat score** (0 = wide open, 100 = saturated)
• **Don't build this** — the space incumbents already own
• **Your opening** — the defensible gap
• **What changed** — the newest signal

**Try:**
• `scout vector databases`
• `autonomous browser agents mode:deep-dive`
• `AI code review and email me at you@example.com`

Email is optional. Add `mode:rapid|recon|deep-dive` to change the depth."""


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def scout_endpoint() -> str:
    """Accept either the app root or the full endpoint URL."""
    url = os.getenv("SCOUT_API_URL", "http://localhost:3000").strip().rstrip("/")
    if not url.endswith("/api/scout"):
        url = f"{url}/api/scout"
    return url


def default_mode() -> str:
    mode = os.getenv("SCOUT_MODE", "recon").strip().lower()
    return mode if mode in MODES else "recon"


def parse_intent(raw: str) -> tuple[str, str | None, str]:
    """Return (topic, email, mode) from a free-form chat message."""
    text = (raw or "").strip()
    mode = default_mode()

    mode_match = MODE_RE.search(text)
    if mode_match:
        mode = mode_match.group(1).lower().replace(" ", "-").replace("deepdive", "deep-dive")
        if mode == "deep-dive":
            pass
        elif mode not in MODES:
            mode = default_mode()
        text = MODE_RE.sub(" ", text)

    email_match = EMAIL_RE.search(text)
    email = email_match.group(0) if email_match else None
    if email:
        text = EMAIL_RE.sub(" ", text)
        # Remove the now-orphaned "email me at" / "send the report to" phrases.
        text = re.sub(
            r"\b(?:and\s+)?(?:please\s+)?email\s+"
            r"(?:me|it|this|that|the\s+(?:report|battlecard|results?))\b"
            r"(?:\s+(?:to|at))?",
            " ",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(
            r"\b(?:and\s+)?(?:please\s+)?(?:send|mail|deliver)\s+"
            r"(?:me|it|this|that|the\s+(?:report|battlecard|results?))\b"
            r"(?:\s+(?:to|at))?",
            " ",
            text,
            flags=re.IGNORECASE,
        )
        text = re.sub(r"\b(?:to|at)\s*$", " ", text, flags=re.IGNORECASE)
    else:
        email = os.getenv("SCOUT_DEFAULT_EMAIL", "").strip() or None

    previous = None
    while previous != text:
        previous = text
        text = PREFIX_RE.sub("", text).strip()

    text = text.strip("`'\"“”‘’ \t\n")
    text = TRAILING_RE.sub("", text)
    text = re.sub(r"\b(?:and|with|for|to|at|plus)\s*$", "", text, flags=re.IGNORECASE)
    text = re.sub(
        r"\s+(?:crowded|saturated|worth\s+building|a\s+good\s+idea|or\s+not|"
        r"right\s+now)\s*$",
        "",
        text,
        flags=re.IGNORECASE,
    )
    text = TRAILING_RE.sub("", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:200], email, mode


def clip(value: str, limit: int = 380) -> str:
    value = (value or "").strip().replace("\n", " ")
    if len(value) <= limit:
        return value
    return value[: limit - 1].rstrip() + "…"


class ScoutAPIError(RuntimeError):
    pass


async def call_scout(topic: str, email: str | None, mode: str) -> dict:
    payload: dict[str, str] = {"topic": topic, "mode": mode}
    if email:
        payload["alertEmail"] = email

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(95.0, connect=10.0),
        follow_redirects=True,
    ) as client:
        response = await client.post(
            scout_endpoint(),
            json=payload,
            headers={
                "Accept": "application/json",
                "User-Agent": "ScoutR-Commander/1.0 (+agentverse)",
            },
        )

    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code >= 400 or not data.get("success"):
        detail = (
            data.get("detail")
            or data.get("error")
            or f"Scout API returned HTTP {response.status_code}"
        )
        raise ScoutAPIError(detail)

    return data


def format_battlecard(data: dict) -> str:
    analysis = data.get("analysis") or {}
    items = data.get("items") or {}
    stats = data.get("stats") or {}
    ai = data.get("ai") or {}
    email = data.get("email") or {}

    repos = items.get("repositories") or []
    papers = items.get("papers") or []
    threads = items.get("discussions") or []

    threat = analysis.get("threatScore", "?")
    sentiment = (analysis.get("sentiment") or "unknown").strip()
    signals = stats.get("totalSignals", 0)
    stars = stats.get("combinedStars", 0)

    lines = [
        f"**ScoutR battlecard — {data.get('topic', 'market')}**",
        f"Threat **{threat}/100** · sentiment **{sentiment}** · "
        f"{signals} signals · {stars:,} stars",
        "",
        f"**Don't build:** {clip(analysis.get('killZone', '—'))}",
        "",
        f"**Your opening:** {clip(analysis.get('whiteSpaceMoat', '—'))}",
        "",
        f"**What changed:** {clip(analysis.get('deltaAlert', '—'))}",
    ]

    if repos:
        lines += ["", "**Strongest repos**"]
        for index, repo in enumerate(repos[:3], start=1):
            language = f" · {repo['language']}" if repo.get("language") else ""
            lines.append(
                f"{index}. [{repo.get('fullName', 'repo')}]({repo.get('url', '')}) — "
                f"{int(repo.get('stars', 0)):,}★{language}"
            )

    if papers:
        paper = papers[0]
        lines += [
            "",
            f"**Newest paper:** [{clip(paper.get('title', 'paper'), 110)}]"
            f"({paper.get('url', '')})",
        ]

    if threads:
        thread = max(threads, key=lambda item: int(item.get("points", 0)))
        lines += [
            "",
            f"**Loudest thread:** [{clip(thread.get('title', 'thread'), 110)}]"
            f"({thread.get('url', '')}) · {int(thread.get('points', 0)):,} pts",
        ]

    if email.get("requested"):
        if email.get("sent"):
            lines += ["", f"📬 Battlecard emailed to **{email.get('to')}**."]
        else:
            lines += ["", f"⚠️ Email failed: {clip(email.get('error') or 'unknown error', 200)}"]
    else:
        lines += ["", "_Add `email me at you@example.com` to receive this by mail._"]

    engine = "Gemini 2.5 Flash" if ai.get("engine") == "gemini" else "local fallback"
    latency = ai.get("latencyMs")
    footer = f"_{engine}"
    if isinstance(latency, (int, float)):
        footer += f" · {latency / 1000:.1f}s"
    footer += f" · mode {data.get('mode', 'recon')}_"
    lines += ["", footer]

    return "\n".join(lines)


def create_chat(text: str, end_session: bool = False) -> ChatMessage:
    content = [TextContent(type="text", text=text)]
    if end_session:
        content.append(EndSessionContent(type="end-session"))
    return ChatMessage(
        timestamp=datetime.now(timezone.utc),
        msg_id=uuid4(),
        content=content,
    )


# --------------------------------------------------------------------------- #
# agent + protocol
# --------------------------------------------------------------------------- #

# On Agentverse, seed/name/address are injected and these kwargs are ignored.
# Locally, set AGENT_SEED + AGENT_MAILBOX=true to talk through the Mailbox.
_agent_kwargs: dict[str, object] = {}
if os.getenv("AGENT_SEED"):
    _agent_kwargs["seed"] = os.environ["AGENT_SEED"]
if os.getenv("AGENT_MAILBOX", "").lower() in {"1", "true", "yes", "on"}:
    _agent_kwargs["mailbox"] = True

agent = Agent(**_agent_kwargs)
chat_protocol = Protocol(spec=chat_protocol_spec)


@chat_protocol.on_message(ChatMessage)
async def handle_chat(ctx: Context, sender: str, msg: ChatMessage) -> None:
    await ctx.send(
        sender,
        ChatAcknowledgement(
            timestamp=datetime.now(timezone.utc),
            acknowledged_msg_id=msg.msg_id,
        ),
    )

    text = (msg.text() or "").strip()
    ctx.logger.info("intent from %s: %s", sender, text[:160])

    if not text or text.lower() in HELP_WORDS:
        await ctx.send(sender, create_chat(HELP_TEXT))
        return

    topic, email, mode = parse_intent(text)
    if len(topic) < 2:
        await ctx.send(
            sender,
            create_chat(
                "I need a topic to scout. Try:\n\n`scout vector databases`\n\n"
                "Optional extras: `mode:deep-dive` and `email me at you@example.com`."
            ),
        )
        return

    try:
        data = await call_scout(topic, email, mode)
        reply = format_battlecard(data)
    except ScoutAPIError as exc:
        ctx.logger.warning("scout API error: %s", exc)
        reply = (
            f"Scout failed for **{topic}**: {clip(str(exc), 300)}\n\n"
            "If this is a hosted agent, check that `SCOUT_API_URL` points to the "
            "public Next.js deployment."
        )
    except httpx.HTTPError as exc:
        ctx.logger.warning("scout API unreachable: %s", exc)
        reply = (
            f"Scout failed for **{topic}** — could not reach the Next.js API.\n\n"
            f"Endpoint: `{scout_endpoint()}`\n\n"
            "Hosted agents cannot call `localhost`; set `SCOUT_API_URL` to the "
            "public deployment (Vercel or a tunnel)."
        )
    except Exception as exc:  # noqa: BLE001 - always answer the chat
        ctx.logger.exception("unexpected scout failure")
        reply = f"Scout failed for **{topic}**: `{type(exc).__name__}: {clip(str(exc), 200)}`"

    await ctx.send(sender, create_chat(reply))


@chat_protocol.on_message(ChatAcknowledgement)
async def handle_ack(ctx: Context, sender: str, msg: ChatAcknowledgement) -> None:
    ctx.logger.debug("ack from %s for %s", sender, msg.acknowledged_msg_id)


# Lightweight liveness only: no external calls, no fake "email sent" claims.
@agent.on_event("startup")
async def announce(ctx: Context) -> None:
    ctx.logger.info("ScoutR Commander online | address=%s", ctx.agent.address)
    ctx.logger.info("ACP ready | scout endpoint=%s", scout_endpoint())


@agent.on_interval(period=60.0)
async def heartbeat(ctx: Context) -> None:
    ctx.logger.info("Commander heartbeat | ACP ready | endpoint=%s", scout_endpoint())


agent.include(chat_protocol, publish_manifest=True)

if __name__ == "__main__":
    agent.run()
