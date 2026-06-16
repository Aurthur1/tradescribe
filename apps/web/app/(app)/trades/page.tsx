"use client";

import { ArrowDownUp, ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { fetchPlaybooks, fetchTrades, type Granularity, type Playbook, type TradeSide, type TradesListResponse, useCurrentUser } from "../_lib/dashboard-data";
import { SAMPLE_PLAYBOOKS, SAMPLE_RECENT_TRADES } from "../_lib/dashboard-sample";
import { formatCurrency } from "../_lib/format";
import { AccountSwitcher } from "../_components/account-switcher";
import { PlaybookSelect } from "../playbooks/_components/playbook-select";

const emotions = ["Confident", "Fearful", "Impulsive", "Disciplined", "FOMO", "Bored", "Revenge"];
const sides: Array<TradeSide | ""> = ["", "BUY", "SELL"];
const periods: Array<"all" | Granularity | "custom"> = ["all", "day", "week", "month", "year", "custom"];

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
  useEffect(() => {
    setSelectedAccountId(user.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [primaryAccount?.id, user.data?.preferences.activeAccountId]);
  const account = accounts.find((item) => item.id === selectedAccountId) ?? primaryAccount;
  const accountId = account?.id ?? null;
  const [payload, setPayload] = useState<TradesListResponse | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(false);
  const sampleMode = !account;
  const currency = account?.currency ?? "USD";

  const filters = {
    emotionTag: searchParams.get("emotionTag") ?? "",
    from: searchParams.get("from") ?? "",
    page: Number(searchParams.get("page") ?? "1"),
    period: (searchParams.get("period") ?? "all") as "all" | Granularity | "custom",
    session: searchParams.get("session") ?? "",
    side: (searchParams.get("side") ?? "") as TradeSide | "",
    sort: searchParams.get("sort") ?? "closeTime",
    order: searchParams.get("order") ?? "desc",
    symbol: searchParams.get("symbol") ?? "",
    to: searchParams.get("to") ?? ""
  };

  useEffect(() => {
    if (!accountId) {
      setPayload(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(filters.page),
      pageSize: "12",
      sort: filters.sort,
      order: filters.order
    });
    if (filters.period === "all") query.set("allTime", "true");
    else if (filters.period !== "custom") query.set("granularity", filters.period);
    if (filters.from) query.set("from", new Date(filters.from).toISOString());
    if (filters.to) query.set("to", new Date(filters.to).toISOString());
    if (filters.symbol) query.set("symbol", filters.symbol.toUpperCase());
    if (filters.side) query.set("side", filters.side);
    if (filters.session) query.set("session", filters.session);
    if (filters.emotionTag) query.set("emotionTag", filters.emotionTag);

    setLoading(true);
    fetchTrades(accountId, query, controller.signal)
      .then(setPayload)
      .catch(() => setPayload(null))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [accountId, filters.emotionTag, filters.from, filters.order, filters.page, filters.period, filters.session, filters.side, filters.sort, filters.symbol, filters.to]);

  useEffect(() => {
    const controller = new AbortController();
    fetchPlaybooks(controller.signal)
      .then(setPlaybooks)
      .catch(() => setPlaybooks([]));
    return () => controller.abort();
  }, []);

  function writeQuery(values: Record<string, string | number | null>) {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(values).forEach(([key, value]) => {
      if (value === null || value === "") next.delete(key);
      else next.set(key, String(value));
    });
    if (!("page" in values)) next.set("page", "1");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const rows = useMemo(() => {
    if (!sampleMode) return payload?.data ?? [];
    return SAMPLE_RECENT_TRADES.map((trade, index) => ({
      ...trade,
      commission: -4,
      grossProfit: trade.netProfit + 4,
      openTime: new Date(new Date(trade.closeTime).getTime() - 38 * 60 * 1000).toISOString(),
      playbook: index % 3 === 0 ? SAMPLE_PLAYBOOKS[0] : index % 3 === 1 ? SAMPLE_PLAYBOOKS[1] : null,
      playbookId: index % 3 === 0 ? SAMPLE_PLAYBOOKS[0]?.id : index % 3 === 1 ? SAMPLE_PLAYBOOKS[1]?.id : null,
      session: index % 2 === 0 ? ("London" as const) : ("New York" as const),
      swap: 0,
      volume: index % 2 === 0 ? 0.8 : 1.2
    }));
  }, [payload?.data, sampleMode]);
  const availablePlaybooks = sampleMode ? SAMPLE_PLAYBOOKS : playbooks;

  const totalPages = sampleMode ? 1 : payload?.totalPages ?? 1;

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">TradeScribe</p>
            <h1 className="mt-2 text-[28px] font-bold text-white">Trade Journal</h1>
            <p className="mt-2 text-sm font-medium text-[#94A3B8]">Search, filter, and open individual trades for detailed review.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {sampleMode ? <span className="rounded-full bg-[#3B82F6]/12 px-3 py-1 text-xs font-bold text-[#93C5FD]">Sample mode</span> : null}
            <AccountSwitcher
              accounts={accounts}
              activeAccountId={selectedAccountId}
              canUseAllAccounts={user.data?.user.role === "ADMIN" || user.data?.user.plan === "PRO"}
              onAccountChange={(accountId) => {
                setSelectedAccountId(accountId);
                if (accountId === null) return;
                writeQuery({ page: 1 });
              }}
              plan={user.data?.user.plan ?? "FREE"}
            />
          </div>
        </div>

        <section className="mt-6 rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" aria-hidden />
              <input className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] pl-9 pr-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => writeQuery({ symbol: event.target.value })} placeholder="Filter symbol" value={filters.symbol} />
            </label>
            <Select label="Period" onChange={(value) => writeQuery({ period: value })} options={periods.map((period) => ({ label: period === "all" ? "All time" : `${period.charAt(0).toUpperCase()}${period.slice(1)}`, value: period }))} value={filters.period} />
            <Select label="Side" onChange={(value) => writeQuery({ side: value })} options={sides.map((side) => ({ label: side || "Any side", value: side }))} value={filters.side} />
            <Select label="Emotion" onChange={(value) => writeQuery({ emotionTag: value })} options={[{ label: "Any emotion", value: "" }, ...emotions.map((emotion) => ({ label: emotion, value: emotion }))]} value={filters.emotionTag} />
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-4">
            <input className="h-11 rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => writeQuery({ from: event.target.value })} type="datetime-local" value={filters.from} />
            <input className="h-11 rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => writeQuery({ to: event.target.value })} type="datetime-local" value={filters.to} />
            <Select label="Session" onChange={(value) => writeQuery({ session: value })} options={["", "Sydney", "Tokyo", "London", "New York"].map((session) => ({ label: session || "Any session", value: session }))} value={filters.session} />
            <button className="h-11 rounded-xl border border-white/[0.08] px-3 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.04]" onClick={() => router.replace(pathname, { scroll: false })} type="button">
              Clear filters
            </button>
          </div>
        </section>

        <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]/70">
          <div className="hidden grid-cols-[1.2fr_0.75fr_0.6fr_0.8fr_0.65fr_1fr_0.2fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-bold uppercase text-[#64748B] md:grid">
            <SortButton label="Close time" onClick={() => writeQuery({ sort: "closeTime", order: filters.order === "asc" ? "desc" : "asc" })} />
            <SortButton label="Symbol" onClick={() => writeQuery({ sort: "symbol", order: filters.order === "asc" ? "desc" : "asc" })} />
            <span>Side</span>
            <SortButton label="Net P&L" onClick={() => writeQuery({ sort: "netProfit", order: filters.order === "asc" ? "desc" : "asc" })} />
            <SortButton label="Volume" onClick={() => writeQuery({ sort: "volume", order: filters.order === "asc" ? "desc" : "asc" })} />
            <span>Playbook</span>
            <span />
          </div>
          <div className="divide-y divide-white/[0.06]">
            {loading ? <p className="p-5 text-sm text-[#94A3B8]">Loading trades...</p> : null}
            {!loading && rows.length === 0 ? <p className="p-5 text-sm text-[#94A3B8]">No trades match these filters.</p> : null}
            {rows.map((trade) => (
              <TradeRow
                availablePlaybooks={availablePlaybooks}
                currency={currency}
                href={`/trades/${trade.id}?from=${encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`)}`}
                key={trade.id}
                onPlaybookChange={(playbook) =>
                  setPayload((current) =>
                    current
                      ? {
                          ...current,
                          data: current.data.map((item) => (item.id === trade.id ? { ...item, playbook, playbookId: playbook?.id ?? null } : item))
                        }
                      : current
                  )
                }
                sampleMode={sampleMode}
                trade={trade}
              />
            ))}
          </div>
        </section>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs font-semibold text-[#64748B]">{sampleMode ? "Sample trades" : `${payload?.total ?? 0} trades`}</p>
          <div className="flex items-center gap-2">
            <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#CBD5E1] disabled:opacity-40" disabled={filters.page <= 1} onClick={() => writeQuery({ page: Math.max(1, filters.page - 1) })} type="button">
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span className="text-xs font-bold text-[#94A3B8]">Page {filters.page} of {totalPages}</span>
            <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#CBD5E1] disabled:opacity-40" disabled={filters.page >= totalPages} onClick={() => writeQuery({ page: filters.page + 1 })} type="button">
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Select({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Array<{ label: string; value: string }>; value: string }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TradeRow({
  availablePlaybooks,
  currency,
  href,
  onPlaybookChange,
  sampleMode,
  trade
}: {
  availablePlaybooks: Playbook[];
  currency: string;
  href: string;
  onPlaybookChange: (playbook: TradesListResponse["data"][number]["playbook"]) => void;
  sampleMode: boolean;
  trade: TradesListResponse["data"][number];
}) {
  return (
    <div className="block px-4 py-4 text-sm transition hover:bg-white/[0.035] md:grid md:grid-cols-[1.2fr_0.75fr_0.6fr_0.8fr_0.65fr_1fr_0.2fr] md:items-center md:gap-3">
      <a className="block rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 md:hidden" href={href}>
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-bold text-white">{trade.symbol}</span>
            <span className="mt-1 block font-semibold text-[#CBD5E1]">{formatShort(trade.closeTime)}</span>
            <span className="text-xs text-[#64748B]">{trade.session ?? "Session pending"}</span>
          </span>
          <span className={`${trade.netProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold tabular-nums`}>{formatCurrency(trade.netProfit, currency)}</span>
        </span>
      </a>
      <a className="hidden md:block" href={href}>
        <span className="block font-bold text-white">{formatShort(trade.closeTime)}</span>
        <span className="text-xs text-[#64748B]">{trade.session ?? "Session pending"}</span>
      </a>
      <a className="hidden font-bold text-white md:block" href={href}>{trade.symbol}</a>
      <a className="mt-3 inline-flex md:mt-0" href={href}>
        <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold ${trade.side === "BUY" ? "bg-[#22C55E]/12 text-[#86EFAC]" : "bg-[#EF4444]/12 text-[#FCA5A5]"}`}>{trade.side}</span>
      </a>
      <a className={`${trade.netProfit >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} hidden font-bold tabular-nums md:block`} href={href}>{formatCurrency(trade.netProfit, currency)}</a>
      <a className="hidden text-[#CBD5E1] tabular-nums md:block" href={href}>{trade.volume}</a>
      <div className="mt-3 md:mt-0">
        <PlaybookSelect
          disabled={sampleMode}
          onChange={onPlaybookChange}
          playbooks={availablePlaybooks}
          tradeId={trade.id}
          value={trade.playbook ?? null}
        />
      </div>
      <a className="hidden md:block" href={href}><ArrowRight className="h-4 w-4 text-[#64748B]" aria-hidden /></a>
    </div>
  );
}

function SortButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="flex items-center gap-1 text-left hover:text-[#CBD5E1]" onClick={onClick} type="button">
      {label}
      <ArrowDownUp className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function formatShort(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }).format(new Date(value));
}
