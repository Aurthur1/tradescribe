"use client";

import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Download, FileClock, Info, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AccountSwitcher } from "../_components/account-switcher";
import {
  fetchPlaybookPerformanceSummary,
  fetchTrades,
  type Granularity,
  type MetricsResponse,
  type PlaybookPerformanceSummaryResponse,
  type TradesListResponse,
  useCurrentUser,
  useMetrics
} from "../_lib/dashboard-data";
import { SAMPLE_ANCHOR, SAMPLE_DASHBOARD_DATA, SAMPLE_PLAYBOOK_PERFORMANCE, SAMPLE_RECENT_TRADES } from "../_lib/dashboard-sample";
import { initialAnchor, rangeLabel, stepAnchor } from "../_lib/date-range";
import { formatCurrency, formatNumber, formatPercent, formatProfitFactor } from "../_lib/format";
import { PlaybookComparisonWidget } from "../playbooks/_components/playbook-comparison-widget";

type ReportWidget = {
  id: string;
  size: "lg" | "md";
  title: string;
  component: React.ReactNode;
};

const GRANULARITIES: Granularity[] = ["day", "week", "month", "year"];

export default function ReportsPage() {
  const { data: context } = useCurrentUser();
  const accounts = context?.accounts ?? [];
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const [anchor, setAnchor] = useState(accounts.length ? initialAnchor() : SAMPLE_ANCHOR);
  const [granularity, setGranularity] = useState<Granularity>("week");
  const timeZone = context?.preferences.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const metricsQuery = useMemo(() => ({ anchor, filters: {}, granularity, tz: timeZone }), [anchor, granularity, timeZone]);
  const metricsState = useMetrics(activeAccount?.id ?? null, metricsQuery);
  const metrics = metricsState.data ?? SAMPLE_DASHBOARD_DATA;
  const sample = !activeAccount;
  const currency = activeAccount?.currency ?? "USD";
  const [playbookSummary, setPlaybookSummary] = useState<PlaybookPerformanceSummaryResponse | null>(sample ? SAMPLE_PLAYBOOK_PERFORMANCE : null);
  const [symbolSort, setSymbolSort] = useState<"netPnl" | "trades">("netPnl");

  useEffect(() => {
    setSelectedAccountId(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [context?.preferences.activeAccountId, primaryAccount?.id]);

  useEffect(() => {
    if (!activeAccount?.id) {
      setPlaybookSummary(SAMPLE_PLAYBOOK_PERFORMANCE);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ anchor, granularity, tz: timeZone });
    if (activeAccount.id) query.set("accountId", activeAccount.id);
    fetchPlaybookPerformanceSummary(query, controller.signal)
      .then(setPlaybookSummary)
      .catch(() => setPlaybookSummary(null));
    return () => controller.abort();
  }, [activeAccount?.id, anchor, granularity, timeZone]);

  async function exportCsv() {
    const rows = sample ? sampleExportRows() : await realExportRows(activeAccount?.id ?? null, anchor, granularity, timeZone);
    const csv = toCsv(rows);
    downloadBlob(csv, `tradescribe-report-${granularity}-${anchor.slice(0, 10)}.csv`, "text/csv;charset=utf-8");
  }

  const widgets = buildReportWidgets({
    currency,
    metrics,
    onYearChange: (year) => {
      setGranularity("year");
      setAnchor(`${year}-07-01T12:00:00.000Z`);
    },
    playbookSummary: playbookSummary ?? SAMPLE_PLAYBOOK_PERFORMANCE,
    sample,
    setSymbolSort,
    symbolSort
  });

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">TradeScribe</p>
            <h1 className="mt-2 text-[28px] font-bold text-white">Reports</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#94A3B8]">
              Inspect R distribution, symbols, sessions, weekdays, playbooks, and period-level patterns.
            </p>
          </div>
          <AccountSwitcher
            accounts={accounts}
            activeAccountId={selectedAccountId}
            canUseAllAccounts={context?.user.role === "ADMIN" || context?.user.plan === "PRO"}
            onAccountChange={setSelectedAccountId}
            plan={context?.user.plan ?? "FREE"}
          />
        </div>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#111827]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] hover:text-white" onClick={() => setAnchor(stepAnchor(anchor, granularity, -1))} type="button" aria-label="Previous period">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-bold text-white">
                <CalendarDays className="h-4 w-4 text-[#60A5FA]" aria-hidden />
                {rangeLabel(anchor, granularity)}
              </div>
              <button className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] hover:text-white" onClick={() => setAnchor(stepAnchor(anchor, granularity, 1))} type="button" aria-label="Next period">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
              <div className="inline-flex rounded-xl bg-white/[0.04] p-1">
                {GRANULARITIES.map((item) => (
                  <button
                    className={`rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${granularity === item ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-500/20" : "text-[#94A3B8] hover:text-white"}`}
                    key={item}
                    onClick={() => setGranularity(item)}
                    type="button"
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-bold text-white hover:bg-white/[0.06]" onClick={() => void exportCsv()} type="button">
                  <Download className="h-4 w-4" aria-hidden />
                  Export CSV
                </button>
              </div>
              <button className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 text-sm font-bold text-[#64748B]" disabled title="PDF export coming soon" type="button">
                <FileClock className="h-4 w-4" aria-hidden />
                PDF coming soon
              </button>
            </div>
          </div>
          {sample ? <p className="mt-3 text-xs font-bold text-[#93C5FD]">Sample report data shown until a read-only trading account is connected.</p> : null}
          {metricsState.isLoading ? <p className="mt-3 text-xs font-bold text-[#94A3B8]">Refreshing report metrics...</p> : null}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-12">
          {widgets.map((widget) => (
            <ReportWidgetFrame key={widget.id} size={widget.size} title={widget.title}>
              {widget.component}
            </ReportWidgetFrame>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildReportWidgets({
  currency,
  metrics,
  onYearChange,
  playbookSummary,
  sample,
  setSymbolSort,
  symbolSort
}: {
  currency: string;
  metrics: MetricsResponse;
  onYearChange: (year: number) => void;
  playbookSummary: PlaybookPerformanceSummaryResponse;
  sample: boolean;
  setSymbolSort: (sort: "netPnl" | "trades") => void;
  symbolSort: "netPnl" | "trades";
}): ReportWidget[] {
  return [
    {
      component: <RMultipleDistributionWidget currency={currency} data={metrics.rMultipleHistogram} />,
      id: "rMultipleDistribution",
      size: "md",
      title: "R-Multiple Distribution"
    },
    {
      component: <SymbolPerformanceWidget currency={currency} data={metrics.bySymbol} onSort={setSymbolSort} sort={symbolSort} />,
      id: "symbolPerformance",
      size: "md",
      title: "Performance by Symbol"
    },
    {
      component: <SessionPerformanceReport currency={currency} sessions={metrics.bySession} />,
      id: "sessionPerformance",
      size: "md",
      title: "Performance by Session"
    },
    {
      component: <WeekdayPerformanceWidget currency={currency} data={metrics.byDayOfWeek} />,
      id: "weekdayPerformance",
      size: "md",
      title: "Performance by Day of Week"
    },
    {
      component: <HeatmapWidget currency={currency} data={metrics.dailySeries} onYearChange={onYearChange} />,
      id: "heatmap",
      size: "lg",
      title: "Monthly/Yearly Heatmap"
    },
    {
      component: <PlaybookComparisonWidget currency={currency} data={playbookSummary} sample={sample} />,
      id: "playbookComparison",
      size: "md",
      title: "Playbook Comparison"
    },
    {
      component: <KeyStatsReport currency={currency} metrics={metrics} />,
      id: "keyStats",
      size: "lg",
      title: "Key Stats"
    }
  ];
}

function ReportWidgetFrame({ children, size, title }: { children: React.ReactNode; size: "lg" | "md"; title: string }) {
  return (
    <div className={size === "lg" ? "xl:col-span-8" : "xl:col-span-4"}>
      <section aria-label={title} className="h-full rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]">
        {children}
      </section>
    </div>
  );
}

function RMultipleDistributionWidget({ currency, data }: { currency: string; data: MetricsResponse["rMultipleHistogram"] }) {
  const max = Math.max(1, ...data.map((bin) => bin.count));
  const hasData = data.some((bin) => bin.count > 0);
  return (
    <>
      <WidgetHeader icon={<BarChart3 className="h-4 w-4" />} subtitle="Closed trades grouped by resolved R multiple." title="R-Multiple Distribution" />
      {!hasData ? <EmptyMessage>No trades with a resolved R multiple in this period.</EmptyMessage> : null}
      <div className="mt-6 flex h-64 items-end gap-2">
        {data.map((bin) => {
          const negative = bin.bin.startsWith("<") || bin.bin.startsWith("-");
          const height = `${Math.max(bin.count ? 10 : 2, (bin.count / max) * 100)}%`;
          return (
            <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={bin.bin}>
              <div className="flex h-48 w-full items-end rounded-xl bg-black/20 px-1.5 py-1.5" title={`${bin.bin}: ${bin.count} trades, ${formatCurrency(bin.netPnl, currency)} net P&L`}>
                <div className={`w-full rounded-lg ${negative ? "bg-[#EF4444]" : "bg-[#22C55E]"}`} style={{ height, opacity: bin.count ? 0.9 : 0.22 }} />
              </div>
              <span className="w-full truncate text-center text-[11px] font-bold text-[#94A3B8]" title={bin.bin}>{bin.bin}</span>
              <span className="text-[11px] font-bold tabular-nums text-white">{bin.count}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SymbolPerformanceWidget({
  currency,
  data,
  onSort,
  sort
}: {
  currency: string;
  data: MetricsResponse["bySymbol"];
  onSort: (sort: "netPnl" | "trades") => void;
  sort: "netPnl" | "trades";
}) {
  const rows = [...data].sort((a, b) => (sort === "netPnl" ? b.netPnl - a.netPnl : b.trades - a.trades));
  const max = Math.max(1, ...rows.map((row) => Math.abs(sort === "netPnl" ? row.netPnl : row.trades)));
  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <WidgetHeader icon={<SlidersHorizontal className="h-4 w-4" />} subtitle="Sorted by net P&L or trade count." title="Performance by Symbol" />
        <div className="inline-flex shrink-0 rounded-xl bg-white/[0.04] p-1">
          {(["netPnl", "trades"] as const).map((item) => (
            <button className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${sort === item ? "bg-[#3B82F6] text-white" : "text-[#94A3B8] hover:text-white"}`} key={item} onClick={() => onSort(item)} type="button">
              {item === "netPnl" ? "P&L" : "Trades"}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? <EmptyMessage>No symbol data for this period.</EmptyMessage> : null}
      <div className="mt-6 space-y-4">
        {rows.slice(0, 8).map((row) => {
          const positive = row.netPnl >= 0;
          const widthValue = Math.abs(sort === "netPnl" ? row.netPnl : row.trades);
          return (
            <div key={row.symbol}>
              <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="text-white">{row.symbol}</span>
                <span className="text-right tabular-nums text-[#CBD5E1]">{formatCurrency(row.netPnl, currency)} · {row.trades} trades · {formatPercent(row.winRate)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/[0.05]">
                <div className={`h-full rounded-full ${positive ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} style={{ width: `${Math.max(6, (widthValue / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SessionPerformanceReport({ currency, sessions }: { currency: string; sessions: MetricsResponse["bySession"] }) {
  const max = Math.max(1, ...sessions.map((session) => Math.abs(session.netPnl)));
  return (
    <>
      <WidgetHeader icon={<BarChart3 className="h-4 w-4" />} subtitle="The dashboard session widget, expanded for reports." title="Performance by Session" />
      {sessions.length === 0 ? <EmptyMessage>No session data for this period.</EmptyMessage> : null}
      <div className="mt-6 space-y-4">
        {sessions.map((session) => {
          const positive = session.netPnl >= 0;
          return (
            <div key={session.session}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-[#CBD5E1]">{session.session}</span>
                <span className={`${positive ? "text-[#22C55E]" : "text-[#EF4444]"} tabular-nums`}>{formatCurrency(session.netPnl, currency)} · {formatPercent(session.winRate)}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/[0.05]">
                <div className={`h-full rounded-full ${positive ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} style={{ width: `${Math.max(8, (Math.abs(session.netPnl) / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function WeekdayPerformanceWidget({ currency, data }: { currency: string; data: MetricsResponse["byDayOfWeek"] }) {
  const max = Math.max(1, ...data.map((day) => Math.abs(day.netPnl)));
  return (
    <>
      <WidgetHeader icon={<CalendarDays className="h-4 w-4" />} subtitle="Close-time weekday in your display timezone." title="Performance by Day of Week" />
      <div className="mt-6 grid grid-cols-7 gap-2">
        {data.map((day) => {
          const positive = day.netPnl >= 0;
          const height = `${Math.max(day.trades ? 8 : 2, (Math.abs(day.netPnl) / max) * 100)}%`;
          return (
            <div className="min-w-0 text-center" key={day.weekday}>
              <div className="flex h-40 items-end rounded-xl bg-black/20 px-1.5 py-1.5" title={`${day.weekday}: ${formatCurrency(day.netPnl, currency)}, ${formatPercent(day.winRate)} win rate`}>
                <div className={`w-full rounded-lg ${positive ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} style={{ height, opacity: day.trades ? 0.88 : 0.18 }} />
              </div>
              <p className="mt-2 text-xs font-bold text-white">{day.weekday}</p>
              <p className="truncate text-[11px] font-semibold text-[#94A3B8]">{day.trades} trades</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function HeatmapWidget({ currency, data, onYearChange }: { currency: string; data: MetricsResponse["dailySeries"]; onYearChange: (year: number) => void }) {
  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, index) => current - index);
  }, []);
  const byMonth = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => ({ month: index, days: [] as MetricsResponse["dailySeries"] }));
    for (const point of data) {
      const month = Number(point.date.slice(5, 7)) - 1;
      months[month]?.days.push(point);
    }
    return months;
  }, [data]);
  const max = Math.max(1, ...data.map((point) => Math.abs(point.netPnl)));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <WidgetHeader icon={<CalendarDays className="h-4 w-4" />} subtitle="Daily net P&L intensity for the selected report year or period." title="Monthly/Yearly Heatmap" />
        <select className="h-10 rounded-xl border border-white/[0.08] bg-[#0B1020] px-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => onYearChange(Number(event.target.value))} value="">
          <option value="" disabled>Jump to year</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
      {data.length === 0 ? <EmptyMessage>No closed trades in this period.</EmptyMessage> : null}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {byMonth.map((month) => (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3" key={month.month}>
            <p className="text-xs font-bold uppercase text-[#94A3B8]">{new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(2025, month.month, 1))}</p>
            <div className="mt-3 grid grid-cols-7 gap-1">
              {month.days.length
                ? month.days.map((point) => {
                    const intensity = Math.min(0.9, 0.16 + Math.abs(point.netPnl) / max);
                    const color = point.netPnl >= 0 ? `rgba(34,197,94,${intensity})` : `rgba(239,68,68,${intensity})`;
                    return <span className="h-4 rounded-[4px]" key={point.date} style={{ backgroundColor: color }} title={`${point.date}: ${formatCurrency(point.netPnl, currency)} · ${point.tradeCount} trades`} />;
                  })
                : Array.from({ length: 7 }, (_, index) => <span className="h-4 rounded-[4px] bg-white/[0.04]" key={index} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function KeyStatsReport({ currency, metrics }: { currency: string; metrics: MetricsResponse }) {
  const stats = [
    ["Net P&L", formatCurrency(metrics.netPnl, currency)],
    ["Total trades", formatNumber(metrics.totalTrades)],
    ["Win rate", formatPercent(metrics.winRate)],
    ["Profit factor", formatProfitFactor(metrics.profitFactor, metrics.profitFactorReason)],
    ["Expectancy", formatCurrency(metrics.expectancyCurrency, currency)],
    ["Expectancy R", metrics.expectancyR === null ? "—" : `${metrics.expectancyR.toFixed(2)}R`],
    ["Max drawdown", formatCurrency(metrics.drawdown.abs, currency)],
    ["Drawdown %", formatPercent(metrics.drawdown.pct, 1)]
  ];
  return (
    <>
      <WidgetHeader icon={<Info className="h-4 w-4" />} subtitle="Core period statistics from the metrics engine." title="Key Stats" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4" key={label}>
            <p className="text-xs font-bold uppercase text-[#64748B]">{label}</p>
            <p className="mt-2 text-xl font-bold tabular-nums text-white">{value}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function WidgetHeader({ icon, subtitle, title }: { icon: React.ReactNode; subtitle: string; title: string }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-[#3B82F6]/12 text-[#93C5FD]">{icon}</span>
        <h2 className="text-[18px] font-bold text-white">{title}</h2>
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-[#94A3B8]">{subtitle}</p>
    </div>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 p-4 text-sm font-semibold text-[#94A3B8]">{children}</p>;
}

async function realExportRows(accountId: string | null, anchor: string, granularity: Granularity, timeZone: string) {
  if (!accountId) return [];
  const query = new URLSearchParams({
    anchor,
    granularity,
    order: "desc",
    page: "1",
    pageSize: "200",
    sort: "closeTime",
    tz: timeZone
  });
  const response = await fetchTrades(accountId, query);
  return response.data;
}

function sampleExportRows(): TradesListResponse["data"] {
  return SAMPLE_RECENT_TRADES.map((trade) => ({
    ...trade,
    commission: -4,
    grossProfit: trade.netProfit + 4,
    openTime: new Date(new Date(trade.closeTime).getTime() - 45 * 60 * 1000).toISOString(),
    swap: 0,
    volume: 1
  }));
}

function toCsv(rows: TradesListResponse["data"]) {
  const header = ["id", "symbol", "side", "openTime", "closeTime", "volume", "grossProfit", "commission", "swap", "netProfit", "session", "playbook"];
  const lines = rows.map((row) =>
    [
      row.id,
      row.symbol,
      row.side,
      row.openTime,
      row.closeTime,
      row.volume,
      row.grossProfit,
      row.commission,
      row.swap,
      row.netProfit,
      row.session ?? "",
      row.playbook?.name ?? ""
    ]
      .map(csvCell)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadBlob(contents: string, filename: string, type: string) {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
