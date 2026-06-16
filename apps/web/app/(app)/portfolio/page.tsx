"use client";

import { ArrowRight, LockKeyhole, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AccountSwitcher } from "../_components/account-switcher";
import { fetchPortfolio, savePreferences, type PortfolioResponse, useCurrentUser } from "../_lib/dashboard-data";
import { formatCurrency, formatPercent } from "../_lib/format";

export default function PortfolioPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const plan = user.data?.user.plan ?? "FREE";
  const isAdmin = user.data?.user.role === "ADMIN";
  const canUsePortfolio = isAdmin || plan === "PRO";
  const [payload, setPayload] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      anchor: new Date().toISOString(),
      granularity: "week",
      tz: timeZone
    });
    setLoading(true);
    fetchPortfolio(query, controller.signal)
      .then(setPayload)
      .catch(() => setPayload({ accounts: [], locked: !canUsePortfolio, reason: "Portfolio could not be loaded." }))
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [canUsePortfolio, timeZone]);

  const accounts = payload?.accounts ?? user.data?.accounts ?? [];
  const totals = useMemo(
    () =>
      (payload?.accounts ?? []).reduce(
        (sum, account) => ({
          balance: sum.balance + (account.balance ?? 0),
          equity: sum.equity + (account.equity ?? 0),
          pnl: sum.pnl + account.metrics.netPnl,
          trades: sum.trades + account.metrics.totalTrades
        }),
        { balance: 0, equity: 0, pnl: 0, trades: 0 }
      ),
    [payload?.accounts]
  );

  async function openAccount(accountId: string) {
    await savePreferences({ activeAccountId: accountId });
    router.push("/dashboard");
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">TradeScribe</p>
            <h1 className="mt-2 text-[28px] font-bold text-white">Portfolio</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#94A3B8]">All-account performance and sync health, scoped only to accounts you own.</p>
          </div>
          <AccountSwitcher
            accounts={accounts}
            activeAccountId={null}
            canUseAllAccounts={canUsePortfolio}
            onAccountChange={(accountId) => {
              if (accountId) void openAccount(accountId);
            }}
            plan={plan}
          />
        </div>

        {!canUsePortfolio || payload?.locked ? (
          <section className="mt-6 rounded-2xl border border-[#3B82F6]/20 bg-[#111827]/80 p-8">
            <div className="flex max-w-2xl gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#3B82F6]/12 text-[#93C5FD]">
                <LockKeyhole className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white">Upgrade to unlock all-account portfolio view.</h2>
                <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{payload?.reason ?? "Portfolio reporting is available on Pro plans."}</p>
                <a className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-bold text-white" href="/settings">
                  View plans
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </a>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mt-6 grid gap-4 md:grid-cols-4">
              <SummaryCard label="Total balance" value={formatCurrency(totals.balance, "USD")} />
              <SummaryCard label="Total equity" value={formatCurrency(totals.equity, "USD")} />
              <SummaryCard label="Period P&L" tone={totals.pnl >= 0 ? "positive" : "negative"} value={formatCurrency(totals.pnl, "USD")} />
              <SummaryCard label="Trades" value={String(totals.trades)} />
            </section>

            <section className="mt-5 overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111827]/70">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.2fr] gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-bold uppercase text-[#64748B]">
                <span>Account</span>
                <span>Balance</span>
                <span>Equity</span>
                <span>Period P&L</span>
                <span>Win rate</span>
                <span>Risk room</span>
                <span />
              </div>
              <div className="divide-y divide-white/[0.06]">
                {loading ? <p className="p-5 text-sm font-semibold text-[#94A3B8]">Loading portfolio...</p> : null}
                {!loading && (payload?.accounts.length ?? 0) === 0 ? <p className="p-5 text-sm font-semibold text-[#94A3B8]">No connected accounts yet.</p> : null}
                {payload?.accounts.map((account) => (
                  <button className="grid w-full grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr_0.8fr_0.2fr] items-center gap-3 px-4 py-4 text-left text-sm transition hover:bg-white/[0.035]" key={account.id} onClick={() => void openAccount(account.id)} type="button">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <StatusDot status={account.connectionStatus} />
                        <span className="truncate font-bold text-white">{account.name}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-[#64748B]">{account.broker} #{account.maskedLogin} · {account.platform}</span>
                    </span>
                    <span className="font-bold text-white tabular-nums">{formatCurrency(account.balance ?? 0, account.currency)}</span>
                    <span className="font-bold text-white tabular-nums">{formatCurrency(account.equity ?? 0, account.currency)}</span>
                    <span className={`${account.metrics.netPnl >= 0 ? "text-[#22C55E]" : "text-[#EF4444]"} font-bold tabular-nums`}>{formatCurrency(account.metrics.netPnl, account.currency)}</span>
                    <span className="font-bold text-[#CBD5E1] tabular-nums">{formatPercent(account.metrics.winRate)}</span>
                    <RiskBadge status={account.riskRoom?.overallStatus} />
                    <ArrowRight className="h-4 w-4 text-[#64748B]" aria-hidden />
                  </button>
                ))}
              </div>
            </section>

            <p className="mt-4 flex items-center gap-2 text-xs font-semibold text-[#64748B]">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
              Combined equity curve is intentionally omitted until account histories can be reliably aligned by timestamp and currency.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, tone, value }: { label: string; tone?: "positive" | "negative"; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-5">
      <p className="text-xs font-bold uppercase text-[#64748B]">{label}</p>
      <p className={`mt-3 text-2xl font-bold tabular-nums ${tone === "positive" ? "text-[#22C55E]" : tone === "negative" ? "text-[#EF4444]" : "text-white"}`}>{value}</p>
    </div>
  );
}

function RiskBadge({ status }: { status?: string }) {
  const classes = status === "breached" ? "bg-[#EF4444]/12 text-[#FCA5A5]" : status === "warning" ? "bg-[#F59E0B]/12 text-[#FCD34D]" : status === "ok" ? "bg-[#3B82F6]/12 text-[#93C5FD]" : "bg-white/[0.05] text-[#94A3B8]";
  return <span className={`w-fit rounded-full px-2 py-1 text-xs font-bold capitalize ${classes}`}>{status ?? "Not set"}</span>;
}

function StatusDot({ status }: { status?: string }) {
  const color = status === "CONNECTED" ? "bg-[#22C55E]" : status === "SYNCING" ? "bg-[#F59E0B]" : status === "DEGRADED" || status === "ERROR" ? "bg-[#EF4444]" : "bg-[#64748B]";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}
