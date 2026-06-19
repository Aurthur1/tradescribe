"use client";

/* eslint-disable @next/next/no-img-element */

import { ArrowRight, CalendarDays, Camera, ChevronLeft, ChevronRight, FileText, Filter, MessageSquareText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccountSwitcher } from "../_components/account-switcher";
import { Panel, Pill, Stat, StatGrid } from "../_components/ui";
import {
  fetchTrades,
  type Granularity,
  type TradesListResponse,
  useCurrentUser
} from "../_lib/dashboard-data";
import { SAMPLE_ANCHOR, SAMPLE_DASHBOARD_DATA, SAMPLE_RECENT_TRADES, sampleTradeDetail } from "../_lib/dashboard-sample";
import { rangeLabel, stepAnchor } from "../_lib/date-range";
import { formatCurrency, formatNumber, formatPercent, formatProfitFactor } from "../_lib/format";

type TradeRow = TradesListResponse["data"][number];
type FeedFilters = {
  emotionTag: string;
  hasScreenshot: boolean;
  leakType: string;
  needsReview: boolean;
  playbookId: string;
  symbol: string;
};

const emptyFilters: FeedFilters = {
  emotionTag: "",
  hasScreenshot: false,
  leakType: "",
  needsReview: false,
  playbookId: "",
  symbol: ""
};

function JournalPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: context } = useCurrentUser();
  const accounts = context?.accounts ?? [];
  const plan = context?.user.plan ?? "FREE";
  const isAdmin = context?.user.role === "ADMIN";
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const sample = !activeAccount;
  const timeZone = context?.preferences.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  const [anchor, setAnchor] = useState(searchParams.get("anchor") ?? (sample ? SAMPLE_ANCHOR : new Date().toISOString()));
  const [payload, setPayload] = useState<TradesListResponse>(() => sampleFeedPayload());
  const [loading, setLoading] = useState(false);
  const searchKey = searchParams.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(searchKey)), [searchKey]);

  useEffect(() => {
    setSelectedAccountId(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [context?.preferences.activeAccountId, primaryAccount?.id]);

  useEffect(() => {
    setAnchor(searchParams.get("anchor") ?? (sample ? SAMPLE_ANCHOR : new Date().toISOString()));
  }, [sample, searchParams]);

  useEffect(() => {
    if (!activeAccount?.id) {
      setPayload(sampleFeedPayload(filters));
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({
      anchor,
      granularity: "week" satisfies Granularity,
      order: "desc",
      pageSize: "60",
      sort: "closeTime",
      tz: timeZone
    });
    if (filters.symbol) query.set("symbol", filters.symbol);
    if (filters.emotionTag) query.set("emotionTag", filters.emotionTag);
    if (filters.playbookId) query.set("playbookId", filters.playbookId);
    if (filters.leakType) query.set("leakType", filters.leakType);
    if (filters.hasScreenshot) query.set("hasScreenshot", "true");
    if (filters.needsReview) query.set("needsReview", "true");
    setLoading(true);
    fetchTrades(activeAccount.id, query, controller.signal)
      .then(setPayload)
      .catch(() => setPayload({ ...sampleFeedPayload(filters), data: [], metrics: undefined, total: 0, totalPages: 0 }))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [activeAccount?.id, anchor, filters, timeZone]);

  const metrics = payload.metrics ?? SAMPLE_DASHBOARD_DATA;
  const rows = payload.data;
  const options = useMemo(() => buildOptions(rows), [rows]);
  const currency = activeAccount?.currency ?? "USD";

  function patchFilters(next: Partial<FeedFilters> & { anchor?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (typeof value === "boolean") {
        if (value) params.set(key, "true");
        else params.delete(key);
      } else if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.replace(`/journal?${params.toString()}`, { scroll: false });
  }

  function moveWeek(direction: -1 | 1) {
    const next = stepAnchor(anchor, "week", direction);
    setAnchor(next);
    patchFilters({ anchor: next });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[--text-low]">Trade Journal</p>
            <h1 className="mt-2 text-[28px] font-semibold text-white">Review Every Trade, Fast</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#94A3B8]">AI journal entries, your notes, emotion tags, screenshots, and deterministic leak flags in one weekly review feed.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sample ? <Pill>Sample</Pill> : null}
            <Link className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#3B82F6]/25 bg-[#3B82F6]/10 px-3 text-xs font-bold text-[#BFDBFE] hover:bg-[#3B82F6]/15" href="/journal/review">
              <Sparkles className="h-4 w-4" aria-hidden />
              Weekly coach
            </Link>
            <AccountSwitcher accounts={accounts} activeAccountId={selectedAccountId} canUseAllAccounts={isAdmin || plan === "PRO"} onAccountChange={setSelectedAccountId} plan={plan} />
          </div>
        </header>

        <Panel className="mt-4" padding="compact">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] hover:text-white" onClick={() => moveWeek(-1)} type="button" aria-label="Previous week">
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <div className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm font-bold text-white">
                <CalendarDays className="h-4 w-4 text-[#60A5FA]" aria-hidden />
                {rangeLabel(anchor, "week")}
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#94A3B8] hover:bg-white/[0.04] hover:text-white" onClick={() => moveWeek(1)} type="button" aria-label="Next week">
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#94A3B8]">
              <Filter className="h-4 w-4" aria-hidden />
              {loading ? "Refreshing feed..." : `${formatNumber(payload.total)} trades in view`}
            </div>
          </div>
        </Panel>

        <StatGrid className="mt-4 grid-cols-2 lg:grid-cols-5">
          <Panel padding="compact"><Stat label="Net P&L" tone={metrics.netPnl >= 0 ? "positive" : "negative"} value={formatCurrency(metrics.netPnl, currency)} /></Panel>
          <Panel padding="compact"><Stat label="Trades" value={formatNumber(metrics.totalTrades)} /></Panel>
          <Panel padding="compact"><Stat label="Win Rate" tone="blue" value={formatPercent(metrics.winRate)} /></Panel>
          <Panel padding="compact"><Stat label="Profit Factor" value={formatProfitFactor(metrics.profitFactor, metrics.profitFactorReason)} /></Panel>
          <Panel padding="compact"><Stat label="Needs Review" tone={filters.needsReview ? "warning" : "neutral"} value={formatNumber(rows.filter((trade) => !trade.hasNote).length)} /></Panel>
        </StatGrid>

        <Panel className="mt-4" padding="compact">
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <FilterSelect label="Symbol" options={options.symbols} value={filters.symbol} onChange={(value) => patchFilters({ symbol: value })} />
            <FilterSelect label="Emotion" options={options.emotions} value={filters.emotionTag} onChange={(value) => patchFilters({ emotionTag: value })} />
            <FilterSelect label="Playbook" options={options.playbooks} value={filters.playbookId} onChange={(value) => patchFilters({ playbookId: value })} />
            <FilterSelect label="Leak" options={options.leaks} value={filters.leakType} onChange={(value) => patchFilters({ leakType: value })} />
            <ToggleChip active={filters.hasScreenshot} label="Has screenshot" onClick={() => patchFilters({ hasScreenshot: !filters.hasScreenshot })} />
            <ToggleChip active={filters.needsReview} label="Needs review" onClick={() => patchFilters({ needsReview: !filters.needsReview })} />
          </div>
          {activeFilterCount(filters) ? (
            <button className="mt-3 text-xs font-bold text-[#93C5FD] hover:text-white" onClick={() => router.replace(`/journal?anchor=${encodeURIComponent(anchor)}`, { scroll: false })} type="button">
              Clear filters
            </button>
          ) : null}
        </Panel>

        <div className="mt-4 space-y-3">
          {rows.map((trade) => (
            <JournalTradeCard currency={currency} key={trade.id} sample={sample} trade={trade} />
          ))}
          {rows.length === 0 ? (
            <Panel className="py-12 text-center">
              <p className="text-lg font-bold text-white">No journal entries match this view.</p>
              <p className="mt-2 text-sm font-semibold text-[#94A3B8]">Try clearing filters or stepping to another week.</p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function JournalTradeCard({ currency, sample, trade }: { currency: string; sample: boolean; trade: TradeRow }) {
  const note = trade.notes?.[0];
  const screenshots = trade.screenshots ?? [];
  const flags = trade.leakFlags ?? [];
  const pnlPositive = trade.netProfit >= 0;
  return (
    <Panel interactive padding="compact">
      <Link aria-label={`Open ${trade.symbol} trade`} className="absolute inset-0 z-0" href={`/trades/${trade.id}?from=${encodeURIComponent("/journal")}`} />
      <div className="relative z-10 grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-black text-white">{trade.symbol}</p>
            <Pill tone={trade.side === "BUY" ? "positive" : "critical"}>{trade.side}</Pill>
            {sample ? <Pill>Sample</Pill> : null}
          </div>
          <p className="mt-2 text-xs font-bold text-[#94A3B8]">{formatDateTime(trade.closeTime)} · {trade.session ?? "Session —"}</p>
          <p className={`terminal-number mt-3 text-2xl font-semibold ${pnlPositive ? "text-[#86EFAC]" : "text-[#FCA5A5]"}`}>{formatCurrency(trade.netProfit, currency)}</p>
          <p className="mt-1 text-xs font-bold text-[#64748B]">{trade.rMultiple == null ? "R —" : `${trade.rMultiple.toFixed(2)}R`} · {trade.volume} lots</p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <JournalBlock icon={<Sparkles className="h-4 w-4" />} title="AI Journal">
            {trade.journalEntry ? (
              <>
                <p><span className="text-[#93C5FD]">Observed:</span> {trade.journalEntry.observed ?? trade.journalEntry.summary}</p>
                <p className="mt-2"><span className="text-[#C4B5FD]">Inferred:</span> {trade.journalEntry.inferred ?? "Inference will become more specific as more context is synced."}</p>
              </>
            ) : (
              <p className="text-[#94A3B8]">Journal entry will appear after the next sync.</p>
            )}
          </JournalBlock>
          <JournalBlock icon={<MessageSquareText className="h-4 w-4" />} title="Trader Notes">
            {note?.body ? <p>{note.body}</p> : <p className="text-[#94A3B8]">No note yet. Mark this for review or open the trade to add context.</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(trade.emotionTags ?? note?.emotionTags ?? []).map((tag) => <Pill key={tag} tone="neutral">{tag}</Pill>)}
              {trade.playbook ? <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-white" style={{ backgroundColor: `${trade.playbook.color}55` }}>{trade.playbook.name}</span> : null}
            </div>
          </JournalBlock>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]"><FileText className="h-4 w-4" /> Flags</span>
              <span className="text-xs font-bold text-[#94A3B8]">{flags.length}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {flags.length ? flags.map((flag) => <Pill key={flag.id} tone={flag.severity === "critical" ? "critical" : flag.severity === "warning" ? "warning" : "info"}>{humanLeak(flag.type)}</Pill>) : <span className="text-xs font-semibold text-[#94A3B8]">No behavioral flags.</span>}
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]"><Camera className="h-4 w-4" /> Screenshots</div>
            {screenshots.length ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {screenshots.slice(0, 3).map((screenshot) => <img alt={screenshot.filename ?? "Trade screenshot"} className="h-14 rounded-lg object-cover" key={screenshot.id} src={screenshot.url} />)}
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold text-[#94A3B8]">No screenshots attached.</p>
            )}
          </div>
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#93C5FD]">Open trade <ArrowRight className="h-4 w-4" /></span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function JournalBlock({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <div className="min-h-[132px] rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[#64748B]">{icon}{title}</div>
      <div className="mt-3 line-clamp-4 text-sm font-semibold leading-6 text-[#CBD5E1]">{children}</div>
    </div>
  );
}

function FilterSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#64748B]">{label}</span>
      <select className="mt-1 h-10 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-bold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="">All</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function ToggleChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`mt-5 h-10 rounded-xl border px-3 text-sm font-bold transition ${active ? "border-[#3B82F6]/30 bg-[#3B82F6]/15 text-[#BFDBFE]" : "border-white/[0.08] bg-white/[0.03] text-[#94A3B8] hover:text-white"}`} onClick={onClick} type="button">
      {label}
    </button>
  );
}

function readFilters(params: URLSearchParams): FeedFilters {
  return {
    emotionTag: params.get("emotionTag") ?? emptyFilters.emotionTag,
    hasScreenshot: params.get("hasScreenshot") === "true",
    leakType: params.get("leakType") ?? emptyFilters.leakType,
    needsReview: params.get("needsReview") === "true",
    playbookId: params.get("playbookId") ?? emptyFilters.playbookId,
    symbol: params.get("symbol") ?? emptyFilters.symbol
  };
}

function activeFilterCount(filters: FeedFilters) {
  return Object.values(filters).filter(Boolean).length;
}

function buildOptions(rows: TradeRow[]) {
  const symbols = Array.from(new Set(rows.map((trade) => trade.symbol))).sort().map((value) => ({ label: value, value }));
  const emotions = Array.from(new Set(rows.flatMap((trade) => trade.emotionTags ?? []))).sort().map((value) => ({ label: value, value }));
  const playbooks = Array.from(new Map(rows.map((trade) => trade.playbook).filter(Boolean).map((playbook) => [playbook!.id, playbook!] as const)).values()).map((playbook) => ({ label: playbook.name, value: playbook.id }));
  const leaks = Array.from(new Set(rows.flatMap((trade) => trade.leakFlags ?? []).map((flag) => flag.type))).sort().map((value) => ({ label: humanLeak(value), value }));
  return { emotions, leaks, playbooks, symbols };
}

function sampleFeedPayload(filters: FeedFilters = emptyFilters): TradesListResponse {
  const all = SAMPLE_RECENT_TRADES.map((trade) => {
    const detail = sampleTradeDetail(trade.id);
    return detail
      ? ({
          ...detail,
          emotionTags: detail.notes.flatMap((note) => note.emotionTags),
          hasNote: Boolean(detail.notes.length),
          hasScreenshot: Boolean(detail.screenshots.length)
        } as TradeRow)
      : null;
  }).filter(Boolean) as TradeRow[];
  const data = all.filter((trade) => {
    if (filters.symbol && trade.symbol !== filters.symbol) return false;
    if (filters.emotionTag && !(trade.emotionTags ?? trade.notes?.[0]?.emotionTags ?? []).includes(filters.emotionTag)) return false;
    if (filters.playbookId && trade.playbookId !== filters.playbookId) return false;
    if (filters.leakType && !(trade.leakFlags ?? []).some((flag) => flag.type === filters.leakType)) return false;
    if (filters.hasScreenshot && !trade.screenshots?.length) return false;
    if (filters.needsReview && trade.hasNote) return false;
    return true;
  });
  return { data, metrics: SAMPLE_DASHBOARD_DATA, page: 1, pageSize: 60, total: data.length, totalPages: 1 };
}

function humanLeak(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "2-digit", hour: "numeric", minute: "2-digit", month: "short" }).format(new Date(value));
}

export default function JournalPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <JournalPageInner />
    </Suspense>
  );
}
