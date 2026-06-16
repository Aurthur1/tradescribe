"use client";

import { Archive, ArrowRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchPlaybookPerformanceSummary, fetchPlaybooks, type Playbook, type PlaybookPerformanceSummaryResponse, useCurrentUser } from "../_lib/dashboard-data";
import { SAMPLE_PLAYBOOK_PERFORMANCE, SAMPLE_PLAYBOOKS } from "../_lib/dashboard-sample";
import { formatCurrency } from "../_lib/format";
import { AccountSwitcher } from "../_components/account-switcher";

export default function PlaybooksPage() {
  const { data: context } = useCurrentUser();
  const accounts = context?.accounts ?? [];
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const preferredAccountId = context?.preferences.activeAccountId ?? primaryAccount?.id ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(preferredAccountId);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [summary, setSummary] = useState<PlaybookPerformanceSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const sampleMode = playbooks.length === 0 && accounts.length === 0;
  const visiblePlaybooks = sampleMode ? SAMPLE_PLAYBOOKS : playbooks;
  const performance = sampleMode ? SAMPLE_PLAYBOOK_PERFORMANCE : summary;
  const currency = activeAccount?.currency ?? context?.accounts[0]?.currency ?? "USD";
  const active = visiblePlaybooks.filter((playbook) => !playbook.isArchived);
  const archived = visiblePlaybooks.filter((playbook) => playbook.isArchived);

  useEffect(() => {
    setSelectedAccountId(context?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [context?.preferences.activeAccountId, primaryAccount?.id]);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      anchor: new Date().toISOString(),
      granularity: "week",
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    });
    if (activeAccount?.id) query.set("accountId", activeAccount.id);
    Promise.all([fetchPlaybooks(controller.signal), fetchPlaybookPerformanceSummary(query, controller.signal)])
      .then(([nextPlaybooks, nextSummary]) => {
        setPlaybooks(nextPlaybooks);
        setSummary(nextSummary);
      })
      .catch(() => {
        setPlaybooks([]);
        setSummary(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [activeAccount?.id]);

  const metricsById = useMemo(() => new Map((performance?.playbooks ?? []).map((item) => [item.id, item.metrics])), [performance]);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">TradeScribe</p>
            <h1 className="mt-2 text-[28px] font-bold text-white">Playbooks</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#94A3B8]">Define your strategy rules, tag trades, and compare structured setups against discretionary trades.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AccountSwitcher
              accounts={accounts}
              activeAccountId={selectedAccountId}
              canUseAllAccounts={context?.user.role === "ADMIN" || context?.user.plan === "PRO"}
              onAccountChange={setSelectedAccountId}
              plan={context?.user.plan ?? "FREE"}
            />
            <Link className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-bold text-white shadow-[0_14px_36px_rgba(59,130,246,0.22)]" href="/playbooks/new">
              <Plus className="h-4 w-4" aria-hidden />
              New Playbook
            </Link>
          </div>
        </div>

        {sampleMode ? <p className="mt-5 w-fit rounded-full bg-[#3B82F6]/12 px-3 py-1 text-xs font-bold text-[#93C5FD]">Sample playbooks — create your first real playbook anytime</p> : null}

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading && !sampleMode ? <p className="text-sm font-semibold text-[#94A3B8]">Loading playbooks...</p> : null}
          {!loading && active.length === 0 && !sampleMode ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-6">
              <h2 className="text-lg font-bold text-white">No playbooks yet</h2>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">Create a strategy checklist, then tag trades from the journal.</p>
            </div>
          ) : null}
          {active.map((playbook) => (
            <PlaybookCard currency={currency} key={playbook.id} metrics={metricsById.get(playbook.id)} playbook={playbook} sample={sampleMode} />
          ))}
        </section>

        {archived.length ? (
          <details className="mt-8 rounded-2xl border border-white/[0.06] bg-[#111827]/70 p-5">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#CBD5E1]">
              <Archive className="h-4 w-4" aria-hidden />
              Archived playbooks
            </summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {archived.map((playbook) => (
                <PlaybookCard currency={currency} key={playbook.id} metrics={metricsById.get(playbook.id)} playbook={playbook} sample={sampleMode} />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}

function PlaybookCard({ currency, metrics, playbook, sample }: { currency: string; metrics?: PlaybookPerformanceSummaryResponse["playbooks"][number]["metrics"]; playbook: Playbook; sample: boolean }) {
  return (
    <Link className="group rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5 transition hover:-translate-y-0.5 hover:border-[#3B82F6]/35 hover:bg-[#182033]/80" href={sample ? `/playbooks/${playbook.id}` : `/playbooks/${playbook.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: playbook.color }} />
            <h2 className="truncate text-lg font-bold text-white">{playbook.name}</h2>
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#94A3B8]">{playbook.description || "No description yet."}</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-[#64748B] transition group-hover:text-[#93C5FD]" aria-hidden />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {playbook.tags.slice(0, 3).map((tag) => (
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[11px] font-bold text-[#94A3B8]" key={tag}>{tag}</span>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-black/20 p-3">
        <Metric label="Trades" value={String(metrics?.totalTrades ?? playbook.tradeCount ?? 0)} />
        <Metric label="Win rate" value={`${Math.round((metrics?.winRate ?? 0) * 100)}%`} />
        <Metric label="Net P&L" value={formatCurrency(metrics?.netPnl ?? 0, currency)} tone={(metrics?.netPnl ?? 0) >= 0 ? "positive" : "negative"} />
      </div>
    </Link>
  );
}

function Metric({ label, tone, value }: { label: string; tone?: "positive" | "negative"; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-[#64748B]">{label}</p>
      <p className={`mt-1 truncate text-sm font-bold tabular-nums ${tone === "positive" ? "text-[#22C55E]" : tone === "negative" ? "text-[#EF4444]" : "text-white"}`}>{value}</p>
    </div>
  );
}
