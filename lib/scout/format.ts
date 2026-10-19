export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return value.toLocaleString();
}

export function formatInt(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "0";
}

export function relativeDays(iso?: string | null): string {
  if (!iso) return "n/a";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "n/a";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function shortDate(iso?: string | null): string {
  if (!iso) return "—";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "—";
  return new Date(ts).toISOString().slice(0, 10);
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface ThreatBand {
  label: string;
  text: string;
  bg: string;
  border: string;
  bar: string;
  hex: string;
}

export function threatBand(score: number): ThreatBand {
  if (score >= 75) {
    return {
      label: "CRITICAL",
      text: "text-rose-300",
      bg: "bg-rose-500/10",
      border: "border-rose-500/40",
      bar: "[&_[data-slot=progress-indicator]]:bg-rose-400",
      hex: "#fb7185",
    };
  }
  if (score >= 50) {
    return {
      label: "ELEVATED",
      text: "text-amber-300",
      bg: "bg-amber-500/10",
      border: "border-amber-500/40",
      bar: "[&_[data-slot=progress-indicator]]:bg-amber-400",
      hex: "#fbbf24",
    };
  }
  if (score >= 25) {
    return {
      label: "MODERATE",
      text: "text-cyan-300",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/40",
      bar: "[&_[data-slot=progress-indicator]]:bg-cyan-400",
      hex: "#22d3ee",
    };
  }
  return {
    label: "OPEN",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    bar: "[&_[data-slot=progress-indicator]]:bg-emerald-400",
    hex: "#34d399",
  };
}

export function modeLabel(mode: string): string {
  if (mode === "rapid") return "RAPID";
  if (mode === "deep-dive") return "DEEP DIVE";
  return "RECON";
}

export function clockStamp(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds(),
  )}Z`;
}
