"use client";

import { Info } from "lucide-react";
import { formatCurrency } from "../../_lib/format";
import type { PlaybookPerformanceSummaryResponse } from "../../_lib/dashboard-data";

export function PlaybookComparisonWidget({
  currency = "USD",
  data,
  sample
}: {
  currency?: string;
  data: PlaybookPerformanceSummaryResponse;
  sample?: boolean;
}) {
  const rows = [
    ...data.playbooks.map((playbook) => ({
      color: playbook.color,
      id: playbook.id,
      name: playbook.name,
      netPnl: playbook.metrics.netPnl,
      totalTrades: playbook.metrics.totalTrades,
      winRate: playbook.metrics.winRate
    })),
    {
      color: "#64748B",
      id: "untagged",
      name: "Untagged",
      netPnl: data.untagged.metrics.netPnl,
      totalTrades: data.untagged.metrics.totalTrades,
      winRate: data.untagged.metrics.winRate
    }
  ];
  const maxAbsPnl = Math.max(1, ...rows.map((row) => Math.abs(row.netPnl)));

  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Playbook Performance</h2>
            {sample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-0.5 text-[10px] font-bold uppercase text-[#93C5FD]">Sample</span> : null}
          </div>
          <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Defined strategies compared with discretionary trades.</p>
        </div>
        <span className="group relative">
          <Info className="h-4 w-4 text-[#64748B]" aria-hidden />
          <span className="pointer-events-none absolute right-0 top-6 z-20 w-64 rounded-xl border border-white/[0.08] bg-[#111827] p-3 text-xs leading-5 text-[#CBD5E1] opacity-0 shadow-2xl group-hover:opacity-100">
            Compare how trades following your defined playbooks perform versus discretionary (untagged) trades.
          </span>
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {rows.map((row) => (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3" key={row.id}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <p className="truncate text-sm font-bold text-white">{row.name}</p>
              </div>
              <p className={`${row.netPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} text-sm font-bold tabular-nums`}>{formatCurrency(row.netPnl, currency)}</p>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className={`h-full rounded-full ${row.netPnl >= 0 ? "bg-[#3B82F6]" : "bg-[#EF4444]"}`} style={{ width: `${Math.max(6, (Math.abs(row.netPnl) / maxAbsPnl) * 100)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[#94A3B8]">
              <span>{row.totalTrades} trades</span>
              <span>{Math.round(row.winRate * 100)}% win rate</span>
            </div>
          </div>
        ))}
        {rows.length === 1 ? <p className="rounded-xl bg-white/[0.03] p-4 text-sm font-semibold text-[#94A3B8]">Create a playbook to compare strategy performance.</p> : null}
      </div>
    </section>
  );
}
