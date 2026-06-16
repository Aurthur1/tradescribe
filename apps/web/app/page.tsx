import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  BrainCircuit,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Filter,
  Github,
  Globe2,
  LineChart,
  Linkedin,
  LockKeyhole,
  PieChart,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Twitter,
  UploadCloud,
  Zap
} from "lucide-react";
import Link from "next/link";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Coaching", href: "#coaching" },
  { label: "Guardrails", href: "#guardrails" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" }
];

const trustRow = ["No credit card to start", "Read-only access", "Cancel anytime"];

const specStrip = [
  { label: "Broker access", value: "Investor password only" },
  { label: "Launch market", value: "Prop-firm forex" },
  { label: "Data source", value: "MT4 / MT5 via MetaApi" },
  { label: "AI role", value: "Coach, not calculator" }
];

const productTiles = [
  {
    icon: LineChart,
    title: "Automatic trade memory",
    body: "Backfill account history, keep new closed trades current, and normalize MT4 and MT5 execution into one journal."
  },
  {
    icon: BarChart3,
    title: "Deterministic performance truth",
    body: "Expectancy, drawdown, R multiples, profit factor, sessions, and symbols are computed in code."
  },
  {
    icon: BrainCircuit,
    title: "Weekly coaching that remembers",
    body: "Coach Profile context helps weekly reviews build on recurring leaks and prior advice."
  },
  {
    icon: ShieldCheck,
    title: "Prop-firm risk discipline",
    body: "Daily-loss, total drawdown, and profit-target guardrails keep challenge rules visible."
  }
];

const leakRows = [
  { label: "Revenge trade", detail: "Loss followed by fast re-entry with abnormal size" },
  { label: "Missing stop", detail: "Closed trade with no planned loss recorded" },
  { label: "Risk inconsistency", detail: "Position sizing variance outside the trader baseline" },
  { label: "Overtrading cluster", detail: "Trade count spike after a losing sequence" }
];

const guardrails = [
  "Max daily loss tracked in the broker timezone",
  "Static and trailing drawdown modes for different prop firms",
  "Warnings framed as discipline alerts, never promises"
];

const featureGrid = [
  {
    icon: BarChart3,
    title: "Performance Analytics",
    body: "Win rate, expectancy, profit factor, drawdown, and R-multiple summaries."
  },
  {
    icon: Zap,
    title: "Behavioral Leak Detection",
    body: "Flags patterns such as revenge trades, overtrading, and inconsistent risk."
  },
  {
    icon: CalendarDays,
    title: "P&L Calendar",
    body: "See trading days, streaks, and session behavior without spreadsheet work."
  },
  {
    icon: Filter,
    title: "Smart Filtering",
    body: "Review trades by account, symbol, session, setup, emotion, or outcome."
  },
  {
    icon: BrainCircuit,
    title: "AI Weekly Review",
    body: "Plain-language coaching grounded in deterministic metrics and evidence trades."
  },
  {
    icon: PieChart,
    title: "Trade Distribution",
    body: "Understand concentration by symbol, side, session, duration, and risk."
  },
  {
    icon: Clock3,
    title: "Session & Timing Analysis",
    body: "Surface when your execution quality improves or deteriorates."
  },
  {
    icon: UploadCloud,
    title: "MetaTrader Integration",
    body: "Read-only MT4 and MT5 sync through MetaApi at launch."
  }
];

const integrationChecks = [
  "Automatic trade import",
  "MT4 and MT5 support",
  "Secure read-only connection",
  "Full history backfill"
];

const journalChecks = [
  "Trade screenshots",
  "Strategy tagging",
  "Emotion tracking",
  "Performance correlation"
];

const pricingPlans = [
  {
    name: "Free",
    priceUsd: "$0",
    priceNgn: "₦0",
    summary: "For trying the journal with one connected account.",
    cta: "Start free",
    featured: false,
    items: ["1 account", "Capped trade history", "Basic metrics", "No AI review"]
  },
  {
    name: "Core",
    priceUsd: "$15",
    priceNgn: "₦24,000",
    summary: "For serious traders who want weekly coaching.",
    cta: "Start Core",
    featured: true,
    items: ["Auto-sync", "Weekly AI review", "Leak detection", "One prop guardrail"]
  },
  {
    name: "Pro",
    priceUsd: "$29",
    priceNgn: "₦46,000",
    summary: "For multi-account traders and funded-account workflows.",
    cta: "Start Pro",
    featured: false,
    items: ["Multiple accounts", "Full guardrails", "Priority processing", "Advanced review history"]
  }
];

const securityCards = [
  {
    icon: LockKeyhole,
    title: "No master password",
    body: "The connection flow is designed around investor credentials and read-only account references."
  },
  {
    icon: ShieldCheck,
    title: "Tenant-scoped data",
    body: "Every user-data path is designed to carry user ownership from the API layer down."
  },
  {
    icon: Clock3,
    title: "Queued heavy work",
    body: "Sync, metrics, leak detection, and reviews run as observable background jobs."
  },
  {
    icon: BookOpenText,
    title: "Advisory language",
    body: "Copy and AI output stay framed as analytics and education, not financial advice."
  }
];

const faqs = [
  {
    question: "Is it safe to connect my trading account?",
    answer:
      "TradeScribe is designed for investor-password access only. That means it can read history and account state, but it cannot place or modify trades."
  },
  {
    question: "What data does TradeScribe read?",
    answer:
      "The product reads trade history, account balance/equity snapshots, symbols, position sizing, stops, take-profits, and related execution metadata needed for journaling and analytics."
  },
  {
    question: "Why read-only instead of full broker access?",
    answer:
      "Read-only access keeps the product focused on review, discipline, and education while avoiding the dangerous permission to execute trades."
  },
  {
    question: "Can it support prop-firm rules?",
    answer:
      "The guardrail model is designed for configurable max daily loss, total drawdown, trailing drawdown, and profit-target monitoring."
  },
  {
    question: "Can the AI predict markets?",
    answer:
      "No. The AI explains your execution data and behavioral patterns. It does not predict markets, provide signals, or guarantee outcomes."
  },
  {
    question: "Can I delete my data?",
    answer:
      "The launch plan includes data export and hard delete flows that purge trades, notes, screenshots, and the linked MetaApi account."
  }
];

function GradientText({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] bg-clip-text text-transparent">
      {children}
    </span>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-slate-300 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
      {children}
    </span>
  );
}

function GlassCard({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[14px] border border-white/[0.08] bg-white/[0.03] shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <Link
      className="group inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] px-5 text-sm font-semibold text-white shadow-[0_18px_60px_rgba(59,130,246,0.32)] transition hover:shadow-[0_22px_72px_rgba(99,102,241,0.44)] focus:outline-none focus:ring-2 focus:ring-[#8B5CF6] focus:ring-offset-2 focus:ring-offset-[#0A0E17]"
      href="/dashboard"
    >
      {children}
      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function SectionHeader({
  eyebrow,
  title,
  body
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Badge>{eyebrow}</Badge>
      <h2 className="mt-5 text-balance text-3xl font-semibold leading-tight text-[#F8FAFC] sm:text-4xl">
        {title}
      </h2>
      {body ? <p className="mt-4 text-sm leading-7 text-[#94A3B8] sm:text-base">{body}</p> : null}
    </div>
  );
}

function WeeklyReviewMockup() {
  return (
    <GlassCard className="mx-auto max-w-[980px] overflow-hidden">
      <div className="border-b border-white/[0.08] bg-[#0F172A]/80 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-500">TradeScribe</p>
            <h2 className="mt-1 text-sm font-semibold text-white">Weekly review dashboard</h2>
          </div>
          <div className="flex gap-2 text-xs text-slate-400">
            <span className="rounded-full bg-white/[0.05] px-3 py-1.5">Apr 8 - Apr 12</span>
            <span className="rounded-full bg-white/[0.05] px-3 py-1.5">Illustrative</span>
          </div>
        </div>
      </div>

      <div className="grid gap-px bg-white/[0.06] md:grid-cols-[220px_1fr]">
        <aside className="hidden bg-[#0B1220] p-4 md:block">
          {["Dashboard", "Trades", "Calendar", "Reviews", "Guardrails", "Settings"].map(
            (item, index) => (
              <div
                className={`mb-2 rounded-[10px] px-3 py-2 text-xs ${
                  index === 0
                    ? "bg-gradient-to-r from-[#3B82F6] to-[#6366F1] text-white"
                    : "text-slate-500"
                }`}
                key={item}
              >
                {item}
              </div>
            )
          )}
        </aside>

        <div className="bg-[#0B1220] p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Net P&L", value: "+$2,700", tone: "text-[#22C55E]" },
              { label: "Win rate", value: "64%", tone: "text-white" },
              { label: "Avg R", value: "2.14", tone: "text-white" },
              { label: "Trades", value: "128", tone: "text-white" }
            ].map((metric) => (
              <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-4" key={metric.label}>
                <p className="text-xs text-slate-500">{metric.label}</p>
                <p className={`mt-2 text-xl font-semibold ${metric.tone}`}>{metric.value}</p>
                <p className="mt-1 text-[11px] text-slate-600">Static preview</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
            <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Equity curve</p>
                <LineChart className="h-4 w-4 text-[#3B82F6]" aria-hidden />
              </div>
              <div className="mt-5 h-44 overflow-hidden rounded-[10px] bg-[#0F172A] p-4">
                <div className="relative h-full">
                  <div className="absolute inset-x-0 bottom-0 h-px bg-white/[0.08]" />
                  <div className="absolute inset-y-0 left-1/4 w-px bg-white/[0.06]" />
                  <div className="absolute inset-y-0 left-2/4 w-px bg-white/[0.06]" />
                  <div className="absolute inset-y-0 left-3/4 w-px bg-white/[0.06]" />
                  <div className="absolute bottom-5 left-0 h-12 w-[18%] rounded-t-[8px] bg-[#1D4ED8]/60" />
                  <div className="absolute bottom-9 left-[18%] h-20 w-[18%] rounded-t-[8px] bg-[#2563EB]/70" />
                  <div className="absolute bottom-16 left-[36%] h-28 w-[18%] rounded-t-[8px] bg-[#3B82F6]/80" />
                  <div className="absolute bottom-11 left-[54%] h-16 w-[18%] rounded-t-[8px] bg-[#6366F1]/80" />
                  <div className="absolute bottom-14 left-[72%] h-24 w-[18%] rounded-t-[8px] bg-[#8B5CF6]/80" />
                </div>
              </div>
            </div>

            <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">Weekly review</p>
                <Target className="h-4 w-4 text-[#8B5CF6]" aria-hidden />
              </div>
              <div className="mt-4 space-y-4">
                {[
                  { label: "Revenge-trade risk", value: "Down 31%", width: "w-[72%]" },
                  { label: "No-stop exposure", value: "3 trades", width: "w-[44%]" },
                  { label: "Daily-loss buffer", value: "68% safe", width: "w-[68%]" }
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex justify-between gap-3 text-xs">
                      <span className="text-slate-400">{item.label}</span>
                      <span className="font-semibold text-white">{item.value}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/[0.08]">
                      <div className={`h-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] ${item.width}`} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[10px] border border-[#3B82F6]/20 bg-[#3B82F6]/10 p-3">
                <p className="text-xs font-semibold text-[#93C5FD]">Next action</p>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  Stop trading for 30 minutes after two consecutive losses. Largest drawdowns
                  cluster inside that window.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  body
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
}) {
  return (
    <GlassCard className="p-5 transition hover:-translate-y-1 hover:border-[#3B82F6]/40 hover:bg-white/[0.045]">
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#3B82F6]/10 text-[#60A5FA]">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <h3 className="mt-6 text-base font-semibold text-[#F8FAFC]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[#94A3B8]">{body}</p>
    </GlassCard>
  );
}

function Checklist({ items }: { items: string[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li className="flex gap-3 text-sm text-[#CBD5E1]" key={item}>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[var(--ts-bg)] text-[#F8FAFC]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.20),transparent_34%),radial-gradient(circle_at_90%_25%,rgba(139,92,246,0.12),transparent_30%),#0A0E17]" />

      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0A0E17]/78 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-5">
          <Link className="flex items-center gap-3 focus:outline-none focus:ring-2 focus:ring-[#6366F1]" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] text-sm font-black text-white shadow-[0_12px_40px_rgba(99,102,241,0.35)]">
              TS
            </span>
            <span className="text-sm font-semibold text-white">TradeScribe</span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm text-[#94A3B8] lg:flex">
            {navItems.map((item) => (
              <a className="transition hover:text-white" href={item.href} key={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link className="hidden text-sm font-medium text-[#CBD5E1] transition hover:text-white sm:inline" href="/dashboard">
              Login
            </Link>
            <PrimaryButton>Sign up</PrimaryButton>
          </div>
        </div>
      </header>

      <section className="relative px-5 pb-20 pt-20 sm:pb-24 sm:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-12 h-80 w-[760px] -translate-x-1/2 rounded-full bg-[#3B82F6]/20 blur-3xl" />
        <div className="relative mx-auto max-w-[1200px] text-center">
          <Badge>
            <LockKeyhole className="h-3.5 w-3.5 text-[#60A5FA]" aria-hidden />
            Read-only MT4/MT5 analytics for funded-account discipline
          </Badge>

          <h1 className="mx-auto mt-7 max-w-5xl text-balance text-[clamp(44px,6vw,72px)] font-bold leading-[0.98] tracking-tight text-[#F8FAFC]">
            The trading journal that tells <GradientText>the truth</GradientText> before the
            account does.
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-pretty text-base leading-8 text-[#94A3B8] sm:text-lg">
            TradeScribe connects read-only to MetaTrader, auto-journals every closed trade, detects
            behavioral leaks, and turns execution history into weekly coaching.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <PrimaryButton>Connect read-only account</PrimaryButton>
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] border border-white/[0.12] bg-white/[0.03] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#6366F1]"
              href="#product"
            >
              Explore the product
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <p className="mt-5 text-sm text-[#94A3B8]">
            Advisory analytics only. No trade execution, no signals, no profit guarantees.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            {trustRow.map((item) => (
              <span className="inline-flex items-center gap-2 text-xs text-[#94A3B8]" key={item}>
                <CheckCircle2 className="h-4 w-4 text-[#3B82F6]" aria-hidden />
                {item}
              </span>
            ))}
          </div>

          <div className="mt-14">
            <WeeklyReviewMockup />
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0D1320]/70 px-5">
        <div className="mx-auto grid max-w-[1200px] gap-px overflow-hidden lg:grid-cols-4">
          {specStrip.map((item) => (
            <div className="bg-white/[0.02] px-5 py-6" key={item.label}>
              <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{item.label}</p>
              <p className="mt-2 text-sm font-semibold text-[#F8FAFC]">{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-24 sm:py-28" id="product">
        <div className="mx-auto max-w-[1200px]">
          <SectionHeader
            eyebrow="Product system"
            title="Everything that matters, without spreadsheet theatre."
            body="The workspace is quiet by design: synced trades, deterministic numbers, and coaching output separated from calculation."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {productTiles.map((tile) => (
              <FeatureCard {...tile} key={tile.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0D1320] px-5 py-24 sm:py-28" id="coaching">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Badge>
              <BrainCircuit className="h-3.5 w-3.5 text-[#8B5CF6]" aria-hidden />
              AI-native, not AI-reckless
            </Badge>
            <h2 className="mt-6 max-w-xl text-balance text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Code computes the truth. AI explains what to do with it.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-[#94A3B8]">
              The AI never calculates displayed numbers. It receives compact summaries,
              representative trades, and trusted leak flags, then returns structured coaching.
            </p>
          </div>

          <div className="grid gap-4">
            <GlassCard className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#94A3B8]">Detected this week</p>
                  <h3 className="mt-1 text-2xl font-semibold text-white">Behavioral leaks</h3>
                </div>
                <Sparkles className="h-6 w-6 text-[#8B5CF6]" aria-hidden />
              </div>
              <div className="mt-6 divide-y divide-white/[0.08]">
                {leakRows.map((row) => (
                  <div className="grid gap-2 py-4 sm:grid-cols-[170px_1fr]" key={row.label}>
                    <p className="text-sm font-semibold text-white">{row.label}</p>
                    <p className="text-sm leading-6 text-[#94A3B8]">{row.detail}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard className="border-[#8B5CF6]/25 bg-[#8B5CF6]/[0.08] p-6">
              <p className="text-sm font-semibold text-[#C4B5FD]">Coach profile memory</p>
              <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">
                Recurring leaks, risk profile, goals, and prior advice feed the next weekly review
                so coaching compounds instead of resetting.
              </p>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:py-28" id="guardrails">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <GlassCard className="p-6">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
              <div>
                <p className="text-sm text-[#94A3B8]">Prop challenge monitor</p>
                <h3 className="mt-1 text-2xl font-semibold text-white">Risk room</h3>
              </div>
              <CalendarDays className="h-7 w-7 text-[#60A5FA]" aria-hidden />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Daily loss used", value: "42%" },
                { label: "Drawdown room", value: "$4,820" },
                { label: "Target progress", value: "61%" }
              ].map((metric) => (
                <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-4" key={metric.label}>
                  <p className="text-xs uppercase tracking-[0.12em] text-[#64748B]">{metric.label}</p>
                  <p className="mt-3 text-2xl font-semibold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full w-[61%] rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6]" />
            </div>
            <p className="mt-3 text-xs text-[#64748B]">Static illustrative preview, not live data.</p>
          </GlassCard>

          <div>
            <Badge>
              <Target className="h-3.5 w-3.5 text-[#60A5FA]" aria-hidden />
              Prop-firm first
            </Badge>
            <h2 className="mt-6 text-balance text-3xl font-semibold leading-tight text-white sm:text-5xl">
              Guardrails for the rules traders actually fail.
            </h2>
            <div className="mt-7 space-y-4">
              {guardrails.map((item) => (
                <div className="flex gap-3" key={item}>
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#22C55E]" aria-hidden />
                  <p className="text-sm leading-6 text-[#CBD5E1]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0D1320] px-5 py-24 sm:py-28">
        <div className="mx-auto max-w-[1200px]">
          <SectionHeader
            eyebrow="Workspace"
            title="Everything in one quiet workspace"
            body="Designed for repeated review, fast filtering, and a calmer relationship with your own execution data."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureGrid.map((feature) => (
              <FeatureCard {...feature} key={feature.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:py-28">
        <div className="mx-auto grid max-w-[1200px] gap-5 lg:grid-cols-2">
          <GlassCard className="p-6 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#3B82F6]/10 text-[#60A5FA]">
              <UploadCloud className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-8 text-2xl font-semibold text-white">Read-only data integration</h2>
            <p className="mt-3 text-sm leading-7 text-[#94A3B8]">
              Connect once, sync automatically, and review history without giving TradeScribe any
              permission to trade.
            </p>
            <div className="mt-6">
              <Checklist items={integrationChecks} />
            </div>
          </GlassCard>

          <GlassCard className="p-6 sm:p-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#8B5CF6]/10 text-[#C4B5FD]">
              <BookOpenText className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-8 text-2xl font-semibold text-white">Trade journal with real context</h2>
            <p className="mt-3 text-sm leading-7 text-[#94A3B8]">
              Broker history provides execution truth. Notes, screenshots, strategy tags, and
              emotions add the human context.
            </p>
            <div className="mt-6">
              <Checklist items={journalChecks} />
            </div>
          </GlassCard>
        </div>
      </section>

      <section className="relative border-y border-white/[0.06] bg-[#0D1320] px-5 py-24 sm:py-28" id="pricing">
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-[700px] -translate-x-1/2 rounded-full bg-[#6366F1]/15 blur-3xl" />
        <div className="relative mx-auto max-w-[1200px]">
          <SectionHeader
            eyebrow="Pricing"
            title="Simple plans for the launch wedge"
            body="USD and Naira prices are starting placeholders for planning and may be tuned before launch."
          />

          <div className="mt-7 flex justify-center">
            <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-1 text-sm">
              <span className="rounded-full px-4 py-2 text-[#94A3B8]">Monthly</span>
              <span className="rounded-full bg-white/[0.08] px-4 py-2 font-semibold text-white">
                Annual <span className="text-[#22C55E]">Save 20%</span>
              </span>
            </div>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <GlassCard
                className={`p-6 ${plan.featured ? "border-[#6366F1]/60 shadow-[0_28px_100px_rgba(99,102,241,0.24)]" : ""}`}
                key={plan.name}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{plan.summary}</p>
                  </div>
                  {plan.featured ? (
                    <span className="rounded-full bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  ) : null}
                </div>

                <div className="mt-7">
                  <p className="text-4xl font-bold text-white">{plan.priceUsd}</p>
                  <p className="mt-2 text-sm text-[#94A3B8]">
                    {plan.priceNgn} / month equivalent
                  </p>
                </div>

                <Link
                  className={`mt-7 inline-flex h-11 w-full items-center justify-center rounded-[10px] text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#6366F1] ${
                    plan.featured
                      ? "bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] text-white shadow-[0_18px_60px_rgba(59,130,246,0.25)]"
                      : "border border-white/[0.12] bg-white/[0.03] text-white hover:bg-white/[0.06]"
                  }`}
                  href="/dashboard"
                >
                  {plan.cta}
                </Link>

                <div className="mt-7">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#64748B]">
                    What&apos;s included
                  </p>
                  <div className="mt-4">
                    <Checklist items={plan.items} />
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>

          <p className="mt-8 text-center text-sm text-[#94A3B8]">
            Advisory analytics, not investment advice. Need a team plan?{" "}
            <a className="font-semibold text-[#93C5FD] hover:text-white" href="mailto:hello@tradescribe.local">
              Contact us
            </a>
            .
          </p>
        </div>
      </section>

      <section className="px-5 py-24 sm:py-28" id="security">
        <div className="mx-auto max-w-[1200px]">
          <SectionHeader
            eyebrow="Security posture"
            title="Designed to avoid the dangerous permissions entirely."
            body="The safest trading account permission is the one a journaling product never asks for."
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {securityCards.map((card) => (
              <FeatureCard {...card} key={card.title} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/[0.06] bg-[#0D1320] px-5 py-24 sm:py-28">
        <div className="mx-auto max-w-[1200px]">
          <SectionHeader
            eyebrow="Testimonials"
            title="Customer stories will go here after launch"
            body="Placeholder cards are intentionally marked and contain no performance or return claims."
          />

          {/* Replace these placeholders only with real customer-approved quotes. Never include profit, return, or guaranteed-outcome claims. */}
          <div className="mx-auto mt-10 max-w-3xl">
            <GlassCard className="p-6 sm:p-8">
              <div className="flex gap-1 text-[#FBBF24]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star className="h-4 w-4 fill-current" aria-hidden key={index} />
                ))}
              </div>
              <blockquote className="mt-6 text-lg font-semibold leading-8 text-white">
                &ldquo;PLACEHOLDER: Replace with a real customer quote about journaling consistency,
                review discipline, or workflow clarity.&rdquo;
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] text-sm font-bold">
                  RC
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Real Customer Name</p>
                  <p className="text-xs text-[#94A3B8]">Verified trader, title pending</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <section className="px-5 py-24 sm:py-28" id="faq">
        <div className="mx-auto max-w-[900px]">
          <SectionHeader
            eyebrow="FAQ"
            title="Questions traders should ask before connecting anything"
          />
          <div className="mt-10 divide-y divide-white/[0.08] overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.03]">
            {faqs.map((faq) => (
              <details className="group p-5 open:bg-white/[0.025]" key={faq.question}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-semibold text-white">
                  {faq.question}
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#94A3B8] transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[#94A3B8]">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-24">
        <div className="mx-auto max-w-[1200px] rounded-[14px] border border-white/[0.08] bg-gradient-to-br from-[#111827] to-[#0F172A] p-6 shadow-[0_30px_120px_rgba(59,130,246,0.14)] sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <h2 className="text-balance text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Start with read-only. See the truth this week.
              </h2>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  "Automatic trade journaling",
                  "Deterministic analytics",
                  "Behavioral leak review",
                  "Prop-firm guardrail ready"
                ].map((item) => (
                  <div className="flex gap-3 text-sm text-[#CBD5E1]" key={item}>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3B82F6]" aria-hidden />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <GlassCard className="p-5">
              <p className="text-sm font-semibold text-white">Start your journey</p>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
                Open the current app shell while the MetaApi connection flow is built next.
              </p>
              <div className="mt-5">
                <PrimaryButton>Open dashboard</PrimaryButton>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] px-5 py-12">
        <div className="mx-auto grid max-w-[1200px] gap-10 lg:grid-cols-[1.35fr_repeat(4,1fr)]">
          <div>
            <Link className="flex items-center gap-3" href="/">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3B82F6] via-[#6366F1] to-[#8B5CF6] text-sm font-black text-white">
                TS
              </span>
              <span className="text-sm font-semibold text-white">TradeScribe</span>
            </Link>
            <p className="mt-5 max-w-xs text-sm leading-6 text-[#94A3B8]">
              Advisory analytics and education, not financial advice.
            </p>
            <div className="mt-5 flex gap-3 text-[#64748B]">
              <Twitter className="h-4 w-4" aria-hidden />
              <Github className="h-4 w-4" aria-hidden />
              <Linkedin className="h-4 w-4" aria-hidden />
              <Globe2 className="h-4 w-4" aria-hidden />
            </div>
          </div>

          {[
            { title: "Product", links: ["Dashboard", "Analytics", "Guardrails", "Reviews"] },
            { title: "Company", links: ["About", "Careers", "Contact", "Status"] },
            { title: "Resources", links: ["Blog", "Docs", "Tutorials", "FAQ"] },
            { title: "Legal", links: ["Privacy Policy", "Terms of Service", "NDPR/data rights"] }
          ].map((column) => (
            <div key={column.title}>
              <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a className="text-sm text-[#94A3B8] hover:text-white" href="#">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex max-w-[1200px] flex-col gap-3 border-t border-white/[0.06] pt-6 text-xs text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 TradeScribe. All rights reserved.</p>
          <p>Read-only, advisory, prop-firm-first.</p>
        </div>
      </footer>
    </main>
  );
}
