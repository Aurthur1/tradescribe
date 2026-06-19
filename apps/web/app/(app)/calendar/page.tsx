"use client";

import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AccountSwitcher } from "../_components/account-switcher";
import { DataTable, EmptyPreview, MiniBar, Panel, Pill, Stat, StatGrid } from "../_components/ui";
import {
  fetchTrades,
  type DailyPoint,
  type Granularity,
  type LeakFlagResponse,
  type MetricsResponse,
  type TradesListResponse,
  useCurrentUser,
  useLeaks,
  useMetrics
} from "../_lib/dashboard-data";
import { SAMPLE_ANCHOR, SAMPLE_DASHBOARD_DATA } from "../_lib/dashboard-sample";
import { initialAnchor, rangeLabel, stepAnchor, toDateKey } from "../_lib/date-range";
import { formatCurrency, formatNumber, formatPercent } from "../_lib/format";

type CalendarView = "month" | "week" | "year";
type ColorMode = "pnl" | "r" | "trades";
type TradeRow = TradesListResponse["data"][number];

const views: CalendarView[] = ["month", "week", "year"];
const colorModes: Array<{ label: string; value: ColorMode }> = [
  { label: "Net P&L", value: "pnl" },
  { label: "R sum", value: "r" },
  { label: "Trade count", value: "trades" }
];
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const { data: context } = useCurrentUser();
  const accounts = context?.accounts ?? [];
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const sample = !activeAccount;
  const plan = context?.user.plan ?? "FREE";
  const isAdmin = context?.user.role === "ADMIN";
  const unlocked = sample || isAdmin || plan !== "FREE";
  const previewSample = !sample && !unlocked;
  const displaySample = sample || previewSample;
  const [view, setView] = useState<CalendarView>("month");
  const [colorMode, setColorMode] = useState<ColorMode>("pnl");
  const [anchor, setAnchor] = useState(sample ? SAMPLE_ANCHOR : initialAnchor());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const timeZone = context?.preferences.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const granularity: Granularity = view === "year" ? "year" : view === "week" ? "week" : "month";
  const metricsState = useMetrics(activeAccount?.id ?? null, { anchor, filters: {}, granularity, tz: timeZone });
  const metrics = displaySample ? extendSampleForCalendar(SAMPLE_DASHBOARD_DATA, anchor, granularity) : metricsState.data ?? emptyMetrics(granularity);
  const dayMetricsState = useMetrics(activeAccount?.id ?? null, { anchor: selectedDate ? `${selectedDate}T12:00:00.000Z` : anchor, filters: selectedDate ? { day: selectedDate } : {}, granularity: "day", tz: timeZone });
  const dayMetrics = displaySample && selectedDate ? sampleDayMetrics(metrics, selectedDate) : dayMetricsState.data;
  const dayLeaks = useLeaks(activeAccount?.id ?? null, { anchor: selectedDate ? `${selectedDate}T12:00:00.000Z` : anchor, granularity: "day", tz: timeZone });
  const [dayTrades, setDayTrades] = useState<TradeRow[]>([]);
  const currency = activeAccount?.currency ?? "USD";

  useEffect(() => {
    setSelectedAccountId(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [context?.preferences.activeAccountId, primaryAccount?.id]);

  useEffect(() => {
    if (!selectedDate || !activeAccount?.id) {
      setDayTrades([]);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({
      date: selectedDate,
      granularity: "day",
      pageSize: "100",
      sortSpec: "-closeTime",
      tz: timeZone
    });
    fetchTrades(activeAccount.id, query, controller.signal)
      .then((payload) => setDayTrades(payload.data))
      .catch(() => setDayTrades([]));
    return () => controller.abort();
  }, [activeAccount?.id, selectedDate, timeZone]);

  const seriesByDay = useMemo(() => new Map(metrics.dailySeries.map((point) => [point.date, point])), [metrics.dailySeries]);
  const days = useMemo(() => daysForCalendar(anchor, view), [anchor, view]);
  const maxAbs = useMemo(() => Math.max(1, ...metrics.dailySeries.map((point) => Math.abs(colorValue(point, colorMode)))), [colorMode, metrics.dailySeries]);
  const margin = useMemo(() => buildMargin(metrics), [metrics]);
  const selectedPoint = selectedDate ? seriesByDay.get(selectedDate) ?? null : null;

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[1720px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[--text-low]">Review Calendar</p>
            <h1 className="mt-2 text-[28px] font-semibold text-white">How Was This {view === "year" ? "Year" : view === "week" ? "Week" : "Month"}?</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#94A3B8]">Daily P&L, R quality, trade density, leaks, and review context in one dense surface.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {displaySample ? <Pill>{sample ? "Sample data" : "Free preview"}</Pill> : null}
            <AccountSwitcher accounts={accounts} activeAccountId={selectedAccountId} canUseAllAccounts={isAdmin || plan === "PRO"} onAccountChange={setSelectedAccountId} plan={plan} />
          </div>
        </div>

        <Panel className="mt-4" padding="compact">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] hover:text-white" onClick={() => setAnchor(stepAnchor(anchor, granularity, -1))} type="button" aria-label="Previous">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-bold text-white">
                <CalendarDays className="h-4 w-4 text-[#60A5FA]" aria-hidden />
                {rangeLabel(anchor, granularity)}
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] hover:text-white" onClick={() => setAnchor(stepAnchor(anchor, granularity, 1))} type="button" aria-label="Next">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <Segmented values={views} value={view} onChange={(next) => { setView(next); setSelectedDate(null); }} />
            <div className="inline-flex rounded-xl bg-white/[0.04] p-1">
              {colorModes.map((mode) => (
                <button className={`rounded-lg px-3 py-2 text-xs font-bold ${colorMode === mode.value ? "bg-[#3B82F6] text-white" : "text-[#94A3B8] hover:text-white"}`} key={mode.value} onClick={() => setColorMode(mode.value)} type="button">
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          {previewSample ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-3 py-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-[#BFDBFE]"><LockKeyhole className="h-4 w-4" /> Free plan preview. Upgrade for day-detail analytics.</span>
              <Link className="rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-bold text-white" href="/settings/billing">Upgrade</Link>
            </div>
          ) : null}
          {metricsState.isLoading ? <p className="mt-3 text-xs font-bold text-[#94A3B8]">Refreshing calendar metrics...</p> : null}
        </Panel>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Panel accent padding="compact">
            {view !== "year" ? (
              <>
                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748B]">
                  {weekdays.map((day) => <div key={day}>{day}</div>)}
                </div>
                <div className={`mt-2 grid grid-cols-7 ${view === "week" ? "gap-3" : "gap-2"}`}>
                  {days.map((day) => (
                    <DayTile colorMode={colorMode} day={day} isCurrentPeriod={isInCurrentPeriod(day, anchor, view)} key={day} maxAbs={maxAbs} onSelect={setSelectedDate} point={seriesByDay.get(day)} selected={selectedDate === day} view={view} />
                  ))}
                </div>
              </>
            ) : (
              <YearHeatmap anchor={anchor} colorMode={colorMode} maxAbs={maxAbs} onSelect={setSelectedDate} selectedDate={selectedDate} seriesByDay={seriesByDay} />
            )}
          </Panel>

          <aside className="space-y-4">
            <MarginAnalytics currency={currency} margin={margin} metrics={metrics} />
            <MonthlyStrip anchor={anchor} currency={currency} data={metrics.dailySeries} />
          </aside>
        </div>

        {selectedDate ? (
          <DayDetail
            currency={currency}
            date={selectedDate}
            locked={!unlocked}
            leaks={displaySample ? sampleLeaks(selectedDate) : dayLeaks}
            metrics={dayMetrics ?? sampleDayMetrics(metrics, selectedDate)}
            onClose={() => setSelectedDate(null)}
            point={selectedPoint}
            sample={displaySample}
            trades={displaySample ? sampleCalendarTrades(selectedDate) : dayTrades}
          />
        ) : null}
      </div>
    </div>
  );
}

function DayTile({ colorMode, day, isCurrentPeriod, maxAbs, onSelect, point, selected, view }: { colorMode: ColorMode; day: string; isCurrentPeriod: boolean; maxAbs: number; onSelect: (day: string) => void; point?: DailyPoint; selected: boolean; view: CalendarView }) {
  const date = new Date(`${day}T00:00:00`);
  const today = day === toDateKey(new Date());
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const intensity = point ? Math.min(1, Math.abs(colorValue(point, colorMode)) / maxAbs) : 0;
  const positive = colorValue(point, colorMode) >= 0;
  const wins = point?.winningTrades ?? 0;
  const losses = point?.losingTrades ?? 0;
  const total = Math.max(1, wins + losses + (point?.breakevenTrades ?? 0));
  return (
    <button
      className={`group min-w-0 rounded-xl border p-2 text-left transition hover:-translate-y-0.5 hover:border-[#3B82F6]/35 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6] ${
        selected ? "ring-2 ring-[#3B82F6]" : today ? "ring-1 ring-[#22D3EE]" : ""
      } ${!isCurrentPeriod ? "opacity-35" : weekend ? "opacity-70" : ""}`}
      onClick={() => onSelect(day)}
      style={{
        background: point ? heatBg(positive, intensity) : "rgba(15, 23, 42, 0.44)",
        borderColor: point ? (positive ? "rgba(34,197,94,0.22)" : "rgba(239,68,68,0.22)") : "rgba(255,255,255,0.06)"
      }}
      type="button"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold text-white">{date.getDate()}</span>
        <span className="terminal-number text-[11px] font-bold text-[#CBD5E1]">{point?.tradeCount ?? 0}</span>
      </div>
      <p className={`terminal-number mt-2 truncate text-sm font-bold ${point && point.netPnl < 0 ? "text-[#FCA5A5]" : "text-[#86EFAC]"}`}>{point ? formatTileValue(point, colorMode) : "—"}</p>
      <p className="mt-1 truncate text-[11px] font-semibold text-[#94A3B8]">{point ? `${formatPercent(point.winRate ?? 0)} WR` : "No trades"}</p>
      <div className={`mt-2 flex h-1.5 overflow-hidden rounded-full bg-white/[0.08] ${view === "week" ? "mb-2" : ""}`}>
        <span className="bg-[#22C55E]" style={{ width: `${(wins / total) * 100}%` }} />
        <span className="bg-[#EF4444]" style={{ width: `${(losses / total) * 100}%` }} />
        <span className="bg-[#94A3B8]" style={{ width: `${((point?.breakevenTrades ?? 0) / total) * 100}%` }} />
      </div>
      {view === "week" ? <WeekTileExtra point={point} /> : null}
    </button>
  );
}

function WeekTileExtra({ point }: { point?: DailyPoint }) {
  return (
    <div className="space-y-1 border-t border-white/[0.06] pt-2 text-[11px] font-semibold text-[#94A3B8]">
      <div className="flex justify-between"><span>R sum</span><span className="terminal-number">{point ? point.rMultipleSum.toFixed(2) : "—"}</span></div>
      <div className="flex justify-between"><span>Split</span><span>{point ? `${point.winningTrades}/${point.losingTrades}` : "—"}</span></div>
      <div className="truncate">Top symbol loads in detail</div>
    </div>
  );
}

function YearHeatmap({ anchor, colorMode, maxAbs, onSelect, selectedDate, seriesByDay }: { anchor: string; colorMode: ColorMode; maxAbs: number; onSelect: (day: string) => void; selectedDate: string | null; seriesByDay: Map<string, DailyPoint> }) {
  const year = new Date(anchor).getFullYear();
  const start = new Date(year, 0, 1);
  start.setDate(start.getDate() - start.getDay());
  const days = Array.from({ length: 371 }, (_, index) => {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + index);
    return toDateKey(cursor);
  });
  return (
    <div className="overflow-x-auto pb-3">
      <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
        {days.map((day) => {
          const point = seriesByDay.get(day);
          const inYear = new Date(`${day}T00:00:00`).getFullYear() === year;
          const value = colorValue(point, colorMode);
          const intensity = Math.min(1, Math.abs(value) / maxAbs);
          return (
            <button
              aria-label={day}
              className={`h-4 w-4 rounded-[4px] border border-white/[0.03] ${selectedDate === day ? "ring-2 ring-[#3B82F6]" : ""} ${inYear ? "" : "opacity-25"}`}
              key={day}
              onClick={() => onSelect(day)}
              style={{ background: point ? heatBg(value >= 0, intensity) : "rgba(30,41,59,0.55)" }}
              title={`${day}: ${point ? formatTileValue(point, colorMode) : "No trades"}`}
              type="button"
            />
          );
        })}
      </div>
    </div>
  );
}

function MarginAnalytics({ currency, margin, metrics }: { currency: string; margin: ReturnType<typeof buildMargin>; metrics: MetricsResponse }) {
  return (
    <>
      <Panel padding="compact">
        <h2 className="text-sm font-bold text-white">Margin Analytics</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricPill label="Best day" tone="positive" value={margin.bestDay ? `${margin.bestDay.date} ${formatCurrency(margin.bestDay.netPnl, currency)}` : "—"} />
          <MetricPill label="Worst day" tone="critical" value={margin.worstDay ? `${margin.worstDay.date} ${formatCurrency(margin.worstDay.netPnl, currency)}` : "—"} />
          <MetricPill label="Best weekday" value={margin.bestWeekday ? margin.bestWeekday.weekday : "—"} />
          <MetricPill label="Worst weekday" value={margin.worstWeekday ? margin.worstWeekday.weekday : "—"} />
        </div>
        <div className="mt-3 space-y-2">
          {metrics.byDayOfWeek.map((day) => (
            <div key={day.weekday}>
              <div className="flex justify-between text-[11px] font-bold text-[#94A3B8]"><span>{day.weekday}</span><span>{formatPercent(day.winRate)}</span></div>
              <MiniBar tone={day.netPnl >= 0 ? "positive" : "negative"} value={day.winRate * 100} />
            </div>
          ))}
        </div>
      </Panel>
      <Panel padding="compact">
        <h2 className="text-sm font-bold text-white">Consistency</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Stat label="Green Days" tone="positive" value={formatPercent(margin.greenDayPct)} />
          <Stat label="Green Streak" value={margin.longestGreenStreak} />
          <Stat label="Red Streak" tone="negative" value={margin.longestRedStreak} />
        </div>
        <p className="mt-3 text-xs font-semibold text-[#94A3B8]">Most-traded symbol: <span className="text-white">{metrics.bySymbol[0]?.symbol ?? "—"}</span></p>
      </Panel>
    </>
  );
}

function MonthlyStrip({ anchor, currency, data }: { anchor: string; currency: string; data: DailyPoint[] }) {
  const year = new Date(anchor).getFullYear();
  const months = Array.from({ length: 12 }, (_, month) => {
    const value = data.filter((point) => point.date.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).reduce((sum, point) => sum + point.netPnl, 0);
    return { label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(year, month, 1)), value };
  });
  const max = Math.max(1, ...months.map((month) => Math.abs(month.value)));
  return (
    <Panel padding="compact">
      <h2 className="text-sm font-bold text-white">Monthly Totals</h2>
      <div className="mt-3 space-y-2">
        {months.map((month) => (
          <div className="grid grid-cols-[36px_1fr_82px] items-center gap-2 text-xs font-bold" key={month.label}>
            <span className="text-[#94A3B8]">{month.label}</span>
            <MiniBar tone={month.value >= 0 ? "positive" : "negative"} value={(Math.abs(month.value) / max) * 100} />
            <span className={`terminal-number text-right ${month.value >= 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>{formatCurrency(month.value, currency)}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DayDetail({ currency, date, leaks, locked, metrics, onClose, point, sample, trades }: { currency: string; date: string; leaks: LeakFlagResponse[]; locked: boolean; metrics: MetricsResponse; onClose: () => void; point: DailyPoint | null; sample: boolean; trades: TradeRow[] }) {
  const bestTrade = [...trades].sort((a, b) => b.netProfit - a.netProfit)[0];
  const worstTrade = [...trades].sort((a, b) => a.netProfit - b.netProfit)[0];
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[520px] overflow-y-auto border-l border-white/[0.08] bg-[#080D18]/96 p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">Day Detail</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{formatLongDate(date)}</h2>
          {sample ? <Pill>Sample</Pill> : null}
        </div>
        <button className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={onClose} type="button">Close</button>
      </div>
      {locked ? (
        <Panel className="mt-4 border-[#3B82F6]/20 bg-[#3B82F6]/10" padding="compact">
          <div className="flex items-center gap-2 text-sm font-bold text-white"><LockKeyhole className="h-4 w-4" /> Upgrade to unlock day-detail analytics.</div>
          <Link className="mt-3 inline-flex rounded-xl bg-[#3B82F6] px-3 py-2 text-xs font-bold text-white" href="/settings/billing">Upgrade</Link>
        </Panel>
      ) : null}
      <div className={locked ? "pointer-events-none mt-4 blur-[2px]" : "mt-4"}>
        <StatGrid className="grid-cols-2">
          <Panel padding="compact"><Stat label="Net P&L" tone={metrics.netPnl >= 0 ? "positive" : "negative"} value={formatCurrency(metrics.netPnl, currency)} /></Panel>
          <Panel padding="compact"><Stat label="Trades" value={formatNumber(metrics.totalTrades)} /></Panel>
          <Panel padding="compact"><Stat label="Win Rate" tone="blue" value={formatPercent(metrics.winRate)} /></Panel>
          <Panel padding="compact"><Stat label="R Sum" value={point ? `${point.rMultipleSum.toFixed(2)}R` : "—"} /></Panel>
          <Panel padding="compact"><Stat label="Best Trade" tone="positive" value={bestTrade ? formatCurrency(bestTrade.netProfit, currency) : "—"} /></Panel>
          <Panel padding="compact"><Stat label="Worst Trade" tone="negative" value={worstTrade ? formatCurrency(worstTrade.netProfit, currency) : "—"} /></Panel>
        </StatGrid>
        <Panel className="mt-4" padding="compact">
          <h3 className="text-sm font-bold text-white">Trades</h3>
          <DataTable className="mt-3">
            <table className="w-full text-left text-xs">
              <thead className="text-[#64748B]"><tr><th className="p-2">Time</th><th className="p-2">Symbol</th><th className="p-2">Side</th><th className="p-2 text-right">P&L</th><th className="p-2" /></tr></thead>
              <tbody>
                {trades.map((trade) => (
                  <tr className="border-t border-white/[0.06]" key={trade.id}>
                    <td className="p-2 text-[#CBD5E1]">{formatTime(trade.closeTime)}</td>
                    <td className="p-2 font-bold text-white">{trade.symbol}</td>
                    <td className="p-2"><Pill tone={trade.side === "BUY" ? "positive" : "critical"}>{trade.side}</Pill></td>
                    <td className={`terminal-number p-2 text-right font-bold ${trade.netProfit >= 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>{formatCurrency(trade.netProfit, currency)}</td>
                    <td className="p-2"><Link className="text-[#93C5FD]" href={`/trades/${trade.id}`}><ArrowRight className="h-4 w-4" /></Link></td>
                  </tr>
                ))}
                {trades.length === 0 ? <tr><td className="p-3 text-[#94A3B8]" colSpan={5}>No trades for this day.</td></tr> : null}
              </tbody>
            </table>
          </DataTable>
        </Panel>
        <Panel className="mt-4" padding="compact">
          <h3 className="text-sm font-bold text-white">Leak Flags</h3>
          <div className="mt-3 space-y-2">
            {leaks.length === 0 ? <p className="text-sm font-semibold text-[#94A3B8]">No leak flags raised this day.</p> : null}
            {leaks.map((flag) => (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3" key={flag.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white">{flag.type.replaceAll("_", " ")}</span>
                  <Pill tone={flag.severity === "critical" ? "critical" : flag.severity === "warning" ? "warning" : "info"}>{flag.severity}</Pill>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#94A3B8]">{flag.tradeIds.length} linked trade(s)</p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="mt-4" padding="compact">
          <h3 className="text-sm font-bold text-white">Intraday Equity Step</h3>
          <EmptyPreview title="Equity snapshots will render here once intraday adapter data is available." lines={["Open equity", "Midday step", "Close equity"]} />
        </Panel>
      </div>
    </div>
  );
}

function MetricPill({ label, tone = "info", value }: { label: string; tone?: "critical" | "info" | "positive"; value: string }) {
  return <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3"><p className="text-[10px] font-bold uppercase text-[#64748B]">{label}</p><p className={`mt-1 truncate text-xs font-bold ${tone === "positive" ? "text-[#86EFAC]" : tone === "critical" ? "text-[#FCA5A5]" : "text-white"}`}>{value}</p></div>;
}

function Segmented<T extends string>({ onChange, value, values }: { onChange: (value: T) => void; value: T; values: T[] }) {
  return <div className="inline-flex rounded-xl bg-white/[0.04] p-1">{values.map((item) => <button className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${value === item ? "bg-[#3B82F6] text-white" : "text-[#94A3B8] hover:text-white"}`} key={item} onClick={() => onChange(item)} type="button">{item}</button>)}</div>;
}

function colorValue(point: DailyPoint | undefined, mode: ColorMode) {
  if (!point) return 0;
  if (mode === "r") return point.rMultipleSum;
  if (mode === "trades") return point.tradeCount;
  return point.netPnl;
}

function formatTileValue(point: DailyPoint, mode: ColorMode) {
  if (mode === "r") return `${point.rMultipleSum.toFixed(2)}R`;
  if (mode === "trades") return `${point.tradeCount} trades`;
  return point.netPnl === 0 ? "$0" : `${point.netPnl > 0 ? "+" : ""}$${Math.round(point.netPnl).toLocaleString("en-US")}`;
}

function heatBg(positive: boolean, intensity: number) {
  const alpha = 0.12 + intensity * 0.54;
  return positive ? `rgba(22, 163, 74, ${alpha})` : `rgba(185, 28, 28, ${alpha})`;
}

function daysForCalendar(anchor: string, view: CalendarView) {
  const date = new Date(anchor);
  if (view === "week") {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const cursor = new Date(start);
      cursor.setDate(start.getDate() + index);
      return toDateKey(cursor);
    });
  }
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const cursor = new Date(start);
    cursor.setDate(start.getDate() + index);
    return toDateKey(cursor);
  });
}

function isInCurrentPeriod(day: string, anchor: string, view: CalendarView) {
  const date = new Date(`${day}T00:00:00`);
  const anchorDate = new Date(anchor);
  if (view === "week") return true;
  return date.getMonth() === anchorDate.getMonth() && date.getFullYear() === anchorDate.getFullYear();
}

function buildMargin(metrics: MetricsResponse) {
  const days = metrics.dailySeries;
  const greenDays = days.filter((day) => day.netPnl > 0).length;
  const bestWeekday = [...metrics.byDayOfWeek].sort((a, b) => b.netPnl - a.netPnl)[0] ?? null;
  const worstWeekday = [...metrics.byDayOfWeek].sort((a, b) => a.netPnl - b.netPnl)[0] ?? null;
  return {
    bestDay: metrics.bestDay,
    bestWeekday,
    greenDayPct: days.length ? greenDays / days.length : 0,
    longestGreenStreak: streak(days, (day) => day.netPnl > 0),
    longestRedStreak: streak(days, (day) => day.netPnl < 0),
    worstDay: metrics.worstDay,
    worstWeekday
  };
}

function streak(days: DailyPoint[], predicate: (day: DailyPoint) => boolean) {
  let best = 0;
  let current = 0;
  for (const day of days) {
    current = predicate(day) ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

function emptyMetrics(granularity: Granularity): MetricsResponse {
  return { ...SAMPLE_DASHBOARD_DATA, avgLoss: 0, avgLossR: null, avgWin: 0, avgWinR: null, bestDay: null, breakevenTrades: 0, byDayOfWeek: SAMPLE_DASHBOARD_DATA.byDayOfWeek.map((day) => ({ ...day, netPnl: 0, trades: 0, winRate: 0 })), bySession: [], bySymbol: [], dailySeries: [], drawdown: { abs: 0, pct: 0 }, expectancyCurrency: 0, expectancyR: null, grossLoss: 0, grossWin: 0, largestLoss: 0, largestWin: 0, losingTrades: 0, netPnl: 0, period: { granularity, label: "" }, profitFactor: null, profitFactorReason: "no_trades", rMultipleHistogram: [], totalTrades: 0, totalVolume: 0, winRate: 0, winningTrades: 0, worstDay: null };
}

function extendSampleForCalendar(base: MetricsResponse, anchor: string, granularity: Granularity): MetricsResponse {
  if (granularity !== "month" && granularity !== "year") return base;
  const date = new Date(anchor);
  const year = date.getFullYear();
  const month = date.getMonth();
  const length = granularity === "year" ? 365 : new Date(year, month + 1, 0).getDate();
  let cumulative = 0;
  const dailySeries = Array.from({ length }, (_, index) => {
    const cursor = granularity === "year" ? new Date(year, 0, index + 1) : new Date(year, month, index + 1);
    const wave = Math.sin(index * 1.7) * 740 + Math.cos(index * 0.7) * 280;
    const tradeCount = Math.max(0, Math.round(4 + Math.abs(Math.sin(index)) * 8));
    const netPnl = tradeCount ? Math.round(wave / 10) * 10 : 0;
    const winningTrades = netPnl >= 0 ? Math.ceil(tradeCount * 0.62) : Math.floor(tradeCount * 0.42);
    const losingTrades = Math.max(0, tradeCount - winningTrades - (tradeCount > 4 ? 1 : 0));
    const breakevenTrades = Math.max(0, tradeCount - winningTrades - losingTrades);
    cumulative += netPnl;
    return { breakevenTrades, cumulativePnl: cumulative, date: toDateKey(cursor), losingTrades, netPnl, rMultipleSum: Math.round((netPnl / 260) * 100) / 100, tradeCount, winRate: tradeCount ? winningTrades / tradeCount : 0, winningTrades };
  });
  return { ...base, dailySeries, bestDay: [...dailySeries].sort((a, b) => b.netPnl - a.netPnl)[0] ?? null, worstDay: [...dailySeries].sort((a, b) => a.netPnl - b.netPnl)[0] ?? null };
}

function sampleDayMetrics(metrics: MetricsResponse, date: string): MetricsResponse {
  const point = metrics.dailySeries.find((day) => day.date === date);
  if (!point) return emptyMetrics("day");
  return { ...metrics, dailySeries: [point], netPnl: point.netPnl, totalTrades: point.tradeCount, winRate: point.winRate ?? 0, winningTrades: point.winningTrades, losingTrades: point.losingTrades, breakevenTrades: point.breakevenTrades, expectancyR: point.tradeCount ? point.rMultipleSum / point.tradeCount : null, period: { granularity: "day", label: date } };
}

function sampleCalendarTrades(date: string): TradeRow[] {
  const count = Number(date.slice(-2)) % 5;
  return Array.from({ length: count }, (_, index) => {
    const side: TradeRow["side"] = index % 2 === 0 ? "BUY" : "SELL";
    return {
      closeTime: `${date}T${String(10 + index).padStart(2, "0")}:30:00.000Z`,
      commission: -4,
      grossProfit: index % 2 === 0 ? 214 : -126,
      id: `sample-${date}-${index}`,
      netProfit: index % 2 === 0 ? 210 : -130,
      openTime: `${date}T${String(9 + index).padStart(2, "0")}:45:00.000Z`,
      side,
      swap: 0,
      symbol: index % 2 === 0 ? "XAUUSD" : "EURUSD",
      volume: index % 2 === 0 ? 1.2 : 0.8
    };
  });
}

function sampleLeaks(date: string): LeakFlagResponse[] {
  return Number(date.slice(-2)) % 4 === 0 ? [{ evidence: {}, id: `sample-leak-${date}`, severity: "warning", status: "active", tradeIds: [`sample-${date}-0`], type: "overtrading" }] : [];
}

function formatLongDate(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dateKey}T00:00:00`));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}
