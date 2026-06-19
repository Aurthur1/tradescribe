"use client";

import { Archive, ArrowLeft, CheckCircle2, Edit3 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { archivePlaybook, fetchPlaybook, fetchPlaybookPerformance, type MetricsResponse, type Playbook, type PlaybookPerformanceResponse, useCurrentUser } from "../../_lib/dashboard-data";
import { SAMPLE_DASHBOARD_DATA, SAMPLE_PLAYBOOK_PERFORMANCE, SAMPLE_PLAYBOOKS, SAMPLE_RECENT_TRADES } from "../../_lib/dashboard-sample";
import { formatCurrency } from "../../_lib/format";
import { AccountSwitcher } from "../../_components/account-switcher";

export default function PlaybookDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data: context } = useCurrentUser();
  const accounts = context?.accounts ?? [];
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const preferredAccountId = context?.preferences.activeAccountId ?? primaryAccount?.id ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(preferredAccountId);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const sample = SAMPLE_PLAYBOOKS.find((playbook) => playbook.id === id) ?? null;
  const [playbook, setPlaybook] = useState<Playbook | null>(sample);
  const [performance, setPerformance] = useState<PlaybookPerformanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const currency = activeAccount?.currency ?? context?.accounts[0]?.currency ?? "USD";

  useEffect(() => {
    setSelectedAccountId(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [context?.preferences.activeAccountId, primaryAccount?.id]);

  useEffect(() => {
    if (sample) return;
    const controller = new AbortController();
    const query = new URLSearchParams({
      anchor: new Date().toISOString(),
      granularity: "week",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });
    if (activeAccount?.id) query.set("accountId", activeAccount.id);
    Promise.all([fetchPlaybook(id, controller.signal), fetchPlaybookPerformance(id, query, controller.signal)])
      .then(([nextPlaybook, nextPerformance]) => {
        setPlaybook(nextPlaybook);
        setPerformance(nextPerformance);
      })
      .catch(() => setError("Playbook could not be loaded."));
    return () => controller.abort();
  }, [activeAccount?.id, id, sample]);

  const sampleMetrics = useMemo(() => SAMPLE_PLAYBOOK_PERFORMANCE.playbooks.find((item) => item.id === id)?.metrics ?? SAMPLE_DASHBOARD_DATA, [id]);
  const metrics = sample ? sampleMetrics : performance?.metrics;
  const ruleAdherence = useMemo(() => {
    if (!sample || !sampleMetrics) return performance?.ruleAdherence;
    return {
      adherencePct: 0.74,
      brokenMetrics: { ...sampleMetrics, expectancyR: -0.18, netPnl: -340, totalTrades: 9, winRate: 0.33 },
      brokenTrades: 9,
      configuredRules: sample.rules.length,
      delta: { expectancyR: 0.82, netPnl: 1880 },
      followedMetrics: { ...sampleMetrics, expectancyR: 0.64, netPnl: 1540, totalTrades: 25, winRate: 0.72 },
      followedTrades: 25,
      reviewedTrades: 34
    };
  }, [performance?.ruleAdherence, sample, sampleMetrics]);
  const recentTrades = sample
    ? SAMPLE_RECENT_TRADES.slice(0, 4).map((trade) => ({
        ...trade,
        commission: -4,
        grossProfit: trade.netProfit + 4,
        openTime: new Date(new Date(trade.closeTime).getTime() - 38 * 60 * 1000).toISOString(),
        playbook: sample,
        playbookId: sample.id,
        session: "London",
        swap: 0,
        volume: 0.8
      }))
    : performance?.recentTrades ?? playbook?.recentTrades ?? [];

  async function onArchive() {
    if (!playbook || sample) return;
    await archivePlaybook(playbook.id);
    router.push("/playbooks");
  }

  if (!playbook || !metrics) {
    return <div className="grid h-full place-items-center text-sm font-semibold text-[#94A3B8]">{error ?? "Loading playbook..."}</div>;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <Link className="inline-flex items-center gap-2 text-sm font-bold text-[#93C5FD] hover:text-white" href="/playbooks">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to playbooks
        </Link>

        <header className="mt-5 rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: playbook.color }} />
                <h1 className="text-3xl font-bold text-white">{playbook.name}</h1>
                {sample ? <span className="rounded-full bg-[#3B82F6]/12 px-3 py-1 text-xs font-bold text-[#93C5FD]">Sample</span> : null}
              </div>
              <p className="mt-3 text-sm leading-6 text-[#94A3B8]">{playbook.description || "No description yet."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {playbook.tags.filter((tag) => !tag.startsWith("__ts_")).map((tag) => (
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-[#94A3B8]" key={tag}>{tag}</span>
                ))}
                {constraintTags(playbook.tags).map((tag) => (
                  <span className="rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-2 py-1 text-[11px] font-bold text-[#93C5FD]" key={tag}>{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <AccountSwitcher
                accounts={accounts}
                activeAccountId={selectedAccountId}
                canUseAllAccounts={context?.user.role === "ADMIN" || context?.user.plan === "PRO"}
                onAccountChange={setSelectedAccountId}
                plan={context?.user.plan ?? "FREE"}
              />
              <a className={`inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-bold ${sample ? "pointer-events-none opacity-50" : "text-[#CBD5E1] hover:bg-white/[0.04]"}`} href={`/playbooks/${playbook.id}/edit`}>
                <Edit3 className="h-4 w-4" aria-hidden />
                Edit
              </a>
              <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-bold text-[#FCA5A5] hover:bg-[#EF4444]/10 disabled:cursor-not-allowed disabled:opacity-50" disabled={Boolean(sample)} onClick={() => void onArchive()} type="button">
                <Archive className="h-4 w-4" aria-hidden />
                Archive
              </button>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <RulesCard playbook={playbook} />
          <PerformanceCard currency={currency} metrics={metrics} ruleAdherence={ruleAdherence} />
        </div>

        <section className="mt-5 rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-6">
          <h2 className="text-lg font-bold text-white">Recent Tagged Trades</h2>
          <div className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
            {recentTrades.length === 0 ? <p className="p-4 text-sm font-semibold text-[#94A3B8]">No trades tagged to this playbook yet.</p> : null}
            {recentTrades.map((trade) => (
              <a className="grid grid-cols-[1fr_0.8fr_0.8fr_auto] items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.035]" href={`/trades/${trade.id}`} key={trade.id}>
                <span className="font-bold text-white">{trade.symbol}</span>
                <span className="text-[#94A3B8]">{new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(trade.closeTime))}</span>
                <span className={`${trade.netProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold tabular-nums`}>{formatCurrency(trade.netProfit, currency)}</span>
                <span className="rounded-full border border-white/[0.08] px-2 py-1 text-xs font-bold text-[#CBD5E1]">{trade.side}</span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function RulesCard({ playbook }: { playbook: Playbook }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-6">
      <h2 className="text-lg font-bold text-white">Rules Checklist</h2>
      <div className="mt-4 space-y-3">
        {playbook.rules.length === 0 ? <p className="rounded-xl bg-white/[0.03] p-4 text-sm font-semibold text-[#94A3B8]">No rules added yet.</p> : null}
        {playbook.rules.map((rule, index) => (
          <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3" key={`${rule.order}-${rule.text}`}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#3B82F6]/15 text-xs font-bold text-[#93C5FD]">{index + 1}</span>
            <p className="text-sm leading-6 text-[#CBD5E1]">{rule.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PerformanceCard({
  currency,
  metrics,
  ruleAdherence
}: {
  currency: string;
  metrics: MetricsResponse;
  ruleAdherence?: PlaybookPerformanceResponse["ruleAdherence"];
}) {
  const maxHistogramCount = Math.max(1, ...metrics.rMultipleHistogram.map((bin) => bin.count));
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Performance Lab</h2>
          <p className="mt-1 text-xs font-semibold text-[#64748B]">Metrics are computed only from trades tagged to this playbook.</p>
        </div>
        <span className="rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-2 py-1 text-[11px] font-bold uppercase text-[#93C5FD]">Tagged edge</span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-4">
        <Metric label="Net P&L" tone={metrics.netPnl >= 0 ? "positive" : "negative"} value={formatCurrency(metrics.netPnl, currency)} />
        <Metric label="Win rate" value={`${Math.round(metrics.winRate * 100)}%`} />
        <Metric label="Profit factor" value={metrics.profitFactor == null ? "—" : metrics.profitFactor.toFixed(2)} />
        <Metric label="Expectancy" value={`${formatCurrency(metrics.expectancyCurrency, currency)} / ${metrics.expectancyR == null ? "—" : `${metrics.expectancyR.toFixed(2)}R`}`} />
        <Metric label="Trades" value={String(metrics.totalTrades)} />
        <Metric label="Avg R win/loss" value={`${metrics.avgWinR == null ? "—" : metrics.avgWinR.toFixed(2)} / ${metrics.avgLossR == null ? "—" : metrics.avgLossR.toFixed(2)}`} />
        <Metric label="Largest win/loss" value={`${formatCurrency(metrics.largestWin, currency)} / ${formatCurrency(metrics.largestLoss, currency)}`} />
        <Metric label="Drawdown" value={`${formatCurrency(metrics.drawdown.abs, currency)} (${Math.round(metrics.drawdown.pct * 100)}%)`} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase text-[#64748B]">
            <span>Equity curve</span>
            <span>{metrics.bestDay ? `Best ${formatCurrency(metrics.bestDay.netPnl, currency)}` : "No trades"}</span>
          </div>
          <MiniChart data={metrics.dailySeries} />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
          <h3 className="text-sm font-bold text-white">R-multiple distribution</h3>
          <div className="mt-3 space-y-2">
            {metrics.rMultipleHistogram.map((bin) => (
              <div className="grid grid-cols-[86px_1fr_42px] items-center gap-2 text-xs" key={bin.bin}>
                <span className="truncate font-semibold text-[#94A3B8]">{bin.bin}</span>
                <div className="h-2 rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full ${bin.netPnl >= 0 ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} style={{ width: `${Math.max(4, (bin.count / maxHistogramCount) * 100)}%` }} />
                </div>
                <span className="text-right font-bold tabular-nums text-white">{bin.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Breakdown title="By session" rows={metrics.bySession.map((row) => ({ label: row.session, netPnl: row.netPnl, trades: row.trades, winRate: row.winRate }))} currency={currency} />
        <Breakdown title="By symbol" rows={metrics.bySymbol.slice(0, 5).map((row) => ({ label: row.symbol, netPnl: row.netPnl, trades: row.trades, winRate: row.winRate }))} currency={currency} />
        <RuleAdherenceCard currency={currency} ruleAdherence={ruleAdherence} />
      </div>
    </section>
  );
}

function Metric({ label, tone, value }: { label: string; tone?: "positive" | "negative"; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="text-[11px] font-bold uppercase text-[#64748B]">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${tone === "positive" ? "text-[#22C55E]" : tone === "negative" ? "text-[#EF4444]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function MiniChart({ data }: { data: MetricsResponse["dailySeries"] }) {
  const points = data.length ? data : [{ cumulativePnl: 0, date: "empty", netPnl: 0, tradeCount: 0 }];
  const min = Math.min(...points.map((point) => point.cumulativePnl));
  const max = Math.max(...points.map((point) => point.cumulativePnl));
  const path = points
    .map((point, index) => {
      const x = points.length === 1 ? 24 : 24 + (index / (points.length - 1)) * 552;
      const y = 160 - ((point.cumulativePnl - min) / (max - min || 1)) * 120;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <svg className="h-48 w-full overflow-visible" viewBox="0 0 600 190" role="img" aria-label="Playbook equity curve">
      {[0, 1, 2].map((line) => (
        <line key={line} stroke="rgba(148,163,184,0.12)" strokeDasharray="5 8" x1="20" x2="580" y1={40 + line * 50} y2={40 + line * 50} />
      ))}
      <path d={path} fill="none" stroke="#3B82F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
    </svg>
  );
}

function Breakdown({ currency, rows, title }: { currency: string; rows: Array<{ label: string; netPnl: number; trades: number; winRate: number }>; title: string }) {
  const maxAbs = Math.max(1, ...rows.map((row) => Math.abs(row.netPnl)));
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <h3 className="text-sm font-bold text-white">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.length === 0 ? <p className="text-sm font-semibold text-[#94A3B8]">No tagged trades in this period.</p> : null}
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[#CBD5E1]">{row.label}</span>
              <span className={`${row.netPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold tabular-nums`}>{formatCurrency(row.netPnl, currency)}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${row.netPnl >= 0 ? "bg-[#3B82F6]" : "bg-[#EF4444]"}`} style={{ width: `${Math.max(5, (Math.abs(row.netPnl) / maxAbs) * 100)}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] font-semibold text-[#64748B]">
              <span>{row.trades} trades</span>
              <span>{Math.round(row.winRate * 100)}% WR</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RuleAdherenceCard({ currency, ruleAdherence }: { currency: string; ruleAdherence?: PlaybookPerformanceResponse["ruleAdherence"] }) {
  if (!ruleAdherence || ruleAdherence.configuredRules === 0) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <h3 className="text-sm font-bold text-white">Rule adherence</h3>
        <p className="mt-3 text-sm leading-6 text-[#94A3B8]">Add checklist rules to compare rule-following trades against broken-rule trades.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-white">Rule adherence</h3>
        <CheckCircle2 className="h-4 w-4 text-[#22C55E]" aria-hidden />
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums text-white">{ruleAdherence.adherencePct == null ? "—" : `${Math.round(ruleAdherence.adherencePct * 100)}%`}</p>
      <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
        {ruleAdherence.followedTrades} fully followed / {ruleAdherence.reviewedTrades} reviewed
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Followed" tone={ruleAdherence.followedMetrics.netPnl >= 0 ? "positive" : "negative"} value={formatCurrency(ruleAdherence.followedMetrics.netPnl, currency)} />
        <Metric label="Broken" tone={ruleAdherence.brokenMetrics.netPnl >= 0 ? "positive" : "negative"} value={formatCurrency(ruleAdherence.brokenMetrics.netPnl, currency)} />
      </div>
      <p className="mt-3 rounded-lg bg-[#3B82F6]/10 px-3 py-2 text-xs font-bold text-[#93C5FD]">
        Delta: {formatCurrency(ruleAdherence.delta.netPnl, currency)}
        {ruleAdherence.delta.expectancyR == null ? "" : ` / ${ruleAdherence.delta.expectancyR.toFixed(2)}R expectancy`}
      </p>
    </div>
  );
}

function constraintTags(tags: string[]) {
  return tags
    .filter((tag) => tag.startsWith("__ts_"))
    .map((tag) =>
      tag
        .replace("__ts_targetR=", "Target ")
        .replace("__ts_maxRiskPct=", "Risk ")
        .replace("__ts_session=", "")
        .replace("__ts_symbol=", "")
    );
}
