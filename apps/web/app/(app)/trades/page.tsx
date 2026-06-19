"use client";

import {
  ArrowDownUp,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  EyeOff,
  Filter,
  GripVertical,
  LayoutGrid,
  ListChecks,
  NotebookPen,
  Search,
  Settings2,
  Tag,
  X
} from "lucide-react";
import { ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  bulkAddTradeEmotion,
  bulkSetTradePlaybook,
  fetchPlaybooks,
  fetchTrades,
  savePreferences,
  searchTradeScribe,
  type Granularity,
  type MetricsResponse,
  type Playbook,
  type SearchResponse,
  type TradeExplorerPrefs,
  type TradeSide,
  type TradesListResponse,
  useCurrentUser
} from "../_lib/dashboard-data";
import { SAMPLE_DASHBOARD_DATA, SAMPLE_PLAYBOOKS, SAMPLE_RECENT_TRADES } from "../_lib/dashboard-sample";
import { formatCurrency, formatNumber, formatPercent, formatProfitFactor } from "../_lib/format";
import { AccountSwitcher } from "../_components/account-switcher";
import { DataTable, Panel, Pill, Stat, StatGrid } from "../_components/ui";
import { PlaybookSelect } from "../playbooks/_components/playbook-select";

const emotionOptions = ["Confident", "Fearful", "Impulsive", "Disciplined", "FOMO", "Bored", "Revenge"];
const periods: Array<"all" | Granularity | "custom"> = ["all", "day", "week", "month", "year", "custom"];
const rowHeight = 42;
const defaultExplorerPrefs: TradeExplorerPrefs = {
  columnOrder: ["select", "closeTime", "symbol", "side", "volume", "openPrice", "closePrice", "netProfit", "rMultiple", "duration", "session", "playbook", "emotions", "leaks", "notes", "actions"],
  hiddenColumns: [],
  viewMode: "table"
};

type TradeRow = TradesListResponse["data"][number];
type ExplorerFilters = {
  dayOfWeek: string;
  durationMax: string;
  durationMin: string;
  emotionTag: string;
  from: string;
  hasNote: string;
  hasScreenshot: string;
  leakType: string;
  order: "asc" | "desc";
  page: number;
  period: "all" | Granularity | "custom";
  playbookId: string;
  pnlSign: string;
  q: string;
  rMax: string;
  rMin: string;
  session: string;
  side: TradeSide | "";
  sort: string;
  sortSpec: string;
  symbol: string;
  to: string;
  volumeMax: string;
  volumeMin: string;
};

export default function TradesPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <TradesContent />
    </Suspense>
  );
}

function TradesContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const accounts = user.data?.accounts ?? [];
  const primaryAccount = accounts.find((item) => item.isPrimary) ?? accounts[0] ?? null;
  const preferredAccountId = user.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(preferredAccountId);
  const [payload, setPayload] = useState<TradesListResponse | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [prefs, setPrefs] = useState<TradeExplorerPrefs>(defaultExplorerPrefs);
  const account = accounts.find((item) => item.id === selectedAccountId) ?? primaryAccount;
  const accountId = account?.id ?? null;
  const sampleMode = !account;
  const currency = account?.currency ?? "USD";
  const filters = useMemo(() => parseFilters(searchParams), [searchParams]);

  useEffect(() => {
    setSelectedAccountId(user.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
    if (user.data?.preferences.tradeExplorerPrefs) {
      setPrefs(normalizePrefs(user.data.preferences.tradeExplorerPrefs));
    }
  }, [primaryAccount?.id, user.data?.preferences.activeAccountId, user.data?.preferences.tradeExplorerPrefs]);

  useEffect(() => {
    if (!accountId) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = buildTradesQuery(filters);
    setLoading(true);
    fetchTrades(accountId, query, controller.signal)
      .then((next) => {
        setPayload(next);
        setSelectedIds(new Set());
      })
      .catch(() => setPayload(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accountId, filters]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlaybooks(controller.signal)
      .then(setPlaybooks)
      .catch(() => setPlaybooks([]));
    return () => controller.abort();
  }, []);

  const rows = useMemo(() => (sampleMode ? sampleTrades() : payload?.data ?? []), [payload?.data, sampleMode]);
  const metrics = sampleMode ? SAMPLE_DASHBOARD_DATA : payload?.metrics ?? emptyMetrics(currency);
  const availablePlaybooks = sampleMode ? SAMPLE_PLAYBOOKS : playbooks;
  const visibleColumns = useMemo(() => columnsFor(prefs), [prefs]);
  const totalPages = sampleMode ? 1 : payload?.totalPages ?? 1;
  const activeChips = activeFilterChips(filters, availablePlaybooks);

  function writeQuery(values: Record<string, string | number | null>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in values)) next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  function updatePrefs(next: TradeExplorerPrefs) {
    setPrefs(next);
    void savePreferences({ tradeExplorerPrefs: next }).catch(() => undefined);
  }

  function toggleSelected(tradeId: string, index: number, shift: boolean) {
    const next = new Set(selectedIds);
    if (shift && lastSelectedIndex !== null) {
      const bounds = [lastSelectedIndex, index].sort((a, b) => a - b) as [number, number];
      const [start, end] = bounds;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const id = rows[cursor]?.id;
        if (id) next.add(id);
      }
    } else if (next.has(tradeId)) {
      next.delete(tradeId);
    } else {
      next.add(tradeId);
    }
    setLastSelectedIndex(index);
    setSelectedIds(next);
  }

  async function bulkPlaybook(playbookId: string | null) {
    if (selectedIds.size === 0 || sampleMode) return;
    if (!window.confirm(`Tag ${selectedIds.size} selected trades?`)) return;
    await bulkSetTradePlaybook([...selectedIds], playbookId);
    setPayload(null);
    writeQuery({ page: filters.page });
  }

  async function bulkEmotion(emotionTag: string) {
    if (selectedIds.size === 0 || sampleMode || !emotionTag) return;
    if (!window.confirm(`Add "${emotionTag}" to ${selectedIds.size} selected trades?`)) return;
    await bulkAddTradeEmotion([...selectedIds], emotionTag);
    setPayload(null);
    writeQuery({ page: filters.page });
  }

  function exportCsv(selectedOnly = false) {
    const source = selectedOnly ? rows.filter((row) => selectedIds.has(row.id)) : rows;
    const header = ["closeTime", "symbol", "side", "volume", "openPrice", "closePrice", "netProfit", "rMultiple", "durationSec", "session", "playbook", "emotionTags", "leakFlags", "hasNote", "hasScreenshot"];
    const csv = [
      header,
      ...source.map((row) => [
        row.closeTime,
        row.symbol,
        row.side,
        String(row.volume),
        String(row.openPrice ?? ""),
        String(row.closePrice ?? ""),
        String(row.netProfit),
        row.rMultiple == null ? "" : String(row.rMultiple),
        row.durationSec == null ? "" : String(row.durationSec),
        row.session ?? "",
        row.playbook?.name ?? "",
        (row.emotionTags ?? []).join("|"),
        (row.leakFlags ?? []).map((flag) => `${flag.severity}:${flag.type}`).join("|"),
        String(Boolean(row.hasNote)),
        String(Boolean(row.hasScreenshot))
      ])
    ]
      .map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `tradescribe-trades-${selectedOnly ? "selected" : "filtered"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[1720px]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[--text-low]">Trade Explorer</p>
            <h1 className="mt-2 text-[28px] font-semibold tracking-normal text-white">Advanced Trade Audit</h1>
            <p className="mt-2 text-sm font-medium text-[#94A3B8]">Filter thousands of trades and audit the exact subset that is helping or hurting performance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sampleMode ? <Pill>Sample mode</Pill> : null}
            <AccountSwitcher accounts={accounts} activeAccountId={selectedAccountId} canUseAllAccounts={user.data?.user.role === "ADMIN" || user.data?.user.plan === "PRO"} onAccountChange={setSelectedAccountId} plan={user.data?.user.plan ?? "FREE"} />
            <Link className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" href="/calendar">
              <CalendarDays className="h-4 w-4" aria-hidden />
              Calendar
            </Link>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => exportCsv(false)} type="button">
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </button>
            <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-sm font-bold text-[#64748B]" disabled title="PDF trade log coming soon" type="button">
              PDF coming soon
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={railOpen ? "block" : "hidden xl:block"}>
            <FilterRail accountId={accountId} filters={filters} onClear={() => router.replace(pathname, { scroll: false })} onWrite={writeQuery} playbooks={availablePlaybooks} />
          </aside>

          <main className="min-w-0 space-y-4">
            <Panel padding="compact">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => setRailOpen((value) => !value)} type="button">
                  <Filter className="h-4 w-4" aria-hidden />
                  Filters
                </button>
                <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => setSelectedIds(new Set(rows.map((row) => row.id)))} type="button">
                  Select all filtered
                </button>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {activeChips.length === 0 ? <span className="text-xs font-semibold text-[--text-low]">No active filters</span> : null}
                  {activeChips.map((chip) => (
                    <button className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.08]" key={chip.key} onClick={() => writeQuery({ [chip.key]: null })} type="button">
                      {chip.label}
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  ))}
                </div>
                <ViewMode value={prefs.viewMode} onChange={(viewMode) => updatePrefs({ ...prefs, viewMode })} />
                <div className="relative">
                  <button className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => setColumnsOpen((value) => !value)} type="button">
                    <Settings2 className="h-4 w-4" aria-hidden />
                    Columns
                  </button>
                  {columnsOpen ? <ColumnMenu prefs={prefs} onChange={updatePrefs} /> : null}
                </div>
              </div>
            </Panel>

            <AggregateStrip currency={currency} metrics={metrics} />

            {selectedIds.size > 0 ? (
              <BulkBar count={selectedIds.size} disabled={sampleMode} onClear={() => setSelectedIds(new Set())} onEmotion={bulkEmotion} onExportSelected={() => exportCsv(true)} onPlaybook={bulkPlaybook} playbooks={availablePlaybooks} />
            ) : null}

            {prefs.viewMode === "cards" ? (
              <TradeCardGrid currency={currency} rows={rows} sampleMode={sampleMode} />
            ) : (
              <VirtualTradeTable
                columns={visibleColumns}
                currency={currency}
                filters={filters}
                loading={loading}
                onSelect={toggleSelected}
                onSort={(sortSpec) => writeQuery({ sortSpec })}
                playbooks={availablePlaybooks}
                rows={rows}
                sampleMode={sampleMode}
                selectedIds={selectedIds}
              />
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-[#64748B]">{sampleMode ? "Sample trades" : `${formatNumber(payload?.total ?? 0)} trades in filtered set`}</p>
              <div className="flex items-center gap-2">
                <button className="h-9 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-[#CBD5E1] disabled:opacity-40" disabled={filters.page <= 1} onClick={() => writeQuery({ page: Math.max(1, filters.page - 1) })} type="button">
                  Previous
                </button>
                <span className="text-xs font-bold text-[#94A3B8]">Page {filters.page} of {totalPages}</span>
                <button className="h-9 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-[#CBD5E1] disabled:opacity-40" disabled={filters.page >= totalPages} onClick={() => writeQuery({ page: filters.page + 1 })} type="button">
                  Next
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function AggregateStrip({ currency, metrics }: { currency: string; metrics: MetricsResponse }) {
  return (
    <StatGrid className="grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
      <Panel padding="compact"><Stat label="Trades" value={formatNumber(metrics.totalTrades)} /></Panel>
      <Panel padding="compact"><Stat label="Net P&L" tone={metrics.netPnl >= 0 ? "positive" : "negative"} value={formatCurrency(metrics.netPnl, currency)} /></Panel>
      <Panel padding="compact"><Stat label="Win Rate" tone="blue" value={formatPercent(metrics.winRate)} /></Panel>
      <Panel padding="compact"><Stat label="Profit Factor" value={formatProfitFactor(metrics.profitFactor, metrics.profitFactorReason)} /></Panel>
      <Panel padding="compact"><Stat label="Expectancy R" value={metrics.expectancyR == null ? "—" : `${metrics.expectancyR.toFixed(2)}R`} /></Panel>
      <Panel padding="compact"><Stat label="Avg R W/L" value={`${metrics.avgWinR == null ? "—" : metrics.avgWinR.toFixed(2)} / ${metrics.avgLossR == null ? "—" : metrics.avgLossR.toFixed(2)}`} /></Panel>
      <Panel padding="compact"><Stat label="Largest W/L" value={`${formatCurrency(metrics.largestWin, currency)} / ${formatCurrency(metrics.largestLoss, currency)}`} /></Panel>
      <Panel padding="compact"><Stat label="Volume" value={formatNumber(metrics.totalVolume)} /></Panel>
    </StatGrid>
  );
}

function FilterRail({
  accountId,
  filters,
  onClear,
  onWrite,
  playbooks
}: {
  accountId: string | null;
  filters: ExplorerFilters;
  onClear: () => void;
  onWrite: (values: Record<string, string | number | null>) => void;
  playbooks: Playbook[];
}) {
  const [results, setResults] = useState<SearchResponse | null>(null);

  useEffect(() => {
    if (filters.q.trim().length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      searchTradeScribe({ accountId, q: filters.q }, controller.signal)
        .then(setResults)
        .catch(() => setResults(null));
    }, 250);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [accountId, filters.q]);

  return (
    <Panel className="sticky top-4" padding="compact">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-white">Filter Rail</h2>
        <button className="text-xs font-bold text-[#93C5FD] hover:text-white" onClick={onClear} type="button">Reset</button>
      </div>
      <div className="mt-4 space-y-3">
        <Field label="Search">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#64748B]" aria-hidden />
            <input className="control pl-9" onChange={(event) => onWrite({ q: event.target.value })} placeholder="Symbol, note, tag" value={filters.q} />
            {results ? <SearchSuggestions results={results} /> : null}
          </div>
        </Field>
        <Field label="Date Range">
          <div className="grid grid-cols-2 gap-2">
            <input className="control" onChange={(event) => onWrite({ from: event.target.value })} type="date" value={filters.from} />
            <input className="control" onChange={(event) => onWrite({ to: event.target.value })} type="date" value={filters.to} />
          </div>
        </Field>
        <SelectField label="Period" value={filters.period} onChange={(value) => onWrite({ period: value })} options={periods.map((period) => [period, period === "all" ? "All time" : period])} />
        <Field label="Symbol">
          <input className="control" onChange={(event) => onWrite({ symbol: event.target.value.toUpperCase() })} placeholder="EURUSD,XAUUSD" value={filters.symbol} />
        </Field>
        <SelectField label="Side" value={filters.side} onChange={(value) => onWrite({ side: value })} options={[["", "Any"], ["BUY", "Buy"], ["SELL", "Sell"]]} />
        <SelectField label="Session" value={filters.session} onChange={(value) => onWrite({ session: value })} options={[["", "Any"], ["Sydney", "Sydney"], ["Tokyo", "Tokyo"], ["London", "London"], ["New York", "New York"]]} />
        <SelectField label="Day of Week" value={filters.dayOfWeek} onChange={(value) => onWrite({ dayOfWeek: value })} options={[["", "Any"], ["Mon", "Monday"], ["Tue", "Tuesday"], ["Wed", "Wednesday"], ["Thu", "Thursday"], ["Fri", "Friday"], ["Sat", "Saturday"], ["Sun", "Sunday"]]} />
        <SelectField label="P&L Sign" value={filters.pnlSign} onChange={(value) => onWrite({ pnlSign: value })} options={[["", "Any"], ["win", "Winning"], ["loss", "Losing"], ["breakeven", "Breakeven"]]} />
        <RangeFields label="R Multiple" max={filters.rMax} min={filters.rMin} onMax={(value) => onWrite({ rMax: value })} onMin={(value) => onWrite({ rMin: value })} step="0.1" />
        <RangeFields label="Duration (sec)" max={filters.durationMax} min={filters.durationMin} onMax={(value) => onWrite({ durationMax: value })} onMin={(value) => onWrite({ durationMin: value })} step="60" />
        <RangeFields label="Volume" max={filters.volumeMax} min={filters.volumeMin} onMax={(value) => onWrite({ volumeMax: value })} onMin={(value) => onWrite({ volumeMin: value })} step="0.01" />
        <MultiSelectField label="Playbook" value={filters.playbookId} onChange={(value) => onWrite({ playbookId: value })} options={[["untagged", "Untagged"], ...playbooks.map((playbook) => [playbook.id, playbook.name] as [string, string])]} />
        <MultiSelectField label="Emotion" value={filters.emotionTag} onChange={(value) => onWrite({ emotionTag: value })} options={emotionOptions.map((emotion) => [emotion, emotion] as [string, string])} />
        <MultiSelectField label="Leak Type" value={filters.leakType} onChange={(value) => onWrite({ leakType: value })} options={[["revenge_trade", "Revenge"], ["overtrading", "Overtrading"], ["missing_stop_loss", "Missing stop"], ["risk_inconsistency", "Risk inconsistency"], ["asymmetric_win_loss", "Asymmetric W/L"]]} />
        <SelectField label="Screenshots" value={filters.hasScreenshot} onChange={(value) => onWrite({ hasScreenshot: value })} options={[["", "Any"], ["true", "Has screenshot"]]} />
        <SelectField label="Notes" value={filters.hasNote} onChange={(value) => onWrite({ hasNote: value })} options={[["", "Any"], ["true", "Has note"]]} />
      </div>
    </Panel>
  );
}

function VirtualTradeTable({
  columns,
  currency,
  filters,
  loading,
  onSelect,
  onSort,
  playbooks,
  rows,
  sampleMode,
  selectedIds
}: {
  columns: ColumnDef[];
  currency: string;
  filters: ExplorerFilters;
  loading: boolean;
  onSelect: (tradeId: string, index: number, shift: boolean) => void;
  onSort: (sortSpec: string) => void;
  playbooks: Playbook[];
  rows: TradeRow[];
  sampleMode: boolean;
  selectedIds: Set<string>;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const height = 560;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 6);
  const visibleCount = Math.ceil(height / rowHeight) + 12;
  const visibleRows = rows.slice(start, start + visibleCount);
  const grid = gridTemplate(columns);

  return (
    <DataTable className="bg-[#0B1120]/72">
      <div className="min-w-[1320px]">
        <div className="sticky top-0 z-10 grid border-b border-white/[0.06] bg-[#101827] px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748B]" style={{ gridTemplateColumns: grid }}>
          {columns.map((column) => (
            <button className="flex items-center gap-1 text-left hover:text-[#CBD5E1]" key={column.id} onClick={() => column.sortKey && onSort(nextSortSpec(filters.sortSpec, column.sortKey))} type="button">
              {column.label}
              {column.sortKey ? <ArrowDownUp className="h-3 w-3" aria-hidden /> : null}
            </button>
          ))}
        </div>
        <div ref={viewportRef} className="relative overflow-y-auto" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)} style={{ height }}>
          {loading ? <div className="p-4 text-sm font-semibold text-[#94A3B8]">Loading trades...</div> : null}
          {!loading && rows.length === 0 ? <div className="p-4 text-sm font-semibold text-[#94A3B8]">No trades match this filter stack.</div> : null}
          <div style={{ height: rows.length * rowHeight }}>
            <div style={{ transform: `translateY(${start * rowHeight}px)` }}>
              {visibleRows.map((trade, offset) => (
                <ExplorerRow columns={columns} currency={currency} grid={grid} index={start + offset} key={trade.id} onSelect={onSelect} playbooks={playbooks} sampleMode={sampleMode} selected={selectedIds.has(trade.id)} trade={trade} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </DataTable>
  );
}

function ExplorerRow({ columns, currency, grid, index, onSelect, playbooks, sampleMode, selected, trade }: { columns: ColumnDef[]; currency: string; grid: string; index: number; onSelect: (tradeId: string, index: number, shift: boolean) => void; playbooks: Playbook[]; sampleMode: boolean; selected: boolean; trade: TradeRow }) {
  const href = `/trades/${trade.id}`;
  return (
    <div className="group grid h-[42px] items-center gap-2 border-b border-white/[0.04] px-3 text-xs font-semibold text-[#CBD5E1] transition hover:-translate-y-px hover:bg-white/[0.035] hover:shadow-lg" style={{ gridTemplateColumns: grid }}>
      {columns.map((column) => (
        <Cell column={column} currency={currency} href={href} index={index} key={column.id} onSelect={onSelect} playbooks={playbooks} sampleMode={sampleMode} selected={selected} trade={trade} />
      ))}
    </div>
  );
}

function Cell({ column, currency, href, index, onSelect, playbooks, sampleMode, selected, trade }: { column: ColumnDef; currency: string; href: string; index: number; onSelect: (tradeId: string, index: number, shift: boolean) => void; playbooks: Playbook[]; sampleMode: boolean; selected: boolean; trade: TradeRow }) {
  switch (column.id) {
    case "select":
      return <input aria-label={`Select ${trade.symbol}`} checked={selected} className="h-4 w-4 accent-[#3B82F6]" onChange={(event) => onSelect(trade.id, index, event.nativeEvent instanceof MouseEvent ? event.nativeEvent.shiftKey : false)} type="checkbox" />;
    case "closeTime":
      return <Link className="tabular-nums text-white hover:text-[#93C5FD]" href={href}>{formatShort(trade.closeTime)}</Link>;
    case "symbol":
      return <Link className="font-bold text-white hover:text-[#93C5FD]" href={href}>{trade.symbol}</Link>;
    case "side":
      return <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${trade.side === "BUY" ? "bg-[#22C55E]/12 text-[#86EFAC]" : "bg-[#EF4444]/12 text-[#FCA5A5]"}`}>{trade.side}</span>;
    case "volume":
      return <span className="terminal-number">{trade.volume}</span>;
    case "openPrice":
      return <span className="terminal-number">{formatPrice(trade.openPrice)}</span>;
    case "closePrice":
      return <span className="terminal-number">{formatPrice(trade.closePrice)}</span>;
    case "netProfit":
      return <span className={`terminal-number font-bold ${trade.netProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"}`}>{formatCurrency(trade.netProfit, currency)}</span>;
    case "rMultiple":
      return <span className={`terminal-number ${trade.rMultiple == null ? "text-[#64748B]" : trade.rMultiple >= 0 ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>{trade.rMultiple == null ? "—" : `${trade.rMultiple.toFixed(2)}R`}</span>;
    case "duration":
      return <span className="terminal-number">{formatDuration(trade.durationSec)}</span>;
    case "session":
      return <span>{trade.session ?? "—"}</span>;
    case "playbook":
      return <PlaybookSelect disabled={sampleMode} onChange={() => undefined} playbooks={playbooks} tradeId={trade.id} value={trade.playbook ?? null} />;
    case "emotions":
      return <span className="truncate">{(trade.emotionTags ?? []).slice(0, 2).join(", ") || "—"}</span>;
    case "leaks":
      return <span className="flex items-center gap-1">{(trade.leakFlags ?? []).slice(0, 4).map((flag) => <span className={`h-2 w-2 rounded-full ${flag.severity === "critical" ? "bg-[#EF4444]" : flag.severity === "warning" ? "bg-[#F59E0B]" : "bg-[#3B82F6]"}`} key={flag.id} title={`${flag.severity}: ${flag.type}`} />)}</span>;
    case "notes":
      return <span className="flex items-center gap-2">{trade.hasNote ? <NotebookPen className="h-4 w-4 text-[#93C5FD]" aria-hidden /> : "—"}{trade.hasScreenshot ? <span className="text-[#94A3B8]">img</span> : null}</span>;
    case "actions":
      return <span className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100"><Link className="rounded-lg bg-[#3B82F6] px-2 py-1 text-[11px] font-bold text-white" href={href}>Open</Link><Link className="rounded-lg border border-white/[0.08] px-2 py-1 text-[11px] font-bold text-[#CBD5E1]" href={`${href}#notes`}>Note</Link></span>;
    default:
      return null;
  }
}

function TradeCardGrid({ currency, rows, sampleMode }: { currency: string; rows: TradeRow[]; sampleMode: boolean }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((trade) => (
        <Link className="terminal-panel terminal-panel-interactive rounded-2xl p-4" href={`/trades/${trade.id}`} key={trade.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-white">{trade.symbol}</p>
              <p className="mt-1 text-xs font-semibold text-[#64748B]">{formatShort(trade.closeTime)} · {trade.session ?? "—"}</p>
            </div>
            <span className={`${trade.netProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} terminal-number font-bold`}>{formatCurrency(trade.netProfit, currency)}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <Pill tone={trade.side === "BUY" ? "positive" : "critical"}>{trade.side}</Pill>
            <Pill tone="neutral">{trade.rMultiple == null ? "No R" : `${trade.rMultiple.toFixed(2)}R`}</Pill>
            {sampleMode ? <Pill>Sample</Pill> : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

function BulkBar({ count, disabled, onClear, onEmotion, onExportSelected, onPlaybook, playbooks }: { count: number; disabled: boolean; onClear: () => void; onEmotion: (emotion: string) => void; onExportSelected: () => void; onPlaybook: (playbookId: string | null) => void; playbooks: Playbook[] }) {
  return (
    <Panel className="border-[#3B82F6]/25 bg-[#13213A]/80" padding="compact">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-white">{count} selected</span>
        <select className="control h-9 w-48" disabled={disabled} onChange={(event) => onPlaybook(event.target.value === "__clear" ? null : event.target.value || null)} defaultValue="">
          <option value="">Bulk tag playbook</option>
          <option value="__clear">Untag</option>
          {playbooks.map((playbook) => <option key={playbook.id} value={playbook.id}>{playbook.name}</option>)}
        </select>
        <select className="control h-9 w-44" disabled={disabled} onChange={(event) => event.target.value && onEmotion(event.target.value)} defaultValue="">
          <option value="">Add emotion</option>
          {emotionOptions.map((emotion) => <option key={emotion} value={emotion}>{emotion}</option>)}
        </select>
        <button className="h-9 rounded-xl border border-white/[0.08] px-3 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={onExportSelected} type="button">Export selected</button>
        <button className="ml-auto h-9 rounded-xl px-3 text-xs font-bold text-[#94A3B8] hover:bg-white/[0.05]" onClick={onClear} type="button">Clear</button>
      </div>
    </Panel>
  );
}

function ViewMode({ onChange, value }: { onChange: (value: "table" | "cards") => void; value: "table" | "cards" }) {
  return (
    <div className="grid grid-cols-2 rounded-xl bg-white/[0.04] p-1">
      <button className={`grid h-8 w-8 place-items-center rounded-lg ${value === "table" ? "bg-[#3B82F6] text-white" : "text-[#94A3B8]"}`} onClick={() => onChange("table")} type="button" aria-label="Table view"><ListChecks className="h-4 w-4" /></button>
      <button className={`grid h-8 w-8 place-items-center rounded-lg ${value === "cards" ? "bg-[#3B82F6] text-white" : "text-[#94A3B8]"}`} onClick={() => onChange("cards")} type="button" aria-label="Card view"><LayoutGrid className="h-4 w-4" /></button>
    </div>
  );
}

function ColumnMenu({ onChange, prefs }: { onChange: (value: TradeExplorerPrefs) => void; prefs: TradeExplorerPrefs }) {
  const columns = prefs.columnOrder.map((id) => baseColumns.find((column) => column.id === id)).filter((item): item is ColumnDef => Boolean(item));
  function move(id: string, direction: -1 | 1) {
    const next = [...prefs.columnOrder];
    const index = next.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChange({ ...prefs, columnOrder: next });
  }
  return (
    <div className="absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-white/[0.08] bg-[#0B1120]/95 p-3 shadow-2xl">
      <p className="text-xs font-bold uppercase text-[#64748B]">Columns</p>
      <div className="mt-2 max-h-96 space-y-1 overflow-y-auto">
        {columns.map((column) => {
          const hidden = prefs.hiddenColumns.includes(column.id);
          return (
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-xl px-2 py-1 text-sm font-semibold text-[#CBD5E1] hover:bg-white/[0.04]" key={column.id}>
              <button className="flex items-center gap-2 text-left" onClick={() => onChange({ ...prefs, hiddenColumns: hidden ? prefs.hiddenColumns.filter((id) => id !== column.id) : [...prefs.hiddenColumns, column.id] })} type="button">
                {hidden ? <EyeOff className="h-4 w-4 text-[#64748B]" /> : <Check className="h-4 w-4 text-[#3B82F6]" />}
                {column.label}
              </button>
              <button onClick={() => move(column.id, -1)} type="button"><GripVertical className="h-4 w-4 text-[#64748B]" /></button>
              <button className="text-xs text-[#94A3B8]" onClick={() => move(column.id, 1)} type="button"><ChevronDown className="h-4 w-4" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return <label className="block"><span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[#64748B]">{label}</span>{children}</label>;
}

function SelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  return <Field label={label}><select className="control" onChange={(event) => onChange(event.target.value)} value={value}>{options.map(([id, name]) => <option key={id || name} value={id}>{name}</option>)}</select></Field>;
}

function MultiSelectField({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<[string, string]>; value: string }) {
  const selected = value.split(",").map((item) => item.trim()).filter(Boolean);
  const selectedSet = new Set(selected);
  function add(next: string) {
    if (!next || selectedSet.has(next)) return;
    onChange([...selected, next].join(","));
  }
  function remove(item: string) {
    onChange(selected.filter((valueItem) => valueItem !== item).join(","));
  }
  return (
    <Field label={label}>
      <select className="control" onChange={(event) => add(event.target.value)} value="">
        <option value="">Any</option>
        {options.map(([id, name]) => (
          <option disabled={selectedSet.has(id)} key={id} value={id}>
            {name}
          </option>
        ))}
      </select>
      {selected.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((item) => {
            const labelText = options.find(([id]) => id === item)?.[1] ?? item;
            return (
              <button className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-bold text-[#CBD5E1]" key={item} onClick={() => remove(item)} type="button">
                {labelText}
                <X className="h-3 w-3" aria-hidden />
              </button>
            );
          })}
        </div>
      ) : null}
    </Field>
  );
}

function SearchSuggestions({ results }: { results: SearchResponse }) {
  const count = results.trades.length + results.notes.length + results.playbooks.length;
  if (count === 0) return null;
  return (
    <div className="absolute left-0 right-0 z-30 mt-2 rounded-xl border border-white/[0.08] bg-[#0B1120]/95 p-2 shadow-2xl">
      {results.trades.slice(0, 3).map((trade) => (
        <Link className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:bg-white/[0.05]" href={trade.href} key={`trade-${trade.id}`}>
          Trade · {trade.symbol} · {formatShort(trade.closeTime)}
        </Link>
      ))}
      {results.notes.slice(0, 3).map((note) => (
        <Link className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:bg-white/[0.05]" href={note.href} key={`note-${note.id}`}>
          Note · {note.trade.symbol}
        </Link>
      ))}
      {results.playbooks.slice(0, 3).map((playbook) => (
        <Link className="block rounded-lg px-2 py-1.5 text-xs font-semibold text-[#CBD5E1] hover:bg-white/[0.05]" href={playbook.href} key={`playbook-${playbook.id}`}>
          Playbook · {playbook.name}
        </Link>
      ))}
    </div>
  );
}

function RangeFields({ label, max, min, onMax, onMin, step }: { label: string; max: string; min: string; onMax: (value: string) => void; onMin: (value: string) => void; step: string }) {
  return <Field label={label}><div className="grid grid-cols-2 gap-2"><input className="control" min={-100} onChange={(event) => onMin(event.target.value)} placeholder="Min" step={step} type="number" value={min} /><input className="control" onChange={(event) => onMax(event.target.value)} placeholder="Max" step={step} type="number" value={max} /></div></Field>;
}

type ColumnDef = { id: string; label: string; sortKey?: string; width: string };
const baseColumns: ColumnDef[] = [
  { id: "select", label: "", width: "32px" },
  { id: "closeTime", label: "Date/Time", sortKey: "closeTime", width: "136px" },
  { id: "symbol", label: "Symbol", sortKey: "symbol", width: "92px" },
  { id: "side", label: "Side", width: "72px" },
  { id: "volume", label: "Vol", sortKey: "volume", width: "62px" },
  { id: "openPrice", label: "Entry", sortKey: "openPrice", width: "86px" },
  { id: "closePrice", label: "Exit", sortKey: "closePrice", width: "86px" },
  { id: "netProfit", label: "P&L", sortKey: "netProfit", width: "104px" },
  { id: "rMultiple", label: "R", sortKey: "rMultiple", width: "70px" },
  { id: "duration", label: "Hold", sortKey: "durationSec", width: "78px" },
  { id: "session", label: "Session", width: "92px" },
  { id: "playbook", label: "Playbook", width: "174px" },
  { id: "emotions", label: "Emotions", width: "116px" },
  { id: "leaks", label: "Leaks", width: "72px" },
  { id: "notes", label: "Notes", width: "72px" },
  { id: "actions", label: "", width: "118px" }
];

function columnsFor(prefs: TradeExplorerPrefs) {
  const hidden = new Set(prefs.hiddenColumns);
  return prefs.columnOrder
    .map((id) => baseColumns.find((column) => column.id === id))
    .filter((item): item is ColumnDef => Boolean(item))
    .filter((item) => !hidden.has(item.id));
}

function normalizePrefs(input: TradeExplorerPrefs): TradeExplorerPrefs {
  const ids = new Set(baseColumns.map((column) => column.id));
  const order = [...input.columnOrder.filter((id) => ids.has(id)), ...baseColumns.map((column) => column.id).filter((id) => !input.columnOrder.includes(id))];
  return { columnOrder: order, hiddenColumns: input.hiddenColumns.filter((id) => ids.has(id)), viewMode: input.viewMode === "cards" ? "cards" : "table" };
}

function gridTemplate(columns: ColumnDef[]) {
  return columns.map((column) => column.width).join(" ");
}

function parseFilters(params: URLSearchParams): ExplorerFilters {
  return {
    dayOfWeek: params.get("dayOfWeek") ?? "",
    durationMax: params.get("durationMax") ?? "",
    durationMin: params.get("durationMin") ?? "",
    emotionTag: params.get("emotionTag") ?? "",
    from: params.get("from") ?? "",
    hasNote: params.get("hasNote") ?? "",
    hasScreenshot: params.get("hasScreenshot") ?? "",
    leakType: params.get("leakType") ?? "",
    order: (params.get("order") ?? "desc") as "asc" | "desc",
    page: Number(params.get("page") ?? "1"),
    period: (params.get("period") ?? "all") as ExplorerFilters["period"],
    playbookId: params.get("playbookId") ?? "",
    pnlSign: params.get("pnlSign") ?? "",
    q: params.get("q") ?? "",
    rMax: params.get("rMax") ?? "",
    rMin: params.get("rMin") ?? "",
    session: params.get("session") ?? "",
    side: (params.get("side") ?? "") as TradeSide | "",
    sort: params.get("sort") ?? "closeTime",
    sortSpec: params.get("sortSpec") ?? "-closeTime",
    symbol: params.get("symbol") ?? "",
    to: params.get("to") ?? "",
    volumeMax: params.get("volumeMax") ?? "",
    volumeMin: params.get("volumeMin") ?? ""
  };
}

function buildTradesQuery(filters: ExplorerFilters) {
  const query = new URLSearchParams({ page: String(filters.page), pageSize: "10000", sort: filters.sort, order: filters.order, sortSpec: filters.sortSpec });
  if (filters.period === "all") query.set("allTime", "true");
  else if (filters.period !== "custom") query.set("granularity", filters.period);
  for (const key of ["dayOfWeek", "durationMax", "durationMin", "emotionTag", "hasNote", "hasScreenshot", "leakType", "playbookId", "pnlSign", "q", "rMax", "rMin", "session", "side", "symbol", "volumeMax", "volumeMin"] as const) {
    if (filters[key]) query.set(key, filters[key]);
  }
  if (filters.from) query.set("from", new Date(filters.from).toISOString());
  if (filters.to) query.set("to", new Date(filters.to).toISOString());
  return query;
}

function activeFilterChips(filters: ExplorerFilters, playbooks: Playbook[]) {
  const names = new Map(playbooks.map((playbook) => [playbook.id, playbook.name]));
  return Object.entries(filters)
    .filter(([key, value]) => value && !["page", "sort", "sortSpec", "order", "period"].includes(key))
    .map(([key, value]) => ({ key, label: `${labelFor(key)}: ${key === "playbookId" ? names.get(String(value)) ?? value : value}` }));
}

function labelFor(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function nextSortSpec(current: string, key: string) {
  const entries = current ? current.split(",").filter(Boolean) : [];
  const existing = entries.find((entry) => entry.replace(/^-/, "") === key);
  if (!existing) return [key, ...entries].slice(0, 3).join(",");
  const next = existing.startsWith("-") ? key : `-${key}`;
  return [next, ...entries.filter((entry) => entry !== existing)].slice(0, 3).join(",");
}

function sampleTrades(): TradeRow[] {
  return SAMPLE_RECENT_TRADES.map((trade, index) => ({
    ...trade,
    closePrice: 1.102 + index * 0.003,
    commission: -4,
    durationSec: 1800 + index * 420,
    emotionTags: index % 2 === 0 ? ["Disciplined"] : ["FOMO"],
    grossProfit: trade.netProfit + 4,
    hasNote: index % 2 === 0,
    hasScreenshot: index % 3 === 0,
    leakFlags: index === 1 ? [{ id: "sample-leak", severity: "warning", type: "revenge_trade" }] : [],
    netProfit: trade.netProfit,
    openPrice: 1.098 + index * 0.003,
    openTime: new Date(new Date(trade.closeTime).getTime() - 38 * 60 * 1000).toISOString(),
    playbook: index % 3 === 0 ? SAMPLE_PLAYBOOKS[0] : index % 3 === 1 ? SAMPLE_PLAYBOOKS[1] : null,
    playbookId: index % 3 === 0 ? SAMPLE_PLAYBOOKS[0]?.id : index % 3 === 1 ? SAMPLE_PLAYBOOKS[1]?.id : null,
    rMultiple: trade.netProfit > 0 ? 1.4 + index * 0.2 : -0.8,
    session: index % 2 === 0 ? "London" : "New York",
    swap: 0,
    volume: index % 2 === 0 ? 0.8 : 1.2
  }));
}

function emptyMetrics(currency: string): MetricsResponse {
  void currency;
  return { ...SAMPLE_DASHBOARD_DATA, avgLoss: 0, avgLossR: null, avgWin: 0, avgWinR: null, bestDay: null, breakevenTrades: 0, dailySeries: [], drawdown: { abs: 0, pct: 0 }, expectancyCurrency: 0, expectancyR: null, grossLoss: 0, grossWin: 0, largestLoss: 0, largestWin: 0, losingTrades: 0, netPnl: 0, profitFactor: null, profitFactorReason: "no_trades", rMultipleHistogram: [], totalTrades: 0, totalVolume: 0, winRate: 0, winningTrades: 0, worstDay: null };
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }).format(new Date(value));
}

function formatPrice(value?: number) {
  return value == null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 5, minimumFractionDigits: value > 100 ? 2 : 4 });
}

function formatDuration(value?: number | null) {
  if (!value) return "—";
  const minutes = Math.round(value / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
