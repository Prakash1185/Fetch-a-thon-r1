"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIcon,
  ArrowRightIcon,
  BellRingIcon,
  BookOpenIcon,
  BotIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  ClockIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GitBranchIcon,
  GitForkIcon,
  InboxIcon,
  MailIcon,
  MessageSquareIcon,
  RadarIcon,
  RocketIcon,
  ShieldAlertIcon,
  SparklesIcon,
  StarIcon,
  TriangleAlertIcon,
  XCircleIcon,
  ZapIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatCompact, formatInt, hostOf, relativeDays, shortDate } from "@/lib/scout/format";
import type {
  DiscussionSignal,
  PaperSignal,
  RepoSignal,
  ScoutErrorResponse,
  ScoutResponse,
  ScoutTraceEntry,
} from "@/lib/scout/types";

type LogLevel = "info" | "ok" | "warn" | "error";

interface LogEntry {
  id: number;
  time: string;
  agent: string;
  message: string;
  level: LogLevel;
}

type Signal =
  | { kind: "repo"; item: RepoSignal }
  | { kind: "paper"; item: PaperSignal }
  | { kind: "thread"; item: DiscussionSignal };

const PRESETS = ["AI code review", "Vector databases", "Agent observability"];

const AGENT_ADDRESS =
  "agent1qtkkfmpgt38yqccqazt2nkua9sffylcvkc6ryfg4mknnml5nxm6lx8txkxy";

const AGENTS = [
  { name: "Commander", role: "Agentverse · ACP", kind: "uAgent" },
  { name: "CodeRadar", role: "GitHub live search", kind: "worker" },
  { name: "SciPulse", role: "arXiv + Hacker News", kind: "worker" },
  { name: "Strategist", role: "Gemini 2.5 Flash", kind: "worker" },
  { name: "Enforcer", role: "Gmail SMTP", kind: "worker" },
] as const;

const CHIP = {
  teal: "border-primary/40 bg-primary/10 text-primary",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "border-destructive/40 bg-destructive/10 text-destructive",
  violet: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  sky: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  emerald:
    "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
} as const;

function stamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function scoreLabel(score: number) {
  if (score >= 75) return "Very crowded";
  if (score >= 50) return "Competitive";
  if (score >= 25) return "Some room";
  return "Wide open";
}

function scoreChip(score: number) {
  if (score >= 70) return CHIP.rose;
  if (score >= 40) return CHIP.amber;
  return CHIP.emerald;
}

function scoreVariant(score: number) {
  if (score >= 70) return "destructive" as const;
  if (score >= 40) return "secondary" as const;
  return "default" as const;
}

function levelDot(level: LogLevel) {
  if (level === "ok") return "bg-emerald-500";
  if (level === "warn") return "bg-amber-500";
  if (level === "error") return "bg-destructive";
  return "bg-muted-foreground/60";
}

function traceActor(step: string): string {
  if (step === "ingest") return "Pipeline";
  if (step === "scrape:github") return "CodeRadar";
  if (step.startsWith("scrape:")) return "SciPulse";
  if (step.startsWith("ai:")) return "Strategist";
  if (step === "email") return "Enforcer";
  return "Pipeline";
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ScoutResponse | null>(null);
  const [error, setError] = useState<ScoutErrorResponse | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clock, setClock] = useState<Date | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [battleOpen, setBattleOpen] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);

  const logSeq = useRef(0);
  const consoleRef = useRef<HTMLDivElement | null>(null);

  const pushLog = useCallback(
    (agent: string, message: string, level: LogLevel = "info") => {
      logSeq.current += 1;
      setLogs((current) => [
        ...current.slice(-120),
        { id: logSeq.current, time: stamp(), agent, message, level },
      ]);
    },
    [],
  );

  useEffect(() => {
    const tick = () => setClock(new Date());
    const initial = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const node = consoleRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs]);

  const runScan = useCallback(
    async (sendEmail: boolean, topicOverride?: string) => {
      const target = (topicOverride ?? topic).trim();
      if (target.length < 2) {
        toast.error("Add a topic first", {
          description: "Even two words is enough to start a scan.",
        });
        return;
      }
      if (sendEmail && !email.trim()) {
        toast.error("Add an email address", {
          description: "We need a Gmail address to send the battlecard.",
        });
        return;
      }

      setLoading(true);
      setError(null);
      setLogs([]);
      pushLog("Dashboard", `Scan requested for “${target}”`, "ok");
      pushLog("Pipeline", "POST /api/scout → live sources + Gemini", "info");

      const started = performance.now();

      try {
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: target,
            alertEmail: sendEmail ? email.trim() : "",
            mode: "recon",
          }),
        });

        const payload = (await res.json()) as ScoutResponse | ScoutErrorResponse;

        if (!res.ok || payload.success !== true) {
          const failure = payload as ScoutErrorResponse;
          setError(failure);
          pushLog("Pipeline", failure.error ?? "The scan failed.", "error");
          toast.error(failure.error ?? "Scan failed", {
            description: failure.detail,
          });
          return;
        }

        setData(payload);
        const elapsed = Math.round(performance.now() - started);

        payload.trace.forEach((entry: ScoutTraceEntry) => {
          pushLog(
            traceActor(entry.step),
            entry.detail,
            entry.status === "error" ? "error" : entry.status === "warn" ? "warn" : "ok",
          );
        });
        pushLog("Pipeline", `Finished: ${payload.stats.totalSignals} signals in ${elapsed}ms`, "ok");

        toast.success("Your battlecard is ready", {
          description: `${payload.stats.totalSignals} signals found · competition ${Math.round(
            payload.analysis.threatScore,
          )}/100`,
        });

        if (payload.email.requested && payload.email.sent) {
          toast.success("Email sent", {
            description: `Check the inbox for ${payload.email.to}.`,
          });
        } else if (payload.email.requested && !payload.email.sent) {
          toast.warning("Email could not be sent", {
            description: payload.email.error,
          });
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unknown error";
        setError({ success: false, error: "Could not reach the server", detail: message });
        pushLog("Dashboard", `Network error: ${message}`, "error");
        toast.error("Could not reach the server", {
          description: "Please check your connection and try again.",
        });
      } finally {
        setLoading(false);
      }
    },
    [email, pushLog, topic],
  );

  const score = Math.round(data?.analysis.threatScore ?? 0);
  const topRepo = data?.items.repositories[0];
  const delivered = Boolean(data?.email.requested && data.email.sent);
  const dispatchFailed = Boolean(data?.email.requested && !data.email.sent);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ---------------- navbar ---------------- */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-6">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <RadarIcon className="size-5" />
          </div>

          <div className="min-w-0">
            <div className="font-heading text-base font-semibold tracking-tight">
              ScoutR
            </div>
            <div className="hidden text-xs text-muted-foreground sm:block">
              Live competitive intel
            </div>
          </div>

          <Badge variant="outline" className={`ml-2 hidden md:inline-flex ${CHIP.violet}`}>
            <SparklesIcon /> 3 live sources
          </Badge>

          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="hidden gap-1.5 sm:inline-flex">
              <BotIcon className="size-3" />
              Commander · ACP
            </Badge>

            <Button variant="ghost" size="icon" aria-label="How it works" onClick={() => setHelpOpen(true)}>
              <CircleHelpIcon />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8">
        {/* ---------------- agent identity ---------------- */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BotIcon className="size-4" />
                Commander_uAgent
              </CardTitle>
              <Badge variant="outline" className={CHIP.emerald}>
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Hosted
              </Badge>
              <Badge variant="outline" className={CHIP.violet}>
                Almanac registered
              </Badge>
              <Badge variant="outline" className={CHIP.sky}>
                ACP
              </Badge>
            </div>
            <CardDescription className="text-sm">
              Almanac-registered ACP endpoint. Four tool workers execute the pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Agent address</Label>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-xs">
                  {AGENT_ADDRESS}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(AGENT_ADDRESS)
                      .then(() => toast.success("Agent address copied"))
                      .catch(() => toast.error("Clipboard is blocked"));
                  }}
                >
                  <CopyIcon /> Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a
                      href={`https://agentverse.ai/agents/details/${AGENT_ADDRESS}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    />
                  }
                >
                  Agentverse <ExternalLinkIcon />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {AGENTS.map((agent) => (
                <div
                  key={agent.name}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      agent.kind === "uAgent"
                        ? "animate-pulse bg-emerald-500"
                        : "bg-primary/70"
                    }`}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs font-medium">{agent.name}</span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {agent.role}
                    </span>
                  </div>
                  <Badge
                    variant={agent.kind === "uAgent" ? "default" : "secondary"}
                    className="ml-auto text-[10px]"
                  >
                    {agent.kind}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ---------------- command bar ---------------- */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">What market should we scout?</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Scan GitHub, arXiv and Hacker News for a topic.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr_auto] lg:items-end">
              <div className="flex flex-col gap-2">
                <Label htmlFor="topic" className="text-sm">
                  Topic or startup idea
                </Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runScan(false);
                  }}
                  placeholder="e.g. agent observability for LLM pipelines"
                  maxLength={200}
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="text-sm">
                  Where should we email it? <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@gmail.com"
                  className="h-10"
                />
              </div>

              <Button
                size="lg"
                className="h-10 w-full px-5 lg:w-auto"
                onClick={() => void runScan(Boolean(email.trim()))}
                disabled={loading}
              >
                {loading ? <BotIcon className="animate-pulse" /> : <RocketIcon />}
                {loading ? "Scanning…" : email.trim() ? "Scan & email me" : "Scan market"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Try one:</span>
              {PRESETS.map((preset) => (
                <Button
                  key={preset}
                  variant="outline"
                  size="xs"
                  disabled={loading}
                  onClick={() => {
                    setTopic(preset);
                    void runScan(false, preset);
                  }}
                >
                  {preset}
                </Button>
              ))}
            </div>

            {error ? (
              <Alert variant="destructive">
                <TriangleAlertIcon />
                <AlertTitle>{error.error}</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-2">
                  {error.detail}
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => setErrorOpen(true)}
                  >
                    View details
                  </Button>
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {/* ---------------- metric grid ---------------- */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* competition */}
          <Card>
            <CardHeader>
              <CardDescription className="text-sm">How crowded is it?</CardDescription>
              <CardAction>
                <Badge variant={data ? scoreVariant(score) : "outline"} className={data ? scoreChip(score) : ""}>
                  {data ? scoreLabel(score) : "No scan yet"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {loading && !data ? (
                <Skeleton className="h-12 w-28" />
              ) : (
                <div className="font-heading text-5xl leading-none font-semibold tracking-tight tabular-nums">
                  {data ? score : "—"}
                  <span className="text-base font-normal text-muted-foreground"> /100</span>
                </div>
              )}
              <Progress value={data ? score : 0} />
              <p className="text-sm text-muted-foreground">
                {data
                  ? `${100 - score}% of the space still looks open.`
                  : "Threat index."}
              </p>
            </CardContent>
          </Card>

          {/* top repository match */}
          <Card>
            <CardHeader>
              <CardDescription className="text-sm">Top repo match</CardDescription>
              <CardAction>
                <Badge variant="outline" className={CHIP.amber}>
                  <GitBranchIcon /> most stars
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loading && !data ? (
                <>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              ) : topRepo ? (
                <>
                  <div className="truncate font-heading text-base font-medium">
                    {topRepo.fullName}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {topRepo.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge variant="outline" className={CHIP.amber}>
                      <StarIcon /> {formatInt(topRepo.stars)} stars
                    </Badge>
                    <Badge variant="outline">
                      <GitForkIcon /> {formatInt(topRepo.forks)} forks
                    </Badge>
                    <Badge variant="secondary">{topRepo.language ?? "n/a"}</Badge>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No leader detected.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="link"
                size="sm"
                className="px-0"
                disabled={!topRepo}
                onClick={() => topRepo && setSignal({ kind: "repo", item: topRepo })}
              >
                See details <ArrowRightIcon />
              </Button>
            </CardFooter>
          </Card>

          {/* sources */}
          <Card>
            <CardHeader>
              <CardDescription className="text-sm">Sources we checked</CardDescription>
              <CardAction>
                <Badge variant="outline" className={CHIP.sky}>
                  <DatabaseIcon /> 3 feeds
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {loading && !data ? (
                <Skeleton className="h-12 w-24" />
              ) : (
                <div className="font-heading text-5xl leading-none font-semibold tracking-tight tabular-nums">
                  {data ? formatInt(data.stats.totalSignals) : "—"}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={CHIP.amber}>
                  <GitBranchIcon /> {data?.items.repositories.length ?? 0} repos
                </Badge>
                <Badge variant="outline" className={CHIP.violet}>
                  <BookOpenIcon /> {data?.items.papers.length ?? 0} papers
                </Badge>
                <Badge variant="outline" className={CHIP.sky}>
                  <MessageSquareIcon /> {data?.items.discussions.length ?? 0} threads
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {data
                  ? `${formatCompact(data.stats.combinedStars)} stars across the leading projects.`
                  : "GitHub · arXiv · Hacker News."}
              </p>
            </CardContent>
          </Card>

          {/* email */}
          <Card>
            <CardHeader>
              <CardDescription className="text-sm">Email delivery</CardDescription>
              <CardAction>
                <Badge
                  variant={delivered ? "default" : dispatchFailed ? "destructive" : "outline"}
                  className={delivered ? CHIP.emerald : ""}
                >
                  {loading ? "Sending" : delivered ? "Delivered" : dispatchFailed ? "Failed" : "Not sent"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.rose}`}>
                  <MailIcon className="size-4" />
                </span>
                <span className="truncate text-sm">
                  {data?.email.to ?? (email.trim() || "No address added")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {data?.email.sent
                  ? `Sent on ${shortDate(data.generatedAt)}.`
                  : dispatchFailed
                    ? data?.email.error
                    : "SMTP delivery via Gmail."}
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={loading || !data}
                onClick={() => void runScan(true)}
              >
                <BellRingIcon /> Scan again & email
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ---------------- workspace ---------------- */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Tabs defaultValue="battlecard" className="gap-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="battlecard" className="text-sm">
                  <SparklesIcon /> Battlecard
                </TabsTrigger>
                <TabsTrigger value="evidence" className="text-sm">
                  <ActivityIcon /> Evidence
                </TabsTrigger>
              </TabsList>

              {/* battlecard */}
              <TabsContent value="battlecard" className="flex flex-col gap-4">
                {loading && !data ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                  </div>
                ) : data ? (
                  <>
                    {data.ai.engine === "heuristic" ? (
                      <Alert>
                        <TriangleAlertIcon />
                        <AlertTitle>Gemini unavailable</AlertTitle>
                        <AlertDescription>
                          This battlecard used the deterministic local scorer. The full report
                          includes the API note.
                        </AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.rose}`}>
                              <ShieldAlertIcon className="size-4" />
                            </span>
                            Don’t build this
                          </CardTitle>
                          <CardAction>
                            <Badge variant="destructive">avoid</Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed">{data.analysis.killZone}</p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-base">
                            <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.emerald}`}>
                              <SparklesIcon className="size-4" />
                            </span>
                            Your opening
                          </CardTitle>
                          <CardAction>
                            <Badge variant="default">build</Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed">
                            {data.analysis.whiteSpaceMoat}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                          <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.amber}`}>
                            <ZapIcon className="size-4" />
                          </span>
                          What changed
                        </CardTitle>
                        <CardAction>
                          <Badge variant="secondary">{data.ai.engine}</Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed">{data.analysis.deltaAlert}</p>
                      </CardContent>
                      <CardFooter className="justify-between">
                        <span className="text-xs text-muted-foreground">
                          {data.ai.model} · {data.ai.latencyMs}ms
                        </span>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void navigator.clipboard
                                .writeText(JSON.stringify(data, null, 2))
                                .then(() => toast.success("Report copied"))
                                .catch(() => toast.error("Clipboard is blocked"));
                            }}
                          >
                            <CopyIcon /> Copy
                          </Button>
                          <Button size="sm" onClick={() => setBattleOpen(true)}>
                            Open full report <ArrowRightIcon />
                          </Button>
                        </div>
                      </CardFooter>
                    </Card>
                  </>
                ) : (
                  <Card>
                    <CardContent className="flex flex-col items-center gap-3 py-14">
                      <span className={`flex size-12 items-center justify-center rounded-xl ${CHIP.teal}`}>
                        <RadarIcon className="size-6" />
                      </span>
                      <p className="font-heading text-base font-medium">No scan yet</p>
                      <p className="max-w-md text-center text-sm text-muted-foreground">
                        Enter a topic and run the scan.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setHelpOpen(true)}>
                        <CircleHelpIcon /> How does this work?
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* evidence */}
              <TabsContent value="evidence">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* github */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.amber}`}>
                          <GitBranchIcon className="size-4" />
                        </span>
                        GitHub
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Projects that already exist
                      </CardDescription>
                      <CardAction>
                        <Badge variant="outline" className={CHIP.amber}>
                          {data?.items.repositories.length ?? 0}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[360px]">
                        <div className="flex flex-col gap-2 pr-3">
                          {loading && !data
                            ? Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-20 w-full" />
                              ))
                            : data?.items.repositories.map((repo) => (
                                <Button
                                  key={repo.id}
                                  variant="ghost"
                                  className="h-auto w-full flex-col items-start gap-1 p-2 text-left whitespace-normal"
                                  onClick={() => setSignal({ kind: "repo", item: repo })}
                                >
                                  <span className="flex w-full items-start justify-between gap-2">
                                    <span className="truncate text-sm font-medium">
                                      {repo.fullName}
                                    </span>
                                    <Badge variant="outline" className={CHIP.amber}>
                                      <StarIcon /> {formatCompact(repo.stars)}
                                    </Badge>
                                  </span>
                                  <span className="line-clamp-2 text-xs text-muted-foreground">
                                    {repo.description}
                                  </span>
                                  <span className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                      {repo.language ?? "n/a"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      updated {relativeDays(repo.pushedAt)}
                                    </span>
                                  </span>
                                </Button>
                              ))}
                          {data && data.items.repositories.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No repositories found for this topic.
                            </p>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* arxiv */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.violet}`}>
                          <BookOpenIcon className="size-4" />
                        </span>
                        Research
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Newest arXiv pre-prints
                      </CardDescription>
                      <CardAction>
                        <Badge variant="outline" className={CHIP.violet}>
                          {data?.items.papers.length ?? 0}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[360px]">
                        <div className="flex flex-col gap-2 pr-3">
                          {loading && !data
                            ? Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-24 w-full" />
                              ))
                            : data?.items.papers.map((paper) => (
                                <Button
                                  key={paper.id}
                                  variant="ghost"
                                  className="h-auto w-full flex-col items-start gap-1 p-2 text-left whitespace-normal"
                                  onClick={() => setSignal({ kind: "paper", item: paper })}
                                >
                                  <span className="line-clamp-2 text-sm font-medium">
                                    {paper.title}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {shortDate(paper.published)} · {paper.authors.length}{" "}
                                    {paper.authors.length === 1 ? "author" : "authors"}
                                  </span>
                                  <span className="flex flex-wrap gap-1">
                                    {paper.categories.slice(0, 2).map((category) => (
                                      <Badge key={category} variant="secondary">
                                        {category}
                                      </Badge>
                                    ))}
                                  </span>
                                </Button>
                              ))}
                          {data && data.items.papers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No pre-prints found for this topic.
                            </p>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* hn */}
                  <Card className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.sky}`}>
                          <MessageSquareIcon className="size-4" />
                        </span>
                        Community
                      </CardTitle>
                      <CardDescription className="text-sm">
                        What Hacker News thinks
                      </CardDescription>
                      <CardAction>
                        <Badge variant="outline" className={CHIP.sky}>
                          {data?.items.discussions.length ?? 0}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[360px]">
                        <div className="flex flex-col gap-2 pr-3">
                          {loading && !data
                            ? Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-20 w-full" />
                              ))
                            : data?.items.discussions.map((thread) => (
                                <Button
                                  key={thread.id}
                                  variant="ghost"
                                  className="h-auto w-full flex-col items-start gap-1 p-2 text-left whitespace-normal"
                                  onClick={() => setSignal({ kind: "thread", item: thread })}
                                >
                                  <span className="line-clamp-2 text-sm font-medium">
                                    {thread.title}
                                  </span>
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <Badge
                                      variant={
                                        thread.points >= 200
                                          ? "default"
                                          : thread.points >= 50
                                            ? "secondary"
                                            : "outline"
                                      }
                                    >
                                      {thread.points >= 200
                                        ? "hot"
                                        : thread.points >= 50
                                          ? "warm"
                                          : "quiet"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatInt(thread.points)} points ·{" "}
                                      {formatInt(thread.comments)} comments
                                    </span>
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {hostOf(thread.url)}
                                  </span>
                                </Button>
                              ))}
                          {data && data.items.discussions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No discussions found for this topic.
                            </p>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ---------------- activity console ---------------- */}
          <Card className="flex h-[600px] flex-col xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className={`flex size-8 items-center justify-center rounded-lg ${CHIP.teal}`}>
                  <BotIcon className="size-4" />
                </span>
                Execution trace
              </CardTitle>
              <CardDescription className="text-sm">
                Real timings from the deployed pipeline.
              </CardDescription>
              <CardAction>
                <Badge variant={loading ? "default" : "outline"}>
                  <span
                    className={`size-2 ${loading ? "animate-pulse bg-current" : "bg-muted-foreground"}`}
                  />
                  {loading ? "working" : "idle"}
                </Badge>
              </CardAction>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 p-0">
              <div
                ref={consoleRef}
                className="h-full overflow-y-auto border-y bg-muted/40 px-4 py-3 font-mono text-xs leading-6"
              >
                {logs.length === 0 ? (
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <span>$ scoutr --waiting</span>
                    <span>Awaiting dispatch.</span>
                  </div>
                ) : (
                  logs.map((entry) => (
                    <div key={entry.id} className="flex gap-2 py-0.5">
                      <span className="shrink-0 text-muted-foreground">{entry.time}</span>
                      <span className={`mt-2 size-1.5 shrink-0 ${levelDot(entry.level)}`} />
                      <span className="shrink-0 text-muted-foreground">[{entry.agent}]</span>
                      <span
                        className={
                          entry.level === "error"
                            ? "text-destructive"
                            : entry.level === "ok"
                              ? "text-primary"
                              : ""
                        }
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>

            <CardFooter className="justify-between">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2Icon className="size-4 text-emerald-500" />
                {data ? `${data.stats.totalSignals} signals found` : "No scan yet"}
              </span>
              <Badge variant="outline">
                <ClockIcon /> {clock ? clock.toLocaleTimeString("en-GB", { hour12: false }) : "--:--:--"}
              </Badge>
            </CardFooter>
          </Card>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t pt-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <XCircleIcon className="size-3.5" />
            Directional signal only.
          </span>
          <span>GitHub · arXiv · Hacker News · Gemini 2.5 Flash</span>
        </footer>
      </main>

      {/* ================= modals ================= */}

      {/* how it works */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="size-4 text-primary" />
              How ScoutR works
            </DialogTitle>
            <DialogDescription className="text-sm">
              From topic to battlecard.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {[
              {
                icon: <RadarIcon className="size-4" />,
                title: "1. Tell us the idea",
                body: "A few words is enough. We turn it into searches for you.",
                chip: CHIP.teal,
              },
              {
                icon: <DatabaseIcon className="size-4" />,
                title: "2. We check three places",
                body: "GitHub for existing products, arXiv for fresh research, Hacker News for real opinions.",
                chip: CHIP.violet,
              },
              {
                icon: <InboxIcon className="size-4" />,
                title: "3. You get a battlecard",
                body: "What to avoid, where the opening is, and what changed — on screen and in your inbox.",
                chip: CHIP.emerald,
              },
            ].map((step) => (
              <div key={step.title} className="flex gap-3 rounded-lg border p-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${step.chip}`}>
                  {step.icon}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{step.title}</span>
                  <span className="text-sm text-muted-foreground">{step.body}</span>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHelpOpen(false)}>
              Got it
            </Button>
            <Button
              onClick={() => {
                setHelpOpen(false);
                setTopic("AI code review");
              }}
            >
              Use example topic <ArrowRightIcon />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* full battlecard */}
      <Dialog open={battleOpen} onOpenChange={setBattleOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <SparklesIcon className="size-4 text-primary" />
              Full battlecard
            </DialogTitle>
            <DialogDescription className="text-sm">
              {data ? `“${data.topic}” · ${shortDate(data.generatedAt)}` : "No scan yet"}
            </DialogDescription>
          </DialogHeader>

          {data ? (
            <ScrollArea className="max-h-[60vh] pr-3">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Competition</span>
                    <span className="font-heading text-3xl leading-none font-semibold tabular-nums">
                      {score}
                      <span className="text-sm font-normal text-muted-foreground"> /100</span>
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={scoreVariant(score)} className={scoreChip(score)}>
                      {scoreLabel(score)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{data.analysis.sentiment}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={CHIP.rose}>
                    <ShieldAlertIcon /> avoid zone
                  </Badge>
                  <Badge variant="outline" className={CHIP.emerald}>
                    <SparklesIcon /> opening
                  </Badge>
                  <Badge variant="outline" className={CHIP.amber}>
                    <ZapIcon /> recent change
                  </Badge>
                  <Badge variant="outline">
                    <DatabaseIcon /> {data.stats.totalSignals} signals
                  </Badge>
                  <Badge variant="outline">
                    <StarIcon /> {formatCompact(data.stats.combinedStars)} stars
                  </Badge>
                </div>

                <Separator />

                {[
                  { title: "Don’t build this", body: data.analysis.killZone, chip: CHIP.rose },
                  { title: "Your opening", body: data.analysis.whiteSpaceMoat, chip: CHIP.emerald },
                  { title: "What changed", body: data.analysis.deltaAlert, chip: CHIP.amber },
                ].map((block) => (
                  <div key={block.title} className="flex flex-col gap-1 rounded-lg border p-3">
                    <Badge variant="outline" className={block.chip}>
                      {block.title}
                    </Badge>
                    <p className="text-sm leading-relaxed">{block.body}</p>
                  </div>
                ))}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{data.ai.model}</Badge>
                  <Badge variant="secondary">{data.ai.engine}</Badge>
                  <Badge variant="secondary">{data.ai.latencyMs}ms</Badge>
                  <Badge variant="outline">
                    <MailIcon /> {data.email.sent ? `sent to ${data.email.to}` : "not emailed"}
                  </Badge>
                </div>

                {data.ai.note ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {data.ai.note.slice(0, 300)}
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          ) : null}

          <DialogFooter className="justify-between">
            <Button variant="outline" onClick={() => setBattleOpen(false)}>
              Close
            </Button>
            <Button
              disabled={!data}
              onClick={() => {
                if (!data) return;
                void navigator.clipboard
                  .writeText(JSON.stringify(data, null, 2))
                  .then(() => toast.success("Full report copied"))
                  .catch(() => toast.error("Clipboard is blocked"));
              }}
            >
              <CopyIcon /> Copy report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* evidence detail */}
      <Dialog open={signal !== null} onOpenChange={(open) => !open && setSignal(null)}>
        <DialogContent className="sm:max-w-lg">
          {signal?.kind === "repo" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <GitBranchIcon className="size-4" />
                  {signal.item.fullName}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {signal.item.license ? `License: ${signal.item.license}` : "No license listed"} · updated{" "}
                  {relativeDays(signal.item.pushedAt)}
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {signal.item.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={CHIP.amber}>
                  <StarIcon /> {formatInt(signal.item.stars)} stars
                </Badge>
                <Badge variant="outline">
                  <GitForkIcon /> {formatInt(signal.item.forks)} forks
                </Badge>
                <Badge variant="secondary">{signal.item.language ?? "n/a"}</Badge>
                {signal.item.topics.slice(0, 4).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  render={
                    <a href={signal.item.url} target="_blank" rel="noreferrer noopener" />
                  }
                >
                  Open on GitHub <ExternalLinkIcon />
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {signal?.kind === "paper" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug">{signal.item.title}</DialogTitle>
                <DialogDescription className="text-sm">
                  Published {shortDate(signal.item.published)} · {signal.item.authors.length}{" "}
                  {signal.item.authors.length === 1 ? "author" : "authors"}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-64 pr-3">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {signal.item.summary}
                </p>
              </ScrollArea>
              <div className="flex flex-wrap gap-2">
                {signal.item.categories.map((category) => (
                  <Badge key={category} variant="outline" className={CHIP.violet}>
                    {category}
                  </Badge>
                ))}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  render={
                    <a href={signal.item.url} target="_blank" rel="noreferrer noopener" />
                  }
                >
                  Read on arXiv <ExternalLinkIcon />
                </Button>
              </DialogFooter>
            </>
          ) : null}

          {signal?.kind === "thread" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-base leading-snug">{signal.item.title}</DialogTitle>
                <DialogDescription className="text-sm">
                  From {hostOf(signal.item.url)} · posted {relativeDays(signal.item.createdAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={CHIP.sky}>
                  <MessageSquareIcon /> {formatInt(signal.item.points)} points
                </Badge>
                <Badge variant="outline">
                  {formatInt(signal.item.comments)} comments
                </Badge>
                <Badge variant="secondary">by {signal.item.author}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Open the thread for the full discussion.
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  render={
                    <a href={signal.item.url} target="_blank" rel="noreferrer noopener" />
                  }
                >
                  Open discussion <ExternalLinkIcon />
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* error details */}
      <Dialog open={errorOpen} onOpenChange={setErrorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-destructive">
              <TriangleAlertIcon className="size-4" />
              What went wrong
            </DialogTitle>
            <DialogDescription className="text-sm">
              Technical details you can share if you need help.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <span className="text-sm font-medium">{error?.error ?? "Unknown error"}</span>
            <span className="text-sm text-muted-foreground">{error?.detail}</span>
          </div>
          {error?.trace?.length ? (
            <ScrollArea className="max-h-40">
              <div className="flex flex-col gap-1 font-mono text-xs">
                {error.trace.map((entry, index) => (
                  <div key={`${entry.step}-${index}`} className="flex justify-between gap-2">
                    <span>{entry.step}</span>
                    <span className="text-muted-foreground">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorOpen(false)}>
              Close
            </Button>
            <Button onClick={() => void runScan(Boolean(email.trim()))}>Try again</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
