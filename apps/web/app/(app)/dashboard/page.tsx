"use client";

import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Filter,
  GripVertical,
  Info,
  LockKeyhole,
  MoreHorizontal,
  RotateCcw,
  TrendingUp,
  Zap
} from "lucide-react";
import { KeyboardEvent, ReactNode, Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { daysForRange, initialAnchor, rangeLabel, stepAnchor } from "../_lib/date-range";
import {
  AccountSummary,
  DashboardFilters,
  DashboardLayoutItem,
  DailyPoint,
  Granularity,
  GuardrailStatus,
  LeakFlagResponse,
  RecentTrade,
  MetricsResponse,
  PlaybookPerformanceSummaryResponse,
  WeeklyReview,
  fetchPlaybookPerformanceSummary,
  fetchOnboardingStatus,
  fetchWeeklyReview,
  markOnboarding,
  markAlertRead,
  type OnboardingStatusResponse,
  useAlerts,
  useCurrentUser,
  useDashboardData,
  useDashboardLayout,
  useGuardrails,
  useLeaks
} from "../_lib/dashboard-data";
import {
  SAMPLE_ACCOUNT_CONTEXT,
  SAMPLE_ACCOUNT_CURRENCY,
  SAMPLE_ANCHOR,
  SAMPLE_PLAYBOOK_PERFORMANCE,
  SAMPLE_RECENT_TRADES,
  SAMPLE_WEEKLY_REVIEW
} from "../_lib/dashboard-sample";
import { formatCurrency, formatDeltaPercent, formatNumber, formatPercent, formatProfitFactor } from "../_lib/format";
import { AccountSwitcher } from "../_components/account-switcher";
import { EmptyPreview } from "../_components/ui";
import { PlaybookComparisonWidget } from "../playbooks/_components/playbook-comparison-widget";

const granularities: Granularity[] = ["day", "week", "month", "year"];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const defaultLayout: DashboardLayoutItem[] = [
  { order: 0, size: "md", visible: true, widgetId: "coachNote" },
  { order: 1, size: "lg", visible: true, widgetId: "performance" },
  { order: 2, size: "md", visible: true, widgetId: "activity" },
  { order: 3, size: "lg", visible: true, widgetId: "equityCurve" },
  { order: 4, size: "sm", visible: true, widgetId: "winLossDonut" },
  { order: 5, size: "md", visible: true, widgetId: "sessionPerformance" },
  { order: 6, size: "sm", visible: true, widgetId: "riskRoom" },
  { order: 7, size: "sm", visible: true, widgetId: "leakSummary" },
  { order: 8, size: "lg", visible: true, widgetId: "recentTrades" },
  { order: 9, size: "md", visible: false, widgetId: "playbookComparison" }
];

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardShellFallback />}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [anchor, setAnchor] = useState(SAMPLE_ANCHOR || initialAnchor());
  const [exportOpen, setExportOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [chartMode, setChartMode] = useState<"daily" | "cumulative">("cumulative");
  const [weeklyReview, setWeeklyReview] = useState<{ locked: boolean; review: WeeklyReview | null }>({ locked: true, review: null });
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatusResponse | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const layoutState = useDashboardLayout(defaultLayout);

  const userState = useCurrentUser();
  const accounts = userState.data?.accounts ?? [];
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const preferredAccountId = userState.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(preferredAccountId);
  useEffect(() => {
    setSelectedAccountId(userState.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [primaryAccount?.id, userState.data?.preferences.activeAccountId]);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const filters = useMemo<DashboardFilters>(
    () => ({
      day: searchParams.get("day") || undefined,
      session: (searchParams.get("session") || undefined) as DashboardFilters["session"],
      side: (searchParams.get("side") || undefined) as DashboardFilters["side"],
      symbol: searchParams.get("symbol") || undefined
    }),
    [searchParams]
  );
  const dashboard = useDashboardData(activeAccount?.id ?? null, { anchor, filters, granularity, tz: timeZone });
  const isSample = dashboard.status === "sample";
  const selectedDate = filters.day ?? null;
  const scopedAnchor = selectedDate ? `${selectedDate}T12:00:00.000Z` : anchor;
  const leaks = useLeaks(activeAccount?.id ?? null, { anchor: scopedAnchor, granularity: selectedDate ? "day" : granularity, tz: timeZone });
  const guardrails = useGuardrails(activeAccount?.id ?? null, timeZone);
  const alerts = useAlerts(true);
  const data = isSample && selectedDate ? scopeSampleMetricsToDay(dashboard.data, selectedDate) : dashboard.data;
  const accountCurrency = activeAccount?.currency ?? SAMPLE_ACCOUNT_CURRENCY;
  const displayLabel = isSample && granularity === "week" ? dashboard.data.period.label : rangeLabel(anchor, granularity);
  const firstName = userState.data?.user.firstName || "Trader";
  const plan = userState.data?.user.plan ?? "FREE";
  const isAdmin = userState.data?.user.role === "ADMIN";
  const canUseCalendar = isSample || plan !== "FREE";
  const accountContext = getAccountContext(activeAccount, isSample);
  const dashboardReturnHref = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    const controller = new AbortController();
    fetchWeeklyReview(controller.signal, activeAccount?.id ?? null)
      .then((payload) => setWeeklyReview({ locked: payload.locked, review: payload.review ?? null }))
      .catch(() => setWeeklyReview({ locked: !isAdmin && plan === "FREE", review: null }));
    return () => controller.abort();
  }, [activeAccount?.id, isAdmin, plan]);

  useEffect(() => {
    const controller = new AbortController();
    fetchOnboardingStatus(controller.signal)
      .then(setOnboardingStatus)
      .catch(() => setOnboardingStatus(null));
    return () => controller.abort();
  }, []);

  async function dismissFinishSetupPrompt() {
    setOnboardingStatus((current) => (current ? { ...current, shouldShowFinishSetupPrompt: false } : current));
    try {
      await markOnboarding("dismiss");
    } catch {
      setOnboardingStatus(null);
    }
  }

  function writeQuery(values: Partial<Record<"account" | "day" | "session" | "side" | "symbol", string | null>>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });

    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function stepPeriod(direction: 1 | -1) {
    setAnchor((value) => stepAnchor(value, granularity, direction));
    writeQuery({ day: null });
  }

  function changeGranularity(value: Granularity) {
    setGranularity(value);
    writeQuery({ day: null });
  }

  function exportCsv() {
    setExportOpen(false);
    const rows = [
      ["date", "daily_pnl", "cumulative_pnl", "trade_count"],
      ...data.dailySeries.map((point) => [
        point.date,
        String(point.netPnl),
        String(point.cumulativePnl),
        String(point.tradeCount)
      ])
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchorElement = document.createElement("a");
    anchorElement.href = url;
    anchorElement.download = `tradescribe-${granularity}-${displayLabel.replaceAll(" ", "-").replaceAll(",", "").toLowerCase()}.csv`;
    anchorElement.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 px-4 pb-4 pt-5 sm:px-8 lg:flex lg:items-start lg:justify-between lg:gap-5">
        <div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-normal text-white">Dashboard</h1>
          <p className="mt-3 text-base font-medium text-[#94A3B8]">
            Welcome back, {firstName}. Here&apos;s your performance overview.
          </p>
          {isSample ? (
            <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-3 py-1.5 text-xs font-semibold text-[#BFDBFE]">
              <span>Showing sample data — connect a read-only account to see your numbers</span>
              <a className="inline-flex items-center gap-1 rounded-full bg-[#3B82F6] px-2.5 py-1 text-white" href="/import">
                Connect
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            </div>
          ) : null}
        </div>

        <div className="mt-5 hidden flex-wrap items-center gap-3 md:flex lg:mt-0">
          <AlertBell alerts={alerts} isSample={isSample} />
          <button
            className={`flex h-11 items-center gap-2 rounded-[10px] border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${
              editMode
                ? "border-[#3B82F6]/40 bg-[#3B82F6]/15 text-white"
                : "border-white/[0.1] bg-white/[0.03] text-[#CBD5E1] hover:bg-white/[0.06]"
            }`}
            onClick={() => setEditMode((value) => !value)}
            type="button"
          >
            <GripVertical className="h-4 w-4" aria-hidden />
            Customize
          </button>
          <AccountSwitcher
            accounts={accounts}
            activeAccountId={selectedAccountId}
            canUseAllAccounts={isAdmin || plan === "PRO"}
            onAccountChange={setSelectedAccountId}
            plan={plan}
          />

          <div className="relative">
            <button
              aria-expanded={exportOpen}
              className="flex h-11 items-center gap-3 rounded-[10px] border border-white/[0.1] bg-white/[0.03] px-5 text-sm font-semibold text-[#CBD5E1] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              onClick={() => {
                setExportOpen((value) => !value);
                setFilterOpen(false);
              }}
              type="button"
            >
              <Download className="h-5 w-5" aria-hidden />
              Export
            </button>
            {exportOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-white/[0.08] bg-[#111827] p-2 shadow-2xl">
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#CBD5E1] hover:bg-white/[0.06]" onClick={exportCsv} type="button">
                  Export CSV
                </button>
                <button
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#64748B]"
                  disabled
                  type="button"
                >
                  Export PDF
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              aria-expanded={filterOpen}
              className="flex h-11 items-center gap-3 rounded-[10px] border border-white/[0.1] bg-white/[0.03] px-5 text-sm font-semibold text-[#CBD5E1] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              onClick={() => {
                setFilterOpen((value) => !value);
                setExportOpen(false);
              }}
              type="button"
            >
              <Filter className="h-5 w-5" aria-hidden />
              Filter
            </button>
            {filterOpen ? (
              <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#111827] p-4 shadow-2xl">
                <FilterField label="Symbol">
                  <input
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    onChange={(event) => writeQuery({ symbol: event.target.value || null })}
                    placeholder="EURUSD"
                    value={filters.symbol ?? ""}
                  />
                </FilterField>
                <FilterField label="Session">
                  <select
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    onChange={(event) => writeQuery({ session: event.target.value || null })}
                    value={filters.session ?? ""}
                  >
                    <option value="">All sessions</option>
                    <option value="Sydney">Sydney</option>
                    <option value="Tokyo">Tokyo</option>
                    <option value="London">London</option>
                    <option value="New York">New York</option>
                  </select>
                </FilterField>
                <FilterField label="Direction">
                  <select
                    className="h-10 w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-[#3B82F6]"
                    onChange={(event) => writeQuery({ side: event.target.value || null })}
                    value={filters.side ?? ""}
                  >
                    <option value="">All directions</option>
                    <option value="BUY">Buy</option>
                    <option value="SELL">Sell</option>
                  </select>
                </FilterField>
                <button
                  className="mt-1 w-full rounded-lg border border-white/[0.08] px-3 py-2 text-sm font-semibold text-[#94A3B8] transition hover:bg-white/[0.05] hover:text-white"
                  onClick={() => writeQuery({ day: null, session: null, side: null, symbol: null })}
                  type="button"
                >
                  Clear filters
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-8">
        <AccountContextStrip context={accountContext} isSample={isSample} />
        {onboardingStatus?.shouldShowFinishSetupPrompt ? <FinishSetupPrompt onDismiss={dismissFinishSetupPrompt} /> : null}
        <PeriodControl active={granularity} label={displayLabel} onGranularity={changeGranularity} onStep={stepPeriod} />
        {selectedDate ? (
          <div
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-3 py-1.5 text-xs font-semibold text-[#BFDBFE]"
            title="Showing stats for this day only. Clear to see the full period."
          >
            Viewing: {formatLongDate(selectedDate)}
            <button className="rounded-full bg-white/[0.08] px-2 py-0.5 text-white hover:bg-white/[0.12]" onClick={() => writeQuery({ day: null })} type="button">
              Clear
            </button>
          </div>
        ) : null}
        <DashboardMetrics
          accountCurrency={accountCurrency}
          anchor={anchor}
          canUseCalendar={canUseCalendar}
          calendarSeries={dashboard.data.dailySeries}
          chartMode={chartMode}
          editMode={editMode}
          granularity={granularity}
          isSample={isSample}
          leaks={leaks}
          layout={layoutState.data}
          metrics={data}
          onChartMode={setChartMode}
          onLayoutChange={layoutState.save}
          onResetLayout={() => layoutState.save(defaultLayout)}
          saveState={layoutState.saveState}
          guardrails={guardrails}
          returnHref={dashboardReturnHref}
          review={weeklyReview.review}
          reviewLocked={!isSample && !isAdmin && (weeklyReview.locked || plan === "FREE")}
          selectedDate={selectedDate}
          setSelectedDate={(value) => writeQuery({ day: value })}
          timeZone={timeZone}
          activeAccountId={activeAccount?.id ?? null}
        />
      </section>
    </div>
  );
}

function PeriodControl({
  active,
  label,
  onGranularity,
  onStep
}: {
  active: Granularity;
  label: string;
  onGranularity: (value: Granularity) => void;
  onStep: (direction: 1 | -1) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/65 p-4 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <IconButton label="Previous period" onClick={() => onStep(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </IconButton>
          <button className="flex h-14 items-center gap-3 rounded-xl bg-white/[0.04] px-5 text-base font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" type="button">
            <CalendarDays className="h-5 w-5 text-[#60A5FA]" aria-hidden />
            {label}
          </button>
          <IconButton label="Next period" onClick={() => onStep(1)}>
            <ChevronRight className="h-5 w-5" />
          </IconButton>
        </div>

        <div className="grid grid-cols-4 rounded-xl bg-white/[0.04] p-1">
          {granularities.map((item) => (
            <button
              className={`h-12 rounded-lg px-4 text-sm font-semibold capitalize transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${
                active === item ? "bg-[#3B82F6] text-white shadow-lg shadow-blue-950/40" : "text-[#94A3B8] hover:text-white"
              }`}
              key={item}
              onClick={() => onGranularity(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AccountContextStrip({
  context,
  isSample
}: {
  context: ReturnType<typeof getAccountContext>;
  isSample: boolean;
}) {
  const dotClass = {
    CONNECTED: "bg-[#22C55E]",
    DISCONNECTED: "bg-[#94A3B8]",
    ERROR: "bg-[#EF4444]",
    SYNCING: "bg-[#F59E0B]"
  }[context.status] ?? "bg-[#94A3B8]";

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#111827]/55 px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-semibold text-white">
          {context.name} <span className="text-[#64748B]">#{context.login}</span>
        </span>
        {isSample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-0.5 text-xs font-bold text-[#93C5FD]">Sample account values</span> : null}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[#94A3B8]">
        <span>{context.currency}</span>
        <span>Balance <strong className="font-semibold text-white tabular-nums">{formatCurrency(context.balance, context.currency)}</strong></span>
        <span>Equity <strong className="font-semibold text-white tabular-nums">{formatCurrency(context.equity, context.currency)}</strong></span>
        <span className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} aria-hidden />
          {context.statusLabel} · {context.lastSyncLabel}
        </span>
      </div>
    </div>
  );
}

function FinishSetupPrompt({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div>
        <p className="text-sm font-bold text-white">Finish setup when you are ready.</p>
        <p className="mt-1 text-xs font-semibold text-[#BFDBFE]">Connect read-only MT4/MT5 access to replace sample metrics with your own trades.</p>
      </div>
      <div className="flex items-center gap-2">
        <a className="rounded-xl bg-[#3B82F6] px-3 py-2 text-xs font-bold text-white hover:bg-[#2563EB]" href="/onboarding/connect">
          Finish setup
        </a>
        <button className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={onDismiss} type="button">
          Dismiss
        </button>
      </div>
    </div>
  );
}

function AlertBell({ alerts, isSample }: { alerts: ReturnType<typeof useAlerts>; isSample: boolean }) {
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const sampleAlerts = useMemo(
    () => [
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        id: "sample-alert-revenge",
        payload: {
          evidence: { minutesAfter: 4, sizeMultiplier: 1.8 },
          severity: "warning",
          status: "active",
          tradeIds: ["sample-trade-2"],
          type: "revenge_trade"
        },
        severity: "warning" as const,
        type: "leak_flag"
      },
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        id: "sample-alert-risk",
        payload: { overallStatus: "warning" },
        severity: "info" as const,
        type: "guardrail_warning"
      }
    ],
    []
  );
  const sourceAlerts = isSample ? sampleAlerts : alerts;
  const visibleAlerts = sourceAlerts.filter((alert) => !readIds.has(alert.id)).slice(0, 10);

  async function markAllRead() {
    const ids = visibleAlerts.map((alert) => alert.id);
    setReadIds((current) => new Set([...current, ...ids]));
    if (!isSample) await Promise.allSettled(ids.map((id) => markAlertRead(id)));
  }

  return (
    <div className="relative">
      <button
        aria-label="Open alerts"
        className="relative flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/[0.1] bg-white/[0.03] text-[#CBD5E1] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {visibleAlerts.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
            {visibleAlerts.length}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-80 rounded-2xl border border-white/[0.08] bg-[#111827]/95 p-3 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">Alerts</p>
            {visibleAlerts.length > 0 ? (
              <button className="rounded-lg px-2 py-1 text-xs font-semibold text-[#93C5FD] hover:bg-white/[0.05]" onClick={markAllRead} type="button">
                Mark all read
              </button>
            ) : (
              <span className="text-xs font-semibold text-[#94A3B8]">0 unread</span>
            )}
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {visibleAlerts.length === 0 ? (
              <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-[#94A3B8]">No alerts yet.</p>
            ) : (
              visibleAlerts.map((alert) => (
                <div className="grid grid-cols-[18px_1fr] gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3" key={alert.id}>
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.severity === "critical" || alert.severity === "breached" ? "bg-[#EF4444]" : alert.severity === "warning" ? "bg-[#F59E0B]" : "bg-[#3B82F6]"}`} aria-hidden />
                  <span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-[#94A3B8]">{alert.severity}</span>
                      {isSample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-0.5 text-[10px] font-bold text-[#93C5FD]">Sample</span> : null}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-white">{describeAlert(alert)}</span>
                    <span className="mt-1 block text-xs text-[#64748B]">{relativeTime(alert.createdAt)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardMetrics({
  activeAccountId,
  accountCurrency,
  anchor,
  canUseCalendar,
  calendarSeries,
  chartMode,
  editMode,
  guardrails,
  granularity,
  isSample,
  leaks,
  layout,
  metrics,
  onChartMode,
  onLayoutChange,
  onResetLayout,
  returnHref,
  review,
  reviewLocked,
  saveState,
  selectedDate,
  setSelectedDate,
  timeZone
}: {
  activeAccountId?: string | null;
  accountCurrency: string;
  anchor: string;
  canUseCalendar: boolean;
  calendarSeries: DailyPoint[];
  chartMode: "daily" | "cumulative";
  editMode: boolean;
  guardrails: GuardrailStatus | null;
  granularity: Granularity;
  isSample: boolean;
  leaks: LeakFlagResponse[];
  layout: DashboardLayoutItem[];
  metrics: MetricsResponse;
  onChartMode: (mode: "daily" | "cumulative") => void;
  onLayoutChange: (layout: DashboardLayoutItem[]) => void;
  onResetLayout: () => void;
  returnHref: string;
  review: WeeklyReview | null;
  reviewLocked: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
  selectedDate: string | null;
  setSelectedDate: (value: string | null) => void;
  timeZone: string;
}) {
  const days = useMemo(() => daysForRange(anchor, granularity), [anchor, granularity]);
  const widgets = useMemo(
    () =>
      buildWidgetRegistry({
        activeAccountId,
        accountCurrency,
        canUseCalendar,
        calendarSeries,
        chartMode,
        days,
        granularity,
        guardrails,
        isSample,
        leaks,
        metrics,
        onChartMode,
        returnHref,
        review,
        reviewLocked,
        selectedDate,
        setSelectedDate,
        timeZone
      }),
    [activeAccountId, accountCurrency, calendarSeries, canUseCalendar, chartMode, days, granularity, guardrails, isSample, leaks, metrics, onChartMode, returnHref, review, reviewLocked, selectedDate, setSelectedDate, timeZone]
  );
  const visibleLayout = layout.filter((item) => item.visible).sort((a, b) => a.order - b.order);
  const hiddenLayout = layout.filter((item) => !item.visible).sort((a, b) => a.order - b.order);

  function updateItem(widgetId: string, patch: Partial<DashboardLayoutItem>) {
    onLayoutChange(layout.map((item) => (item.widgetId === widgetId ? { ...item, ...patch } : item)));
  }

  function moveItem(widgetId: string, direction: -1 | 1) {
    const ordered = [...layout].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((item) => item.widgetId === widgetId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;
    const [item] = ordered.splice(index, 1);
    if (!item) return;
    ordered.splice(nextIndex, 0, item);
    onLayoutChange(ordered.map((entry, order) => ({ ...entry, order })));
  }

  return (
    <div className="mt-4 space-y-4">
      {selectedDate ? (
        <div className="inline-flex rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-3 py-1 text-xs font-bold text-[#BFDBFE]">
          Day view active
        </div>
      ) : null}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
        <KpiCard
          accent="green"
          delta={metrics.deltas?.netPnl.percent ?? null}
          definition="Your total profit or loss this period, after commissions and swaps."
          icon={<ArrowUpRight className="h-5 w-5" />}
          label={granularity === "week" ? "Weekly P&L" : "Net P&L"}
          sparkline={metrics.dailySeries.map((point) => point.netPnl)}
          value={formatCurrency(metrics.netPnl, accountCurrency)}
          valueClass={metrics.netPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}
          vsLabel={selectedDate ? "vs previous day" : `vs previous ${granularity}`}
        />
        <KpiCard
          accent="blue"
          delta={metrics.deltas?.winRate.percent ?? null}
          definition="The percentage of your closed trades that were profitable."
          icon={<Zap className="h-5 w-5" />}
          label="Win Rate"
          sparkline={metrics.dailySeries.map((point) => point.winRate ?? metrics.winRate)}
          value={formatPercent(metrics.winRate)}
          valueClass="text-[#60A5FA]"
          vsLabel={selectedDate ? "vs previous day" : "vs previous period"}
        />
        <KpiCard
          accent="violet"
          delta={metrics.deltas?.profitFactor.percent ?? null}
          definition="Total profit divided by total loss. Above 1 means you're net profitable; higher is better."
          icon={<TrendingUp className="h-5 w-5" />}
          label="Profit Factor"
          sparkline={metrics.dailySeries.map((point) => Math.max(0, point.cumulativePnl))}
          value={formatProfitFactor(metrics.profitFactor, metrics.profitFactorReason)}
          valueClass="text-[#A855F7]"
          vsLabel={selectedDate ? "vs previous day" : "vs previous period"}
        />
        <KpiCard
          accent="slate"
          delta={metrics.deltas?.totalTrades.percent ?? null}
          deltaNeutral
          definition="How many trades you closed this period. More isn't automatically better or worse."
          icon={<BarChart3 className="h-5 w-5" />}
          label="Total Trades"
          sparkline={metrics.dailySeries.map((point) => point.tradeCount)}
          value={formatNumber(metrics.totalTrades)}
          valueClass="text-white"
          vsLabel={selectedDate ? "vs previous day" : "vs previous period"}
        />
      </div>

      {editMode ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-4 py-3 text-sm">
          <span className="font-semibold text-[#BFDBFE]">Customize dashboard widgets</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#94A3B8]">{saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save unavailable" : "Backend persisted"}</span>
            <button className="inline-flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-bold text-white hover:bg-white/[0.06]" onClick={onResetLayout} type="button">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Reset to default
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid items-stretch gap-4 xl:grid-cols-12">
        {visibleLayout.map((item) => {
          const widget = widgets[item.widgetId];
          if (!widget) return null;
          return (
            <DashboardWidgetFrame
              editMode={editMode}
              item={item}
              key={item.widgetId}
              onHide={() => updateItem(item.widgetId, { visible: false })}
              onMoveDown={() => moveItem(item.widgetId, 1)}
              onMoveUp={() => moveItem(item.widgetId, -1)}
              title={widget.title}
            >
              {widget.component}
            </DashboardWidgetFrame>
          );
        })}
      </div>

      {editMode && hiddenLayout.length > 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-[#111827]/55 p-4">
          <h3 className="text-sm font-bold text-white">Hidden widgets</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {hiddenLayout.map((item) => {
              const widget = widgets[item.widgetId];
              if (!widget) return null;
              return (
                <button
                  className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm font-semibold text-[#CBD5E1] hover:bg-white/[0.06]"
                  key={item.widgetId}
                  onClick={() => updateItem(item.widgetId, { visible: true })}
                  type="button"
                >
                  <Eye className="h-4 w-4" aria-hidden />
                  Show {widget.title}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({
  accent,
  definition,
  delta,
  deltaNeutral,
  icon,
  label,
  sparkline,
  value,
  valueClass,
  vsLabel
}: {
  accent: "green" | "blue" | "violet" | "slate";
  definition: string;
  delta: number | null;
  deltaNeutral?: boolean;
  icon: ReactNode;
  label: string;
  sparkline: number[];
  value: string;
  valueClass: string;
  vsLabel: string;
}) {
  const chip = {
    blue: "bg-[#3B82F6]/15 text-[#60A5FA]",
    green: "bg-[#22C55E]/14 text-[#22C55E]",
    slate: "bg-[#A855F7]/15 text-[#A855F7]",
    violet: "bg-[#A855F7]/15 text-[#A855F7]"
  }[accent];
  const lineColor = {
    blue: "#60A5FA",
    green: "#22C55E",
    slate: "#94A3B8",
    violet: "#A855F7"
  }[accent];
  const positive = (delta ?? 0) >= 0;
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
  const deltaClass = deltaNeutral ? "text-[#94A3B8]" : positive ? "text-[#22C55E]" : "text-[#EF4444]";

  return (
    <article className="terminal-panel terminal-panel-interactive relative w-[264px] shrink-0 snap-start overflow-hidden rounded-2xl p-4 motion-safe:animate-[fadeUp_420ms_ease_both] sm:w-auto sm:shrink">
      <div className="flex items-start justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#94A3B8]">
          {label}
          <span className="group/info relative inline-flex">
            <button className="rounded-full text-[#64748B] transition hover:text-[#CBD5E1] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]" type="button" aria-label={`${label} definition`}>
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
            <span className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-20 w-64 rounded-xl border border-white/[0.08] bg-[#111827]/95 p-3 text-xs font-medium leading-5 text-[#CBD5E1] opacity-0 shadow-2xl transition group-hover/info:opacity-100 group-focus-within/info:opacity-100">
              {definition}
            </span>
          </span>
        </p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${chip}`}>{icon}</span>
      </div>
      <p className={`terminal-number mt-3 text-[28px] font-semibold leading-none tracking-normal ${valueClass}`}>{value}</p>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-2 text-[12px] font-semibold text-[#94A3B8]">
        <p className="flex min-w-0 items-center gap-1 overflow-hidden">
          <span>{vsLabel}</span>
          <span className={`inline-flex flex-shrink-0 items-center gap-1 ${deltaClass}`} aria-label={deltaNeutral ? "directional change, not a performance judgment" : undefined}>
            <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
            {formatDeltaPercent(delta)}
          </span>
        </p>
        <Sparkline className="max-w-[64px] flex-shrink-0 opacity-80" color={lineColor} values={sparkline} />
      </div>
    </article>
  );
}

function Sparkline({ className, color, values }: { className?: string; color: string; values: number[] }) {
  const path = useMemo(() => {
    const width = 60;
    const height = 24;
    const clean = values.length > 1 ? values.slice(-14) : [0, ...(values.length ? values : [0])];
    const min = Math.min(...clean);
    const max = Math.max(...clean);
    const span = max - min || 1;
    return clean
      .map((value, index) => {
        const x = (index / Math.max(1, clean.length - 1)) * width;
        const y = height - ((value - min) / span) * (height - 4) - 2;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg aria-hidden className={className} height="24" viewBox="0 0 60 24" width="60">
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

interface WidgetDefinition {
  category: string;
  component: ReactNode;
  defaultSize: "sm" | "md" | "lg";
  id: string;
  title: string;
}

function buildWidgetRegistry({
  activeAccountId,
  accountCurrency,
  calendarSeries,
  canUseCalendar,
  chartMode,
  days,
  granularity,
  guardrails,
  isSample,
  leaks,
  metrics,
  onChartMode,
  returnHref,
  review,
  reviewLocked,
  selectedDate,
  setSelectedDate,
  timeZone
}: {
  activeAccountId?: string | null;
  accountCurrency: string;
  calendarSeries: DailyPoint[];
  canUseCalendar: boolean;
  chartMode: "daily" | "cumulative";
  days: string[];
  granularity: Granularity;
  guardrails: GuardrailStatus | null;
  isSample: boolean;
  leaks: LeakFlagResponse[];
  metrics: MetricsResponse;
  onChartMode: (mode: "daily" | "cumulative") => void;
  returnHref: string;
  review: WeeklyReview | null;
  reviewLocked: boolean;
  selectedDate: string | null;
  setSelectedDate: (value: string | null) => void;
  timeZone: string;
}): Record<string, WidgetDefinition> {
  return {
    activity: {
      category: "Core",
      component: (
        <ActivityCalendar
          canUseCalendar={canUseCalendar}
          currency={accountCurrency}
          days={days}
          granularity={granularity}
          selectedDate={selectedDate}
          series={calendarSeries}
          setSelectedDate={setSelectedDate}
        />
      ),
      defaultSize: "md",
      id: "activity",
      title: "Activity Calendar"
    },
    coachNote: {
      category: "Coaching",
      component: <CoachNoteWidget isSample={isSample} locked={reviewLocked} review={review} />,
      defaultSize: "md",
      id: "coachNote",
      title: "Coach's Note"
    },
    equityCurve: {
      category: "Analytics",
      component: <EquityCurveWidget currency={accountCurrency} data={metrics.dailySeries} />,
      defaultSize: "lg",
      id: "equityCurve",
      title: "Equity Curve"
    },
    leakSummary: {
      category: "Behavior",
      component: <LeakSummaryWidget leaks={leaks} />,
      defaultSize: "sm",
      id: "leakSummary",
      title: "Leak Summary"
    },
    performance: {
      category: "Core",
      component: <PerformanceChart currency={accountCurrency} data={metrics.dailySeries} mode={chartMode} onMode={onChartMode} />,
      defaultSize: "lg",
      id: "performance",
      title: "Performance"
    },
    playbookComparison: {
      category: "Reports",
      component: <DashboardPlaybookComparisonWidget activeAccountId={activeAccountId} anchor={selectedDate ? `${selectedDate}T12:00:00.000Z` : undefined} currency={accountCurrency} granularity={selectedDate ? "day" : granularity} isSample={isSample} timeZone={timeZone} />,
      defaultSize: "md",
      id: "playbookComparison",
      title: "Playbook Performance"
    },
    recentTrades: {
      category: "Journal",
      component: <RecentTradesWidget currency={accountCurrency} isSample={isSample} returnHref={returnHref} selectedDate={selectedDate} trades={SAMPLE_RECENT_TRADES} />,
      defaultSize: "lg",
      id: "recentTrades",
      title: "Recent Trades"
    },
    riskRoom: {
      category: "Guardrails",
      component: <RiskRoomWidget currency={accountCurrency} status={guardrails} />,
      defaultSize: "sm",
      id: "riskRoom",
      title: "Risk Room"
    },
    sessionPerformance: {
      category: "Analytics",
      component: <SessionPerformanceWidget currency={accountCurrency} sessions={metrics.bySession} />,
      defaultSize: "md",
      id: "sessionPerformance",
      title: "Session Performance"
    },
    winLossDonut: {
      category: "Analytics",
      component: (
        <WinLossDonutWidget
          breakevenTrades={metrics.breakevenTrades}
          losingTrades={metrics.losingTrades}
          winRate={metrics.winRate}
          winningTrades={metrics.winningTrades}
        />
      ),
      defaultSize: "sm",
      id: "winLossDonut",
      title: "Win/Loss Mix"
    }
  };
}

function DashboardWidgetFrame({
  children,
  editMode,
  item,
  onHide,
  onMoveDown,
  onMoveUp,
  title
}: {
  children: ReactNode;
  editMode: boolean;
  item: DashboardLayoutItem;
  onHide: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  title: string;
}) {
  const spanClass = item.size === "lg" ? "xl:col-span-8" : item.size === "md" ? "xl:col-span-4" : "xl:col-span-4";

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!editMode) return;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onMoveUp();
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onMoveDown();
    }
  }

  return (
    <div className={`relative min-w-0 ${spanClass}`} onKeyDown={onKeyDown} tabIndex={editMode ? 0 : -1}>
      {editMode ? (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#0A0E1A]/90 p-1 shadow-2xl">
          <span className="rounded-lg p-1.5 text-[#94A3B8]" aria-label={`${title} drag handle`}>
            <GripVertical className="h-4 w-4" aria-hidden />
          </span>
          <button className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white" onClick={onMoveUp} type="button" aria-label={`Move ${title} earlier`}>
            <ChevronLeft className="h-4 w-4 rotate-90" aria-hidden />
          </button>
          <button className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white" onClick={onMoveDown} type="button" aria-label={`Move ${title} later`}>
            <ChevronRight className="h-4 w-4 rotate-90" aria-hidden />
          </button>
          <button className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-white/[0.06] hover:text-white" onClick={onHide} type="button" aria-label={`Hide ${title}`}>
            <EyeOff className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function PerformanceChart({
  currency,
  data,
  mode,
  onMode
}: {
  currency: string;
  data: DailyPoint[];
  mode: "daily" | "cumulative";
  onMode: (mode: "daily" | "cumulative") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const chart = useMemo(() => buildChart(data, mode), [data, mode]);

  return (
    <section className="terminal-panel rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-normal text-white">Performance</h2>
          <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
            {mode === "daily" ? "Daily P&L results" : "Daily P&L and cumulative results"}
          </p>
        </div>
        <div className="relative">
          <button
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-[#94A3B8] transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
            onClick={() => setMenuOpen((value) => !value)}
            type="button"
            aria-label="Performance options"
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 z-10 mt-2 w-44 rounded-xl border border-white/[0.08] bg-[#111827] p-2 shadow-2xl">
              {(["cumulative", "daily"] as const).map((item) => (
                <button
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold capitalize transition hover:bg-white/[0.06] ${
                    mode === item ? "text-[#60A5FA]" : "text-[#CBD5E1]"
                  }`}
                  key={item}
                  onClick={() => {
                    onMode(item);
                    setMenuOpen(false);
                  }}
                  type="button"
                >
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 h-[260px]">
        <svg aria-label="Performance chart" className="h-full w-full overflow-visible" role="img" viewBox="0 0 720 320">
          <defs>
            <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.42" />
              <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.ticks.map((tick) => (
            <g key={tick.value}>
              <line stroke="rgba(148,163,184,0.14)" strokeDasharray="5 6" x1="62" x2="700" y1={tick.y} y2={tick.y} />
              <text fill="#64748B" fontSize="13" x="12" y={tick.y + 5}>
                {formatNumber(tick.value)}
              </text>
            </g>
          ))}
          <path d={chart.areaPath} fill="url(#chartFill)" />
          <path d={chart.linePath} fill="none" stroke="#3B82F6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          {chart.points.map((point) => (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} fill="#5B7CFA" r="5" />
              <title>{`${point.date}: ${formatCurrency(point.netPnl, currency)} daily, ${formatCurrency(point.cumulativePnl, currency)} cumulative`}</title>
            </g>
          ))}
        </svg>
      </div>
      <ChartStatStrip currency={currency} data={data} />
    </section>
  );
}

function EquityCurveWidget({ currency, data }: { currency: string; data: DailyPoint[] }) {
  return (
    <section className="terminal-panel rounded-2xl p-4">
      <h2 className="text-[15px] font-bold text-white">Equity Curve</h2>
      <p className="mt-1 text-xs font-semibold text-[#94A3B8]">Reconstructed from cumulative period results.</p>
      <div className="mt-3 h-[220px]">
        <MiniAreaChart currency={currency} data={data} />
      </div>
      <ChartStatStrip currency={currency} data={data} compact />
    </section>
  );
}

function ChartStatStrip({ compact, currency, data }: { compact?: boolean; currency: string; data: DailyPoint[] }) {
  const values = data.map((point) => point.netPnl);
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);
  const net = data.reduce((sum, point) => sum + point.netPnl, 0);
  return (
    <div className={`grid grid-cols-3 gap-2 border-t border-white/[0.06] ${compact ? "mt-2 pt-2" : "mt-3 pt-3"}`}>
      {[
        ["High", high, high >= 0 ? "text-[#34D399]" : "text-[#F87171]"],
        ["Low", low, low >= 0 ? "text-[#34D399]" : "text-[#F87171]"],
        ["Net", net, net >= 0 ? "text-[#34D399]" : "text-[#F87171]"]
      ].map(([label, value, color]) => (
        <div className="min-w-0" key={label as string}>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748B]">{label}</p>
          <p className={`terminal-number mt-1 truncate text-xs font-semibold ${color}`}>{formatCurrency(value as number, currency)}</p>
        </div>
      ))}
    </div>
  );
}

function MiniAreaChart({ currency, data }: { currency: string; data: DailyPoint[] }) {
  const chart = useMemo(() => buildChart(data, "cumulative"), [data]);
  return (
    <svg aria-label="Equity curve" className="h-full w-full overflow-visible" role="img" viewBox="0 0 720 320">
      <defs>
        <linearGradient id="equityFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
        </linearGradient>
      </defs>
      {chart.ticks.map((tick) => (
        <line key={tick.value} stroke="rgba(148,163,184,0.13)" strokeDasharray="5 6" x1="62" x2="700" y1={tick.y} y2={tick.y} />
      ))}
      <path d={chart.areaPath} fill="url(#equityFill)" />
      <path d={chart.linePath} fill="none" stroke="#60A5FA" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {chart.points.map((point) => (
        <circle cx={point.x} cy={point.y} fill="#93C5FD" key={point.date} r="4">
          <title>{`${point.date}: ${formatCurrency(point.cumulativePnl, currency)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function WinLossDonutWidget({
  breakevenTrades,
  losingTrades,
  winRate,
  winningTrades
}: {
  breakevenTrades: number;
  losingTrades: number;
  winRate: number;
  winningTrades: number;
}) {
  const circumference = 100;
  const winDash = Math.max(0, Math.min(circumference, winRate * circumference));

  return (
    <section className="terminal-panel rounded-2xl p-4">
      <h2 className="text-[15px] font-bold text-white">Win/Loss Mix</h2>
      <div className="mt-3 grid place-items-center">
        <div className="relative h-28 w-28">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 42 42">
            <circle cx="21" cy="21" fill="none" r="15.9" stroke="rgba(148,163,184,0.18)" strokeWidth="5" />
            <circle cx="21" cy="21" fill="none" r="15.9" stroke="#22C55E" strokeDasharray={`${winDash} ${circumference - winDash}`} strokeLinecap="round" strokeWidth="5" />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="terminal-number text-xl font-semibold text-white">{formatPercent(winRate)}</p>
              <p className="text-xs font-semibold text-[#94A3B8]">win rate</p>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-[#94A3B8]">
        <span>Wins <strong className="terminal-number block text-[#22C55E]">{winningTrades}</strong></span>
        <span>Losses <strong className="terminal-number block text-[#EF4444]">{losingTrades}</strong></span>
        <span>BE <strong className="terminal-number block text-[#CBD5E1]">{breakevenTrades}</strong></span>
      </div>
    </section>
  );
}

function SessionPerformanceWidget({
  currency,
  sessions
}: {
  currency: string;
  sessions: MetricsResponse["bySession"];
}) {
  const max = Math.max(1, ...sessions.map((session) => Math.abs(session.netPnl)));
  return (
    <section className="terminal-panel rounded-2xl p-4">
      <h2 className="text-[15px] font-bold text-white">Session Performance</h2>
      <div className="mt-3 space-y-3">
        {sessions.map((session) => {
          const positive = session.netPnl >= 0;
          return (
            <div key={session.session}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="text-[#CBD5E1]">{session.session}</span>
                <span className={`${positive ? "text-[#22C55E]" : "text-[#EF4444]"} tabular-nums`}>{formatCurrency(session.netPnl, currency)}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.05]">
                <div className={`h-full rounded-full ${positive ? "bg-[#22C55E]" : "bg-[#EF4444]"}`} style={{ width: `${Math.max(8, (Math.abs(session.netPnl) / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LeakSummaryWidget({ leaks }: { leaks: LeakFlagResponse[] }) {
  const active = leaks.filter((flag) => flag.status === "active");
  const counts = {
    critical: active.filter((flag) => flag.severity === "critical").length,
    info: active.filter((flag) => flag.severity === "info").length,
    warning: active.filter((flag) => flag.severity === "warning").length
  };
  const top = [...active].sort((a, b) => severityRank(a.severity) - severityRank(b.severity)).slice(0, 3);

  return (
    <section className="terminal-panel rounded-2xl p-4">
      <h2 className="text-[15px] font-bold text-white">Leak Summary</h2>
      {active.length === 0 ? <p className="mt-2 text-sm font-medium text-[#94A3B8]">No active behavioral flags for this period.</p> : null}
      <div className="mt-3 grid grid-cols-2 gap-3">
        {(["critical", "warning", "info"] as const).map((severity) => (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3" key={severity}>
            <p className="text-[11px] font-semibold capitalize text-[#94A3B8]">{severity}</p>
            <p className="terminal-number mt-1 text-xl font-semibold text-white">{counts[severity]}</p>
          </div>
        ))}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3" title="Not available — requires order-modification history">
          <p className="text-[11px] font-semibold text-[#94A3B8]">Stop widened</p>
          <p className="mt-1 truncate text-xs font-semibold text-[#64748B]">Not available — hover for details</p>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {top.map((flag) => (
          <a className="block rounded-xl border border-white/[0.06] bg-black/20 p-3 text-sm font-semibold text-[#CBD5E1] hover:bg-white/[0.04]" href={flag.tradeIds[0] ? `/trades?trade=${flag.tradeIds[0]}` : `/dashboard?day=${flag.periodStart ?? ""}`} key={flag.id}>
            <span className={`mr-2 rounded-full px-2 py-0.5 text-[10px] uppercase ${flag.severity === "critical" ? "bg-[#EF4444]/15 text-[#FCA5A5]" : "bg-[#F59E0B]/15 text-[#FCD34D]"}`}>
              {flag.severity}
            </span>
            {describeLeak(flag)}
          </a>
        ))}
      </div>
    </section>
  );
}

function CoachNoteWidget({ isSample, locked, review }: { isSample: boolean; locked: boolean; review: WeeklyReview | null }) {
  if (locked) {
    return (
      <section className="terminal-panel rounded-2xl border-[#3B82F6]/20 bg-[#13213A]/70 p-4 shadow-[0_20px_80px_rgba(59,130,246,0.10)]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-white">Coach&apos;s Note</h2>
          <span className="rounded-full bg-[#3B82F6]/12 px-2 py-1 text-xs font-bold text-[#93C5FD]">Core</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#CBD5E1]">See what your AI coach would say — upgrade to unlock weekly coaching grounded in your trading history.</p>
        <a className="mt-3 inline-flex rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white" href="/settings">
          Upgrade to unlock
        </a>
      </section>
    );
  }

  const display = review ?? (isSample ? SAMPLE_WEEKLY_REVIEW : null);
  if (!display) {
    return (
      <section className="terminal-panel rounded-2xl p-4">
        <h2 className="text-[15px] font-bold text-white">Coach&apos;s Note</h2>
        <p className="mt-3 text-sm leading-6 text-[#94A3B8]">Your first coaching review will appear after your first full week of synced trades.</p>
        <Link className="mt-3 inline-flex text-sm font-bold text-[#93C5FD] hover:text-white" href="/#coaching">
          Learn how this works
        </Link>
      </section>
    );
  }

  const topLeak = [...display.leaks].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))[0];
  return (
    <section className="terminal-panel rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-white">Coach&apos;s Note</h2>
        {isSample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-1 text-xs font-bold text-[#93C5FD]">Sample coaching note</span> : null}
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#CBD5E1]">{display.summary}</p>
      {topLeak ? (
        <div className="mt-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase text-[#94A3B8]">{humanLeakType(topLeak.type)}</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${topLeak.severity === "critical" ? "bg-[#EF4444]/15 text-[#FCA5A5]" : topLeak.severity === "warning" ? "bg-[#F59E0B]/15 text-[#FCD34D]" : "bg-[#3B82F6]/15 text-[#93C5FD]"}`}>
              {topLeak.severity}
            </span>
          </div>
          <p className="mt-2 text-sm leading-5 text-[#CBD5E1]">{topLeak.explanation}</p>
        </div>
      ) : null}
      <a className="mt-3 inline-flex text-sm font-bold text-[#93C5FD] hover:text-white" href="/journal/review">
        View full review
      </a>
    </section>
  );
}

function RiskRoomWidget({ currency, status }: { currency: string; status: GuardrailStatus | null }) {
  if (!status) {
    return (
      <section className="terminal-panel rounded-2xl p-4">
        <h2 className="text-[15px] font-bold text-white">Risk Room</h2>
        <p className="mt-3 text-sm leading-6 text-[#94A3B8]">Set up prop firm rules to track your risk room.</p>
        <div className="mt-3">
          <EmptyPreview
            title="Preview once configured"
            cta={
              <a className="inline-flex rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white" href="/settings/prop-rules">
                Open Settings
              </a>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <section className="terminal-panel rounded-2xl p-4">
      <h2 className="text-[15px] font-bold text-white">Risk Room</h2>
      <div className="mt-3 space-y-3">
        {status.dailyLoss ? <RiskBar label="Daily loss used" pct={status.dailyLoss.usedPct} remaining={formatCurrency(status.dailyLoss.remainingAmount, currency)} status={status.dailyLoss.status} /> : null}
        {status.drawdown ? <RiskBar label="Drawdown used" pct={status.drawdown.usedPct} remaining={formatCurrency(status.drawdown.remainingAmount, currency)} status={status.drawdown.status} /> : null}
        {status.profitTarget ? <RiskBar label="Profit target progress" pct={status.profitTarget.progressPct} remaining={status.profitTarget.status === "reached" ? "Reached" : "In progress"} status={status.profitTarget.status === "reached" ? "ok" : "warning"} /> : null}
      </div>
    </section>
  );
}

function RiskBar({ label, pct, remaining, status }: { label: string; pct: number; remaining: string; status: "ok" | "warning" | "breached" }) {
  const color = status === "breached" ? "bg-[#EF4444]" : status === "warning" ? "bg-[#F59E0B]" : "bg-[#3B82F6]";
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#94A3B8]">
        <span>{label}</span>
        <span className="tabular-nums">{Math.round(pct * 100)}% · {remaining}</span>
      </div>
      <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }} />
      </div>
    </div>
  );
}

function RecentTradesWidget({
  currency,
  isSample,
  returnHref,
  selectedDate,
  trades
}: {
  currency: string;
  isSample: boolean;
  returnHref: string;
  selectedDate: string | null;
  trades: RecentTrade[];
}) {
  const visibleTrades = selectedDate ? trades.filter((trade) => trade.closeTime.slice(0, 10) === selectedDate) : trades;
  return (
    <section className="terminal-panel rounded-2xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold text-white">Recent Trades</h2>
          <p className="mt-1 text-xs font-semibold text-[#94A3B8]">{isSample ? "Sample closed trades until broker history is connected." : "Last closed trades for this period."}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {isSample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-1 text-xs font-bold text-[#93C5FD]">Sample</span> : null}
          <Link className="text-xs font-bold text-[#93C5FD] hover:text-white" href="/trades">
            View full journal
          </Link>
        </div>
      </div>
      <div className="mt-3 divide-y divide-white/[0.06]">
        {visibleTrades.slice(0, 6).map((trade) => (
          <a className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm transition hover:bg-white/[0.03]" href={`/trades/${trade.id}?from=${encodeURIComponent(returnHref)}`} key={trade.id}>
            <span>
              <span className="font-semibold text-white">{trade.symbol}</span>
              <span className="ml-2 text-xs font-bold text-[#94A3B8]">{trade.side}</span>
              <span className="mt-1 block text-xs text-[#64748B]">{formatShortDateTime(trade.closeTime)}</span>
            </span>
            <span className={`${trade.netProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold tabular-nums`}>{formatCurrency(trade.netProfit, currency)}</span>
          </a>
        ))}
        {visibleTrades.length === 0 ? <p className="py-4 text-sm font-semibold text-[#94A3B8]">No closed trades for this day.</p> : null}
      </div>
    </section>
  );
}

function DashboardPlaybookComparisonWidget({
  activeAccountId,
  anchor,
  currency,
  granularity,
  isSample,
  timeZone
}: {
  activeAccountId?: string | null;
  anchor?: string;
  currency: string;
  granularity: Granularity;
  isSample: boolean;
  timeZone: string;
}) {
  const [summary, setSummary] = useState<PlaybookPerformanceSummaryResponse | null>(null);

  useEffect(() => {
    if (isSample) {
      setSummary(SAMPLE_PLAYBOOK_PERFORMANCE);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({
      anchor: anchor ?? new Date().toISOString(),
      granularity,
      tz: timeZone
    });
    if (activeAccountId) query.set("accountId", activeAccountId);
    fetchPlaybookPerformanceSummary(query, controller.signal)
      .then(setSummary)
      .catch(() => setSummary(null));
    return () => controller.abort();
  }, [activeAccountId, anchor, granularity, isSample, timeZone]);

  if (!summary) {
    return (
      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5">
        <h2 className="text-lg font-bold text-white">Playbook Performance</h2>
        <p className="mt-3 text-sm font-semibold text-[#94A3B8]">Create a playbook to compare strategy performance.</p>
      </section>
    );
  }

  return <PlaybookComparisonWidget currency={currency} data={summary} sample={isSample} />;
}

function ActivityCalendar({
  canUseCalendar,
  currency,
  days,
  granularity,
  selectedDate,
  series,
  setSelectedDate
}: {
  canUseCalendar: boolean;
  currency: string;
  days: string[];
  granularity: Granularity;
  selectedDate: string | null;
  series: DailyPoint[];
  setSelectedDate: (value: string | null) => void;
}) {
  const activityByDay = new Map(series.map((point) => [point.date, point]));
  const visibleDays = granularity === "day" ? days : granularity === "week" ? days.slice(0, 7) : granularity === "month" ? buildMonthGrid(days) : buildYearGrid(days[0]);
  const maxAbs = Math.max(1, ...series.map((point) => Math.abs(point.netPnl)));

  return (
    <section className="terminal-panel relative rounded-2xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-bold tracking-normal text-white">Activity Calendar</h2>
          <p className="mt-1 text-xs font-semibold text-[#94A3B8]">P&L heatmap by close date</p>
        </div>
        <span className="rounded-full border border-white/[0.08] px-2 py-1 text-xs font-bold capitalize text-[#94A3B8]">{granularity}</span>
      </div>

      <div className={`mt-3 rounded-2xl bg-black/35 p-3 ${canUseCalendar ? "" : "blur-[2px]"}`}>
        {granularity === "year" ? (
          <YearHeatmap activityByDay={activityByDay} currency={currency} days={visibleDays} maxAbs={maxAbs} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-[#94A3B8]">
              {weekdays.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className={`mt-3 grid grid-cols-7 ${granularity === "month" ? "gap-1.5" : "gap-2"}`}>
              {visibleDays.map((day, index) => (
                <HeatmapDay
                  activity={activityByDay.get(day)}
                  currency={currency}
                  day={day}
                  key={`${day}-${index}`}
                  maxAbs={maxAbs}
                  selected={selectedDate === day}
                  setSelectedDate={setSelectedDate}
                  size={granularity === "month" ? "sm" : "lg"}
                />
              ))}
            </div>
          </>
        )}
        <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[#94A3B8]">
          <span>Loss</span>
          <span className="h-3 w-3 rounded bg-[#7F1D1D]" />
          <span className="h-3 w-3 rounded bg-[#1F2937]" />
          <span className="h-3 w-3 rounded bg-[#14532D]" />
          <span>Profit</span>
        </div>
      </div>
      {!canUseCalendar ? (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-[#0A0E1A]/55 p-4 text-center">
          <div className="max-w-xs rounded-2xl border border-white/[0.08] bg-[#111827] p-5">
            <LockKeyhole className="mx-auto h-6 w-6 text-[#3B82F6]" aria-hidden />
            <p className="mt-3 text-sm font-bold text-white">Activity heatmap is a Core feature</p>
            <p className="mt-2 text-xs leading-5 text-[#94A3B8]">Upgrade to unlock deeper period activity review.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function HeatmapDay({
  activity,
  currency,
  day,
  maxAbs,
  selected,
  setSelectedDate,
  size
}: {
  activity?: DailyPoint;
  currency: string;
  day: string;
  maxAbs: number;
  selected: boolean;
  setSelectedDate: (value: string | null) => void;
  size: "sm" | "lg";
}) {
  const date = new Date(`${day}T00:00:00`);
  const tooltip = `${formatLongDate(day)} · ${activity?.tradeCount ?? 0} trades · ${formatCurrency(activity?.netPnl ?? 0, currency)} · ${formatPercent(activity?.winRate ?? 0)}`;
  const cellSize = size === "lg" ? "h-16 min-h-16 text-base" : "h-10 min-h-10 text-sm";

  return (
    <button
      aria-label={tooltip}
      className={`group relative grid ${cellSize} min-w-0 place-items-center rounded-xl border text-center font-bold tabular-nums transition focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${heatmapClass(activity, maxAbs)} ${
        selected ? "ring-2 ring-[#3B82F6] ring-offset-2 ring-offset-[#050816]" : ""
      }`}
      onClick={() => setSelectedDate(selected ? null : day)}
      type="button"
    >
      {date.getDate()}
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-48 -translate-x-1/2 rounded-xl border border-white/[0.08] bg-[#111827]/95 p-3 text-left text-xs font-semibold leading-5 text-[#CBD5E1] opacity-0 shadow-2xl transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className="block text-white">{formatLongDate(day)}</span>
        <span className="block">{activity?.tradeCount ?? 0} trades</span>
        <span className={`block ${(activity?.netPnl ?? 0) >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{formatCurrency(activity?.netPnl ?? 0, currency)}</span>
        <span className="block">Win rate {formatPercent(activity?.winRate ?? 0)}</span>
      </span>
    </button>
  );
}

function YearHeatmap({
  activityByDay,
  currency,
  days,
  maxAbs,
  selectedDate,
  setSelectedDate
}: {
  activityByDay: Map<string, DailyPoint>;
  currency: string;
  days: string[];
  maxAbs: number;
  selectedDate: string | null;
  setSelectedDate: (value: string | null) => void;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {days.map((day, index) => (
          <HeatmapDay
            activity={activityByDay.get(day)}
            currency={currency}
            day={day}
            key={`${day}-${index}`}
            maxAbs={maxAbs}
            selected={selectedDate === day}
            setSelectedDate={setSelectedDate}
            size="sm"
          />
        ))}
      </div>
    </div>
  );
}

function heatmapClass(activity: DailyPoint | undefined, maxAbs: number) {
  if (!activity || activity.tradeCount === 0 || activity.netPnl === 0) {
    return "border-white/[0.06] bg-[#1F2937] text-[#CBD5E1] hover:bg-[#263244]";
  }

  const intensity = Math.min(4, Math.max(1, Math.ceil((Math.abs(activity.netPnl) / maxAbs) * 4)));
  if (activity.netPnl > 0) {
    return [
      "border-[#166534]/30 bg-[#14532D]/45 text-[#DCFCE7] hover:bg-[#14532D]/65",
      "border-[#15803D]/35 bg-[#166534]/55 text-[#DCFCE7] hover:bg-[#166534]/75",
      "border-[#16A34A]/40 bg-[#15803D]/70 text-white hover:bg-[#15803D]/85",
      "border-[#22C55E]/45 bg-[#16A34A]/80 text-white hover:bg-[#16A34A]"
    ][intensity - 1];
  }

  return [
    "border-[#991B1B]/30 bg-[#7F1D1D]/45 text-[#FEE2E2] hover:bg-[#7F1D1D]/65",
    "border-[#B91C1C]/35 bg-[#991B1B]/55 text-[#FEE2E2] hover:bg-[#991B1B]/75",
    "border-[#DC2626]/40 bg-[#B91C1C]/70 text-white hover:bg-[#B91C1C]/85",
    "border-[#EF4444]/45 bg-[#DC2626]/80 text-white hover:bg-[#DC2626]"
  ][intensity - 1];
}

function buildMonthGrid(days: string[]) {
  const first = days[0] ? new Date(`${days[0]}T00:00:00`) : new Date();
  const prefix = first.getDay();
  const start = new Date(first);
  start.setDate(first.getDate() - prefix);
  return Array.from({ length: 42 }, (_, index) => {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + index);
    return toDateKeyLocal(cursor);
  });
}

function buildYearGrid(firstDay?: string) {
  const date = firstDay ? new Date(`${firstDay}T00:00:00`) : new Date();
  const start = new Date(date.getFullYear(), 0, 1);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 371 }, (_, index) => {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + index);
    return toDateKeyLocal(cursor);
  });
}

function buildChart(data: DailyPoint[], mode: "daily" | "cumulative") {
  const width = 720;
  const height = 320;
  const left = 62;
  const right = 20;
  const top = 24;
  const bottom = 36;
  const values = data.map((point) => (mode === "daily" ? point.netPnl : point.cumulativePnl));
  const min = Math.min(0, ...values);
  const max = Math.max(100, ...values);
  const span = max - min || 1;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = (index: number) => left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
  const yFor = (value: number) => top + (1 - (value - min) / span) * plotHeight;
  const points = data.map((point, index) => ({
    ...point,
    x: xFor(index),
    y: yFor(mode === "daily" ? point.netPnl : point.cumulativePnl)
  }));
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? left} ${height - bottom} L ${points[0]?.x ?? left} ${height - bottom} Z`;
  const ticks = Array.from({ length: 4 }, (_, index) => {
    const value = min + (span / 3) * index;
    return { value: Math.round(value), y: yFor(value) };
  }).reverse();

  return { areaPath, linePath, points, ticks };
}

function DashboardShellFallback() {
  return <div className="h-full min-h-0 bg-[#0A0E1A]" />;
}

function getAccountContext(account: AccountSummary | null | undefined, isSample: boolean) {
  if (isSample || !account) {
    return {
      balance: SAMPLE_ACCOUNT_CONTEXT.balance,
      currency: SAMPLE_ACCOUNT_CURRENCY,
      equity: SAMPLE_ACCOUNT_CONTEXT.equity,
      lastSyncLabel: `Synced ${formatShortDateTime(SAMPLE_ACCOUNT_CONTEXT.lastSyncAt)}`,
      login: SAMPLE_ACCOUNT_CONTEXT.login,
      name: SAMPLE_ACCOUNT_CONTEXT.name,
      status: SAMPLE_ACCOUNT_CONTEXT.status,
      statusLabel: "Synced"
    };
  }

  const status = account.connectionStatus || "DISCONNECTED";
  return {
    balance: account.balance ?? 0,
    currency: account.currency,
    equity: account.equity ?? account.balance ?? 0,
    lastSyncLabel: account.lastSyncAt ? `Synced ${formatShortDateTime(account.lastSyncAt)}` : "No sync yet",
    login: account.login,
    name: account.name,
    status,
    statusLabel: status === "CONNECTED" ? "Synced" : status === "SYNCING" ? "Syncing" : status === "ERROR" ? "Error" : "Disconnected"
  };
}

function scopeSampleMetricsToDay(metrics: MetricsResponse, date: string): MetricsResponse {
  const current = metrics.dailySeries.find((point) => point.date === date) ?? {
    breakevenTrades: 0,
    cumulativePnl: 0,
    date,
    losingTrades: 0,
    netPnl: 0,
    rMultipleSum: 0,
    tradeCount: 0,
    winRate: 0,
    winningTrades: 0
  };
  const currentIndex = metrics.dailySeries.findIndex((point) => point.date === date);
  const previous = currentIndex > 0 ? metrics.dailySeries[currentIndex - 1] : undefined;
  const profitFactor = current.tradeCount === 0 ? null : current.netPnl >= 0 ? 1.85 : 0.72;
  const previousProfitFactor = !previous || previous.tradeCount === 0 ? null : previous.netPnl >= 0 ? 1.85 : 0.72;

  return {
    ...metrics,
    bySession: metrics.bySession.map((session, index) => ({
      ...session,
      netPnl: index === 0 ? current.netPnl : 0,
      trades: index === 0 ? current.tradeCount : 0,
      winRate: index === 0 ? current.winRate ?? 0 : 0
    })),
    bySymbol: metrics.bySymbol.map((symbol, index) => ({
      ...symbol,
      netPnl: index === 0 ? current.netPnl : 0,
      trades: index === 0 ? current.tradeCount : 0,
      winRate: index === 0 ? current.winRate ?? 0 : 0
    })),
    dailySeries: [current],
    deltas: {
      netPnl: deltaValue(current.netPnl, previous?.netPnl ?? 0),
      profitFactor: deltaValue(profitFactor ?? 0, previousProfitFactor ?? 0),
      totalTrades: deltaValue(current.tradeCount, previous?.tradeCount ?? 0),
      winRate: deltaValue(current.winRate ?? 0, previous?.winRate ?? 0)
    },
    expectancyCurrency: current.tradeCount ? current.netPnl / current.tradeCount : 0,
    netPnl: current.netPnl,
    period: { ...metrics.period, label: formatLongDate(date) },
    profitFactor,
    profitFactorReason: current.tradeCount === 0 ? "no_trades" : null,
    totalTrades: current.tradeCount,
    winRate: current.winRate ?? 0
  };
}

function deltaValue(current: number, previous: number) {
  return {
    absolute: current - previous,
    current,
    percent: previous === 0 ? null : (current - previous) / Math.abs(previous),
    previous
  };
}

function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function severityRank(severity: LeakFlagResponse["severity"]) {
  return { critical: 0, warning: 1, info: 2 }[severity];
}

function evidenceNumber(flag: LeakFlagResponse, key: string) {
  const value = flag.evidence[key];
  return typeof value === "number" ? value : Number(value);
}

function describeLeak(flag: LeakFlagResponse) {
  switch (flag.type) {
    case "revenge_trade":
      return `Revenge trade: re-entered ${evidenceNumber(flag, "minutesAfter")} min after a loss at ${evidenceNumber(flag, "sizeMultiplier")}x size`;
    case "overtrading":
      return `Overtrading: ${evidenceNumber(flag, "dayCount")} trades vs ${evidenceNumber(flag, "threshold")} threshold`;
    case "missing_stop_loss":
      return `Missing stop loss: ${flag.evidence.symbol ?? "trade"} closed with ${flag.evidence.netProfit ?? "unknown"} net P&L`;
    case "stop_widened":
      return `Stop widened: risk increased ${Math.round(evidenceNumber(flag, "riskIncreasePct") * 100)}%`;
    case "risk_inconsistency":
      return `Risk inconsistency: risk variation CV ${evidenceNumber(flag, "cv")}`;
    case "asymmetric_win_loss":
      return `Asymmetric win/loss: avg winner is ${evidenceNumber(flag, "ratio")}x avg loser in R`;
    case "correlated_cluster":
      return `Correlated cluster: ${flag.evidence.group ?? "group"} overlap from ${flag.evidence.overlapStart ?? "unknown"}`;
    case "excessive_single_trade_risk":
      return `Single-trade risk: ${Math.round(evidenceNumber(flag, "riskPct") * 1000) / 10}% of equity at open`;
    default:
      return "Behavioral flag detected";
  }
}

function humanLeakType(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function describeAlert(alert: ReturnType<typeof useAlerts>[number]) {
  const payload = alert.payload as Partial<LeakFlagResponse> & { overallStatus?: string };
  if (payload.type && payload.evidence) return describeLeak(payload as LeakFlagResponse);
  if (payload.overallStatus) return `Risk room moved to ${payload.overallStatus}`;
  return alert.type.replaceAll("_", " ");
}

function toDateKeyLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function IconButton({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-[#94A3B8] transition hover:bg-white/[0.05] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="mb-4 block last:mb-0">
      <span className="mb-2 block text-xs font-bold uppercase tracking-normal text-[#64748B]">{label}</span>
      {children}
    </label>
  );
}
