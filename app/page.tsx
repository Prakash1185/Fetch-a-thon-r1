"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIcon,
  BookOpenIcon,
  BotIcon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  GitForkIcon,
  GitBranchIcon,
  MailIcon,
  MessageSquareIcon,
  RadarIcon,
  SendIcon,
  ShieldAlertIcon,
  SparklesIcon,
  StarIcon,
  TerminalIcon,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCompact, formatInt, hostOf, relativeDays, shortDate } from "@/lib/scout/format";
import type {
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

const AGENT_STAGES = [
  { agent: "orchestrator", message: "handshake accepted · Fetch.ai uAgents bus online", level: "info" as const },
  { agent: "github.scout", message: "GET /search/repositories · sort=stars", level: "info" as const },
  { agent: "arxiv.scout", message: "GET export.arxiv.org/api/query · sortBy=submittedDate", level: "info" as const },
  { agent: "hn.scout", message: "GET hn.algolia.com/api/v1/search · tags=story", level: "info" as const },
  { agent: "gemini.analyst", message: "strict-json schema mode · scoring threat surface", level: "info" as const },
  { agent: "smtp.dispatcher", message: "nodemailer · queueing battlecard payload", level: "info" as const },
];

function stamp(): string {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function threatVariant(score: number) {
  if (score >= 70) return "destructive" as const;
  if (score >= 40) return "secondary" as const;
  return "default" as const;
}

function threatLabel(score: number) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "ELEVATED";
  if (score >= 25) return "MODERATE";
  return "OPEN";
}

function logDot(level: LogLevel) {
  if (level === "ok") return "bg-primary";
  if (level === "warn") return "bg-chart-4";
  if (level === "error") return "bg-destructive";
  return "bg-muted-foreground";
}

function paperAuthors(count: number) {
  return count === 1 ? "1 author" : `${count} authors`;
}

export default function Home() {
  const [topic, setTopic] = useState("");
  const [email, setEmail] = useState("");
  const [watchdog, setWatchdog] = useState(true);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ScoutResponse | null>(null);
  const [error, setError] = useState<ScoutErrorResponse | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [clock, setClock] = useState<Date | null>(null);

  const logSeq = useRef(0);
  const consoleRef = useRef<HTMLDivElement | null>(null);
  const stageTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const pushLog = useCallback(
    (agent: string, message: string, level: LogLevel = "info") => {
      logSeq.current += 1;
      const entry: LogEntry = {
        id: logSeq.current,
        time: stamp(),
        agent,
        message,
        level,
      };
      setLogs((current) => [...current.slice(-120), entry]);
    },
    [],
  );

  useEffect(() => {
    setClock(new Date());
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const node = consoleRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [logs]);

  useEffect(() => {
    return () => {
      if (stageTimer.current) clearInterval(stageTimer.current);
    };
  }, []);

  const runSwarm = useCallback(
    async (dispatchEmail: boolean) => {
      const target = topic.trim();
      if (target.length < 2) {
        toast.error("Topic required", {
          description: "Enter a startup or research topic to launch the swarm.",
        });
        return;
      }
      if (dispatchEmail && !email.trim()) {
        toast.error("Recipient required", {
          description: "Add a Gmail address before dispatching the update.",
        });
        return;
      }

      if (stageTimer.current) clearInterval(stageTimer.current);
      setLoading(true);
      setError(null);
      setLogs([]);
      pushLog("orchestrator", `swarm dispatch → "${target}"`, "ok");

      let stage = 0;
      stageTimer.current = setInterval(() => {
        const step = AGENT_STAGES[stage % AGENT_STAGES.length];
        pushLog(step.agent, step.message, step.level);
        stage += 1;
        if (stage >= AGENT_STAGES.length * 2 && stageTimer.current) {
          clearInterval(stageTimer.current);
          stageTimer.current = null;
        }
      }, 700);

      const started = performance.now();

      try {
        const res = await fetch("/api/scout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: target,
            alertEmail: email.trim(),
            mode: "recon",
          }),
        });

        const payload = (await res.json()) as ScoutResponse | ScoutErrorResponse;

        if (!res.ok || payload.success !== true) {
          const failure = payload as ScoutErrorResponse;
          setError(failure);
          pushLog("orchestrator", failure.error ?? "swarm failed", "error");
          toast.error(failure.error ?? "Swarm failed", {
            description: failure.detail,
          });
          return;
        }

        setData(payload);
        const elapsed = Math.round(performance.now() - started);

        payload.trace.forEach((entry: ScoutTraceEntry) => {
          pushLog(entry.step, entry.detail, entry.status === "error" ? "error" : entry.status === "warn" ? "warn" : "ok");
        });
        pushLog(
          "orchestrator",
          `swarm complete · ${payload.stats.totalSignals} signals in ${elapsed}ms`,
          "ok",
        );

        toast.success("Swarm complete", {
          description: `${payload.stats.totalSignals} signals · threat ${Math.round(
            payload.analysis.threatScore,
          )}/100`,
        });

        if (payload.email.requested && payload.email.sent) {
          toast.success("Battlecard emailed", {
            description: `Delivered to ${payload.email.to}`,
          });
        } else if (payload.email.requested && !payload.email.sent) {
          toast.warning("Email not sent", { description: payload.email.error });
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Unknown transport error";
        setError({ success: false, error: "Network failure", detail: message });
        pushLog("orchestrator", `transport error · ${message}`, "error");
        toast.error("Network failure", {
          description: "Could not reach /api/scout.",
        });
      } finally {
        if (stageTimer.current) {
          clearInterval(stageTimer.current);
          stageTimer.current = null;
        }
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
      {/* ---------------- telemetry navbar ---------------- */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4">
          <div className="flex size-8 shrink-0 items-center justify-center bg-primary text-primary-foreground">
            <RadarIcon className="size-4" />
          </div>

          <div className="min-w-0">
            <div className="font-heading text-sm font-semibold tracking-tight">
              PulseScout AI
            </div>
            <div className="hidden text-[10px] tracking-wider text-muted-foreground uppercase sm:block">
              swarm intelligence terminal
            </div>
          </div>

          <Badge variant="outline" className="hidden font-mono md:inline-flex">
            Next 16 · v2.4
          </Badge>

          <div className="ml-auto flex items-center gap-3">
            <Badge variant="secondary" className="gap-1.5">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping bg-primary opacity-70" />
                <span className="relative inline-flex size-1.5 bg-primary" />
              </span>
              Fetch.ai uAgents
              <span className="text-muted-foreground">active</span>
            </Badge>

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <div className="hidden items-center gap-2 sm:flex">
              <Label
                htmlFor="watchdog"
                className="text-xs text-muted-foreground"
              >
                24/7 Autonomous Watchdog
              </Label>
              <Switch
                id="watchdog"
                checked={watchdog}
                onCheckedChange={(checked) => {
                  setWatchdog(checked);
                  pushLog(
                    "orchestrator",
                    checked
                      ? "autonomous watchdog armed · interval 15m"
                      : "autonomous watchdog paused",
                    checked ? "ok" : "warn",
                  );
                  toast.info(
                    checked ? "Watchdog armed" : "Watchdog paused",
                    {
                      description: checked
                        ? "uAgents will re-scan and email deltas every 15 minutes."
                        : "Autonomous re-scans are suspended.",
                    },
                  );
                }}
              />
            </div>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="outline" size="icon-sm" aria-label="Clock" />
                }
              >
                <ClockIcon />
              </TooltipTrigger>
              <TooltipContent>
                {clock
                  ? clock.toLocaleTimeString("en-GB", { hour12: false })
                  : "--:--:--"}{" "}
                local
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4">
        {/* ---------------- command bar ---------------- */}
        <Card size="sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TerminalIcon className="size-4 text-muted-foreground" />
              Command bar
            </CardTitle>
            <CardDescription>
              Target a market. The swarm triangulates GitHub, arXiv and Hacker
              News, then emails the battlecard.
            </CardDescription>
            <CardAction>
              <Badge variant={watchdog ? "default" : "outline"}>
                {watchdog ? "watchdog on" : "watchdog off"}
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="topic" className="text-xs text-muted-foreground">
                  Startup / research topic
                </Label>
                <Input
                  id="topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void runSwarm(false);
                  }}
                  placeholder="e.g. agent observability for LLM pipelines"
                  maxLength={200}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-xs text-muted-foreground">
                  Recipient Gmail
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@gmail.com"
                />
              </div>

              <Button
                className="w-full md:w-auto"
                onClick={() => void runSwarm(true)}
                disabled={loading}
              >
                {loading ? (
                  <BotIcon className="animate-pulse" />
                ) : (
                  <SendIcon />
                )}
                {loading ? "Swarm running…" : "Run Swarm & Email"}
              </Button>
            </div>

            {error ? (
              <Alert variant="destructive" className="mt-3">
                <TriangleAlertIcon />
                <AlertTitle>{error.error}</AlertTitle>
                <AlertDescription>{error.detail}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        {/* ---------------- bento metrics ---------------- */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* threat score */}
          <Card size="sm">
            <CardHeader>
              <CardDescription>Market Threat Score</CardDescription>
              <CardAction>
                <Badge variant={data ? threatVariant(score) : "outline"}>
                  {data ? threatLabel(score) : "STANDBY"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loading && !data ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="font-heading text-4xl leading-none font-semibold tracking-tight tabular-nums">
                  {data ? score : "—"}
                  <span className="text-sm font-normal text-muted-foreground">
                    /100
                  </span>
                </div>
              )}
              <Progress value={data ? score : 0} />
              <p className="text-xs text-muted-foreground">
                {data
                  ? `${100 - score}% white space remaining · ${data.analysis.sentiment}`
                  : "Run a sweep to score saturation."}
              </p>
            </CardContent>
          </Card>

          {/* top github threat */}
          <Card size="sm">
            <CardHeader>
              <CardDescription>Top GitHub Threat</CardDescription>
              <CardAction>
                <Badge variant="outline">
                  <GitBranchIcon /> #{1}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {loading && !data ? (
                <>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </>
              ) : topRepo ? (
                <>
                  <div className="truncate font-heading text-sm font-medium">
                    {topRepo.fullName}
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {topRepo.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 font-medium">
                      <StarIcon className="size-3.5 text-chart-4" />
                      {formatInt(topRepo.stars)}
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <GitForkIcon className="size-3.5" />
                      {formatInt(topRepo.forks)}
                    </span>
                    <span className="ml-auto text-muted-foreground">
                      {topRepo.language ?? "n/a"}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No repository dominant detected.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="link"
                size="xs"
                className="px-0"
                disabled={!topRepo}
                render={
                  topRepo ? (
                    <a href={topRepo.url} target="_blank" rel="noreferrer noopener" />
                  ) : undefined
                }
              >
                inspect repository <ExternalLinkIcon />
              </Button>
            </CardFooter>
          </Card>

          {/* sources */}
          <Card size="sm">
            <CardHeader>
              <CardDescription>Total Triangulated Sources</CardDescription>
              <CardAction>
                <Badge variant="outline">
                  <DatabaseIcon /> 3 feeds
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {loading && !data ? (
                <Skeleton className="h-10 w-20" />
              ) : (
                <div className="font-heading text-4xl leading-none font-semibold tracking-tight tabular-nums">
                  {data ? formatInt(data.stats.totalSignals) : "—"}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">
                  <GitBranchIcon /> repos {data?.items.repositories.length ?? 0}
                </Badge>
                <Badge variant="outline">
                  <BookOpenIcon /> arxiv {data?.items.papers.length ?? 0}
                </Badge>
                <Badge variant="outline">
                  <MessageSquareIcon /> hn {data?.items.discussions.length ?? 0}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {data
                  ? `${formatCompact(data.stats.combinedStars)} combined stars · freshest ${data.stats.freshestSignalDays ?? "—"}d`
                  : "Concurrent multi-source capture."}
              </p>
            </CardContent>
          </Card>

          {/* smtp */}
          <Card size="sm">
            <CardHeader>
              <CardDescription>SMTP Dispatch Status</CardDescription>
              <CardAction>
                <Badge
                  variant={
                    delivered
                      ? "default"
                      : dispatchFailed
                        ? "destructive"
                        : "outline"
                  }
                >
                  {loading
                    ? "SENDING"
                    : delivered
                      ? "DELIVERED"
                      : dispatchFailed
                        ? "FAILED"
                        : "STANDBY"}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MailIcon className="size-4 text-muted-foreground" />
                <span className="truncate text-xs">
                  {data?.email.to ?? email.trim() ?? "no recipient"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {data?.email.sent
                  ? `Message queued · ${shortDate(data.generatedAt)}`
                  : dispatchFailed
                    ? data?.email.error
                    : "Battlecard ships as a formatted HTML email."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={loading || !data}
                onClick={() => void runSwarm(true)}
              >
                <ZapIcon /> New Update
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* ---------------- workspace ---------------- */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="flex min-w-0 flex-col gap-4">
            <Tabs defaultValue="battlecard" className="gap-3">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="battlecard">
                  <SparklesIcon /> AI Strategic Battlecard
                </TabsTrigger>
                <TabsTrigger value="evidence">
                  <ActivityIcon /> Live Evidence Matrix
                </TabsTrigger>
              </TabsList>

              {/* battlecard */}
              <TabsContent value="battlecard" className="flex flex-col gap-3">
                {loading && !data ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-40 w-full" />
                  </div>
                ) : data ? (
                  <>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <Card size="sm" className="border-destructive/40">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-destructive">
                            <ShieldAlertIcon className="size-4" />
                            The Kill-Zone
                          </CardTitle>
                          <CardDescription>
                            What not to build — already owned.
                          </CardDescription>
                          <CardAction>
                            <Badge variant="destructive">avoid</Badge>
                          </CardAction>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm leading-relaxed">
                            {data.analysis.killZone}
                          </p>
                        </CardContent>
                      </Card>

                      <Card size="sm" className="border-primary/40">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-primary">
                            <SparklesIcon className="size-4" />
                            The White-Space Moat
                          </CardTitle>
                          <CardDescription>
                            Unbuilt research gaps you can own.
                          </CardDescription>
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

                    <Card size="sm">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <ZapIcon className="size-4 text-chart-4" />
                          Delta Alert
                        </CardTitle>
                        <CardDescription>
                          Freshest movement in the last window.
                        </CardDescription>
                        <CardAction>
                          <Badge variant="secondary">{data.ai.engine}</Badge>
                        </CardAction>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed">
                          {data.analysis.deltaAlert}
                        </p>
                      </CardContent>
                      <CardFooter className="justify-between">
                        <span className="text-xs text-muted-foreground">
                          {data.ai.model} · {data.ai.latencyMs}ms
                        </span>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(JSON.stringify(data, null, 2))
                              .then(() =>
                                toast.success("Battlecard copied as JSON"),
                              )
                              .catch(() => toast.error("Clipboard blocked"));
                          }}
                        >
                          copy report
                        </Button>
                      </CardFooter>
                    </Card>
                  </>
                ) : (
                  <Card size="sm">
                    <CardContent className="flex flex-col items-center gap-1 py-10">
                      <RadarIcon className="size-6 text-muted-foreground" />
                      <p className="text-sm font-medium">No battlecard yet</p>
                      <p className="max-w-sm text-center text-xs text-muted-foreground">
                        Enter a topic in the command bar and run the swarm to
                        generate the kill-zone and moat analysis.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* evidence matrix */}
              <TabsContent value="evidence">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {/* github */}
                  <Card size="sm" className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GitBranchIcon className="size-4" />
                        GitHub Repos
                      </CardTitle>
                      <CardAction>
                        <Badge variant="outline">
                          {data?.items.repositories.length ?? 0}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[300px]">
                        <div className="flex flex-col gap-2 pr-2">
                          {loading && !data
                            ? Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-12 w-full" />
                              ))
                            : data?.items.repositories.map((repo) => (
                                <div
                                  key={repo.id}
                                  className="flex flex-col gap-1 border-b pb-2 last:border-0"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="truncate text-xs font-medium">
                                      {repo.fullName}
                                    </span>
                                    <span className="flex shrink-0 items-center gap-0.5 text-xs text-chart-4">
                                      <StarIcon className="size-3" />
                                      {formatCompact(repo.stars)}
                                    </span>
                                  </div>
                                  <p className="line-clamp-2 text-[11px] text-muted-foreground">
                                    {repo.description}
                                  </p>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Badge variant="outline">
                                      {repo.language ?? "n/a"}
                                    </Badge>
                                    <span>{relativeDays(repo.pushedAt)}</span>
                                  </div>
                                </div>
                              ))}
                          {data && data.items.repositories.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No repositories returned.
                            </p>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* arxiv */}
                  <Card size="sm" className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BookOpenIcon className="size-4" />
                        ArXiv Papers
                      </CardTitle>
                      <CardAction>
                        <Badge variant="outline">
                          {data?.items.papers.length ?? 0}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[300px]">
                        <div className="flex flex-col gap-2 pr-2">
                          {loading && !data
                            ? Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-14 w-full" />
                              ))
                            : data?.items.papers.map((paper) => (
                                <div
                                  key={paper.id}
                                  className="flex flex-col gap-1 border-b pb-2 last:border-0"
                                >
                                  <a
                                    href={paper.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="line-clamp-2 text-xs font-medium hover:underline hover:underline-offset-2"
                                  >
                                    {paper.title}
                                  </a>
                                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <span>{shortDate(paper.published)}</span>
                                    <span>·</span>
                                    <span>{paperAuthors(paper.authors.length)}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {paper.categories.slice(0, 2).map((category) => (
                                      <Badge key={category} variant="secondary">
                                        {category}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ))}
                          {data && data.items.papers.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No preprints returned.
                            </p>
                          ) : null}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  {/* hn */}
                  <Card size="sm" className="flex flex-col">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquareIcon className="size-4" />
                        Hacker News
                      </CardTitle>
                      <CardAction>
                        <Badge variant="outline">
                          {data?.items.discussions.length ?? 0}
                        </Badge>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex-1">
                      <ScrollArea className="h-[300px]">
                        <div className="flex flex-col gap-2 pr-2">
                          {loading && !data
                            ? Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton key={index} className="h-12 w-full" />
                              ))
                            : data?.items.discussions.map((thread) => (
                                <div
                                  key={thread.id}
                                  className="flex flex-col gap-1 border-b pb-2 last:border-0"
                                >
                                  <a
                                    href={thread.url}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="line-clamp-2 text-xs font-medium hover:underline hover:underline-offset-2"
                                  >
                                    {thread.title}
                                  </a>
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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
                                        ? "HOT"
                                        : thread.points >= 50
                                          ? "WARM"
                                          : "COLD"}
                                    </Badge>
                                    <span>{formatInt(thread.points)} pts</span>
                                    <span>·</span>
                                    <span>{formatInt(thread.comments)} comments</span>
                                  </div>
                                  <span className="truncate text-[11px] text-muted-foreground">
                                    {hostOf(thread.url)}
                                  </span>
                                </div>
                              ))}
                          {data && data.items.discussions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No discussions returned.
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

          {/* ---------------- uAgent console ---------------- */}
          <Card size="sm" className="flex h-[520px] flex-col xl:sticky xl:top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BotIcon className="size-4" />
                uAgent Telemetry
              </CardTitle>
              <CardDescription>
                Live execution stream · Fetch.ai swarm
              </CardDescription>
              <CardAction>
                <Badge variant={loading ? "default" : "outline"}>
                  <span
                    className={`size-1.5 ${
                      loading ? "animate-pulse bg-current" : "bg-muted-foreground"
                    }`}
                  />
                  {loading ? "streaming" : "idle"}
                </Badge>
              </CardAction>
            </CardHeader>

            <CardContent className="min-h-0 flex-1 p-0">
              <div
                ref={consoleRef}
                className="h-full overflow-y-auto bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed"
              >
                {logs.length === 0 ? (
                  <div className="flex flex-col gap-1 text-muted-foreground">
                    <span>$ pulsescout --watch</span>
                    <span>awaiting swarm dispatch…</span>
                  </div>
                ) : (
                  logs.map((entry) => (
                    <div key={entry.id} className="flex gap-2 py-0.5">
                      <span className="shrink-0 text-muted-foreground">
                        {entry.time}
                      </span>
                      <span
                        className={`mt-1.5 size-1 shrink-0 ${logDot(entry.level)}`}
                      />
                      <span className="shrink-0 text-muted-foreground">
                        [{entry.agent}]
                      </span>
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
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2Icon className="size-3.5" />
                {data
                  ? `${data.stats.totalSignals} signals triangulated`
                  : "no run yet"}
              </span>
              <span className="text-xs text-muted-foreground">
                {data ? `${data.items.repositories.length}r · ${data.items.papers.length}p · ${data.items.discussions.length}t` : "—"}
              </span>
            </CardFooter>
          </Card>
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <XCircleIcon className="size-3" />
            Threat scores are directional, not investment advice.
          </span>
          <span className="hidden sm:block">
            GitHub REST · arXiv Atom · HN Algolia · Gemini 2.5 Flash
          </span>
        </div>
      </main>
    </div>
  );
}
