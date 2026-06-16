"use client";

import { ChevronDown, Layers3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { savePreferences, type AccountSummary } from "../_lib/dashboard-data";
import { formatCurrency } from "../_lib/format";

export function AccountSwitcher({
  accounts,
  activeAccountId,
  canUseAllAccounts,
  onAccountChange,
  plan
}: {
  accounts: AccountSummary[];
  activeAccountId: string | null;
  canUseAllAccounts?: boolean;
  onAccountChange?: (accountId: string | null) => void;
  plan: "FREE" | "CORE" | "PRO";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = accounts.find((account) => account.id === activeAccountId) ?? accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const showAllAccounts = canUseAllAccounts ?? plan === "PRO";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (accounts.length === 0) return null;

  if (accounts.length === 1 && active) {
    return (
      <div className="inline-flex h-11 max-w-full items-center gap-3 rounded-[10px] border border-white/[0.08] bg-white/[0.025] px-3 text-left">
        <StatusDot status={active.connectionStatus} />
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-white">{active.name}</p>
          <p className="truncate text-[11px] font-semibold text-[#64748B]">{active.broker ?? "Broker"} #{active.maskedLogin ?? mask(active.login)}</p>
        </div>
      </div>
    );
  }

  async function choose(accountId: string | null) {
    setOpen(false);
    onAccountChange?.(accountId);
    try {
      await savePreferences({ activeAccountId: accountId });
    } catch {
      // Keep the UI responsive; the next /me refresh will restore the server value if this failed.
    }
    if (accountId === null) router.push("/portfolio");
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        aria-expanded={open}
        className="flex h-11 min-w-[180px] max-w-full items-center justify-between gap-3 rounded-[10px] border border-white/[0.1] bg-white/[0.03] px-3 text-left text-sm transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] sm:min-w-[230px]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          {activeAccountId === null && showAllAccounts ? <Layers3 className="h-4 w-4 text-[#93C5FD]" aria-hidden /> : <StatusDot status={active?.connectionStatus} />}
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-white">{activeAccountId === null && showAllAccounts ? "All accounts" : active?.name ?? "Select account"}</span>
            <span className="block truncate text-[11px] font-semibold text-[#64748B]">
              {activeAccountId === null && showAllAccounts ? `${accounts.length} accounts` : `${active?.broker ?? "Broker"} #${active?.maskedLogin ?? (active ? mask(active.login) : "")}`}
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#64748B]" aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111827]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.48)] backdrop-blur-xl">
          {showAllAccounts ? (
            <button
              className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05] ${activeAccountId === null ? "bg-[#3B82F6]/15 ring-1 ring-[#3B82F6]/25" : ""}`}
              onClick={() => void choose(null)}
              type="button"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3B82F6]/15 text-[#93C5FD]"><Layers3 className="h-4 w-4" aria-hidden /></span>
              <span>
                <span className="block text-sm font-bold text-white">All accounts</span>
                <span className="text-xs font-semibold text-[#94A3B8]">Portfolio view across {accounts.length} accounts</span>
              </span>
            </button>
          ) : null}
          {accounts.map((account) => (
            <button
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05] ${active?.id === account.id && activeAccountId !== null ? "bg-[#3B82F6]/15 ring-1 ring-[#3B82F6]/25" : ""}`}
              key={account.id}
              onClick={() => void choose(account.id)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <StatusDot status={account.connectionStatus} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{account.name}</span>
                  <span className="block truncate text-xs font-semibold text-[#94A3B8]">{account.broker ?? "Broker"} #{account.maskedLogin ?? mask(account.login)} · {account.platform}</span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-xs font-bold text-white tabular-nums">{formatCurrency(account.balance ?? 0, account.currency)}</span>
                <span className="text-[11px] font-semibold uppercase text-[#64748B]">{account.connectionStatus}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  const color = status === "CONNECTED" ? "bg-[#22C55E]" : status === "SYNCING" ? "bg-[#F59E0B]" : status === "DEGRADED" || status === "ERROR" ? "bg-[#EF4444]" : "bg-[#64748B]";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function mask(value: string) {
  if (value.length <= 4) return `••${value}`;
  return `${"•".repeat(Math.max(3, value.length - 4))}${value.slice(-4)}`;
}
