"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { AccountSwitcher } from "../../_components/account-switcher";
import { savePropRules, useCurrentUser, usePropRules, type PropFirmRuleSet } from "../../_lib/dashboard-data";
import { EmptySettingsState, SettingsShell } from "../_components/settings-shell";

const defaultRules: PropFirmRuleSet = {
  alertThresholdPct: 0.8,
  consistencyMaxDailyProfitPct: 0.3,
  maxDailyLossMode: "balance",
  maxDailyLossPct: 0.05,
  maxDrawdownMode: "static",
  maxDrawdownPct: 0.1,
  profitTargetPct: 0.08
};

export default function PropRulesSettingsPage() {
  const user = useCurrentUser();
  const accounts = useMemo(() => user.data?.accounts ?? [], [user.data?.accounts]);
  const primary = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const preferredAccountId = user.data?.preferences.activeAccountId ?? primary?.id ?? null;
  const [accountId, setAccountId] = useState<string | null>(preferredAccountId);
  const activeAccountId = accountId ?? primary?.id ?? null;
  const existing = usePropRules(activeAccountId);
  const [rules, setRules] = useState<PropFirmRuleSet>(defaultRules);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const selectedAccount = useMemo(() => accounts.find((account) => account.id === activeAccountId), [accounts, activeAccountId]);

  useEffect(() => {
    setAccountId(user.data?.preferences.activeAccountId ?? primary?.id ?? null);
  }, [primary?.id, user.data?.preferences.activeAccountId]);

  useEffect(() => {
    setRules(existing ?? defaultRules);
  }, [existing]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeAccountId) return;
    setStatus("saving");
    try {
      await savePropRules(activeAccountId, rules);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SettingsShell description="Configure per-account prop firm rules for risk room warnings. TradeScribe informs only; it does not place, stop, or modify trades." title="Prop Firm Rules">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#94A3B8]">Choose the account these rules apply to.</p>
        <AccountSwitcher accounts={accounts} activeAccountId={activeAccountId} canUseAllAccounts={false} onAccountChange={setAccountId} plan={user.data?.user.plan ?? "FREE"} />
      </div>

      {selectedAccount ? (
        <form className="grid gap-5 md:grid-cols-2" onSubmit={onSubmit}>
          <RuleInput help="Daily loss percentage as a fraction, for example 0.05 means 5%." label="Max daily loss pct" onChange={(value) => setRules((current) => ({ ...current, maxDailyLossPct: value }))} value={rules.maxDailyLossPct ?? 0} />
          <RuleSelect help="Balance uses day-start balance; equity uses day-start equity." label="Daily loss mode" onChange={(value) => setRules((current) => ({ ...current, maxDailyLossMode: value as PropFirmRuleSet["maxDailyLossMode"] }))} options={["balance", "equity"]} value={rules.maxDailyLossMode} />
          <RuleInput help="Maximum drawdown percentage as a fraction, for example 0.10 means 10%." label="Max drawdown pct" onChange={(value) => setRules((current) => ({ ...current, maxDrawdownPct: value }))} value={rules.maxDrawdownPct ?? 0} />
          <RuleSelect help="Static measures from starting balance; trailing measures from the equity high-water mark." label="Drawdown mode" onChange={(value) => setRules((current) => ({ ...current, maxDrawdownMode: value as PropFirmRuleSet["maxDrawdownMode"] }))} options={["static", "trailing"]} value={rules.maxDrawdownMode} />
          <RuleInput help="Profit target as a fraction of starting balance." label="Profit target pct" onChange={(value) => setRules((current) => ({ ...current, profitTargetPct: value }))} value={rules.profitTargetPct ?? 0} />
          <RuleInput help="Warn when one positive day becomes too much of total positive P&L." label="Consistency max daily profit pct" onChange={(value) => setRules((current) => ({ ...current, consistencyMaxDailyProfitPct: value }))} value={rules.consistencyMaxDailyProfitPct ?? 0} />
          <RuleInput help="Warning threshold as a fraction of each configured limit, for example 0.8 means 80%." label="Alert threshold pct" onChange={(value) => setRules((current) => ({ ...current, alertThresholdPct: value }))} value={rules.alertThresholdPct} />
          <div className="flex items-end gap-3">
            <button className="h-11 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]" type="submit">
              Save rules
            </button>
            <span className="pb-3 text-xs font-semibold text-[#94A3B8]">{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Could not save" : ""}</span>
          </div>
        </form>
      ) : (
        <EmptySettingsState>Connect a read-only account before setting prop firm rules.</EmptySettingsState>
      )}
    </SettingsShell>
  );
}

function RuleInput({ help, label, onChange, value }: { help: string; label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">{label}</span>
      <input className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" max={1} min={0.0001} onChange={(event) => onChange(Number(event.target.value))} step={0.01} type="number" value={value} />
      <span className="mt-2 block text-xs leading-5 text-[#94A3B8]">{help}</span>
    </label>
  );
}

function RuleSelect({ help, label, onChange, options, value }: { help: string; label: string; onChange: (value: string) => void; options: string[]; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">{label}</span>
      <select className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs leading-5 text-[#94A3B8]">{help}</span>
    </label>
  );
}
