
import Link from "next/link";
import {
  ArrowRight,
  Activity,
  Bot,
  CheckCircle2,
  Code2,
  Radar,
  Search,
  Sparkles,
  Workflow,
} from "lucide-react";

const features = [
  {
    icon: Search,
    number: "01",
    title: "Discover signals",
    description:
      "Explore GitHub, arXiv, Hacker News and other technology sources to uncover emerging trends.",
  },
  {
    icon: Bot,
    number: "02",
    title: "Turn research into insights",
    description:
      "Use AI-powered analysis to understand competitors, new technologies and startup opportunities.",
  },
  {
    icon: Workflow,
    number: "03",
    title: "Move from insight to action",
    description:
      "Organize findings into clear next steps so research becomes useful for real decisions.",
  },
];

const signals = [
  {
    icon: Search,
    title: "Research scan",
    detail: "Collecting public technology signals",
    status: "Completed",
  },
  {
    icon: Activity,
    title: "Signal analysis",
    detail: "Finding patterns and opportunities",
    status: "Analyzed",
  },
  {
    icon: CheckCircle2,
    title: "Insight report",
    detail: "Preparing actionable findings",
    status: "Ready",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#F4F7F8] text-[#243447]">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#087F78] text-white shadow-sm">
              <Radar size={23} />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight">
                Scout<span className="text-[#087F78]">R</span>
              </span>
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                Startup intelligence
              </p>
            </div>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
            <a href="#features" className="transition hover:text-[#087F78]">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-[#087F78]">
              How it works
            </a>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-[#087F78] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#066B65]"
          >
            Launch ScoutR
            <ArrowRight size={16} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-5 pb-20 pt-20 sm:px-8 sm:pb-28 sm:pt-28">
        <div className="pointer-events-none absolute -right-32 -top-20 h-96 w-96 rounded-full bg-[#BCE8DF]/50 blur-3xl" />
        <div className="pointer-events-none absolute -left-32 top-64 h-72 w-72 rounded-full bg-[#DCEDEA]/70 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-2 lg:gap-16">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#B9DFD8] bg-white px-4 py-2 text-xs font-semibold tracking-wide text-[#087F78] shadow-sm sm:text-sm">
              <Sparkles size={15} />
              AI-POWERED STARTUP INTELLIGENCE
            </div>

            <h1 className="max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              From scattered signals to{" "}
              <span className="text-[#087F78]">real action.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
              Research emerging technologies, track competitors, and discover
              startup opportunities — all in one intelligent workspace.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087F78] px-6 py-3.5 font-semibold text-white shadow-lg shadow-[#087F78]/15 transition hover:-translate-y-0.5 hover:bg-[#066B65]"
              >
                Launch ScoutR
                <ArrowRight size={18} />
              </Link>

              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 font-semibold text-[#243447] transition hover:border-[#087F78] hover:text-[#087F78]"
              >
                Explore how it works
              </a>
            </div>

            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#087F78]" />
                Evidence-backed insights
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#087F78]" />
                Multiple research sources
              </span>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-4 rounded-[2rem] bg-[#BCE8DF]/40 blur-2xl" />

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40">
              <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E2F3F0] text-[#087F78]">
                    <Radar size={20} />
                  </div>
                  <div>
                    <p className="font-semibold">ScoutR Workspace</p>
                    <p className="text-xs text-slate-500">
                      Startup research console
                    </p>
                  </div>
                </div>

                <span className="flex items-center gap-2 rounded-full bg-[#E2F3F0] px-3 py-1.5 text-xs font-semibold text-[#087F78]">
                  <span className="h-2 w-2 rounded-full bg-[#087F78]" />
                  Active
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="rounded-xl border border-slate-200 bg-[#F8FAFA] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-500">
                        RESEARCH OVERVIEW
                      </p>
                      <h3 className="mt-2 text-xl font-bold">
                        Your next opportunity starts here.
                      </h3>
                    </div>
                    <div className="rounded-xl bg-[#E2F3F0] p-3 text-[#087F78]">
                      <Sparkles size={22} />
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">Research sources</p>
                      <p className="mt-2 text-2xl font-bold">04</p>
                      <p className="mt-1 text-xs text-[#087F78]">
                        Connected sources
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs text-slate-500">Workflow</p>
                      <p className="mt-2 text-2xl font-bold">AI</p>
                      <p className="mt-1 text-xs text-[#087F78]">
                        Insight generation
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="font-semibold">Research activity</h3>
                    <span className="text-xs text-slate-500">
                      Workflow preview
                    </span>
                  </div>

                  <div className="space-y-3">
                    {signals.map((item) => (
                      <div
                        key={item.title}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#E2F3F0] text-[#087F78]">
                          <item.icon size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.detail}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[#E2F3F0] px-2.5 py-1 text-[10px] font-semibold text-[#087F78] sm:text-xs">
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-3 rounded-xl bg-[#243447] p-4 text-white">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#8DE0D0]">
                    <Code2 size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      Research meets strategy
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-300">
                      Bring public technology signals into one workspace.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg sm:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E2F3F0] text-[#087F78]">
                <CheckCircle2 size={19} />
              </div>
              <div>
                <p className="text-sm font-semibold">Insights organized</p>
                <p className="text-xs text-slate-500">Ready for review</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Source strip */}
      <section className="border-y border-slate-200 bg-white/80 px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Explore signals across the technology ecosystem
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-semibold text-slate-600 sm:text-base">
            <span>GitHub</span>
            <span>arXiv</span>
            <span>Hacker News</span>
            <span>Technology research</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#087F78]">
              Built for better decisions
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Research less chaotically.
              <br />
              <span className="text-[#087F78]">Think more strategically.</span>
            </h2>
            <p className="mt-5 leading-7 text-slate-600">
              ScoutR helps bring scattered public information together and
              organize it into useful startup intelligence.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.number}
                className="group rounded-2xl border border-slate-200 bg-white p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[#9BCFC5] hover:shadow-xl hover:shadow-slate-200/60"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E2F3F0] text-[#087F78] transition group-hover:bg-[#087F78] group-hover:text-white">
                    <feature.icon size={23} />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">
                    {feature.number}
                  </span>
                </div>

                <h3 className="mt-7 text-xl font-bold">{feature.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="border-y border-slate-200 bg-white px-5 py-20 sm:px-8 sm:py-24"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#087F78]">
              How it works
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              From a question to a clearer direction.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-slate-600">
              Start with a startup, competitor, technology or research topic.
              ScoutR helps gather relevant signals and turn them into a
              structured view of what matters.
            </p>

            <Link
              href="/"
              className="mt-8 inline-flex items-center gap-2 font-semibold text-[#087F78] transition hover:gap-3"
            >
              Start exploring <ArrowRight size={18} />
            </Link>
          </div>

          <div className="space-y-4">
            {[
              {
                n: "01",
                title: "Choose a topic",
                desc: "Define the startup, market or technology you want to explore.",
              },
              {
                n: "02",
                title: "Gather public signals",
                desc: "Research relevant sources and review the evidence collected.",
              },
              {
                n: "03",
                title: "Review your insights",
                desc: "Use the resulting analysis to inform your next decision.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="flex gap-4 rounded-2xl border border-slate-200 bg-[#F8FAFA] p-5 sm:p-6"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#087F78] text-sm font-bold text-white">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-20 sm:px-8 sm:py-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-[#243447] px-6 py-14 text-center text-white sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[#087F78]/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-36 -left-16 h-72 w-72 rounded-full bg-[#087F78]/30 blur-3xl" />

          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#8DE0D0]">
              <Radar size={28} />
            </div>

            <h2 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Ready to explore what&apos;s next?
            </h2>
            <p className="mt-4 leading-7 text-slate-300">
              Bring your research into one place and start turning signals
              into meaningful insights.
            </p>

            <Link
              href="/"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[#087F78] px-6 py-3.5 font-semibold text-white transition hover:bg-[#0A948A]"
            >
              Launch ScoutR
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-5 py-7 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#087F78] text-white">
              <Radar size={18} />
            </div>
            <span className="font-bold">
              Scout<span className="text-[#087F78]">R</span>
            </span>
          </Link>

          <p className="text-center text-sm text-slate-500">
            Startup intelligence, organized for action.
          </p>

          <Link
            href="/"
            className="text-sm font-semibold text-[#087F78] transition hover:text-[#066B65]"
          >
            Open workspace <ArrowRight className="ml-1 inline" size={14} />
          </Link>
        </div>
      </footer>
    </main>
  );
}
