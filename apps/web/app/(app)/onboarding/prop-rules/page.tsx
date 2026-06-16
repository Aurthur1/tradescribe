"use client";

import { Suspense, type FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { savePropRules } from "../../_lib/dashboard-data";
import { OnboardingShell } from "../_components/onboarding-shell";

export default function OnboardingPropRulesPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <OnboardingPropRulesContent />
    </Suspense>
  );
}

function OnboardingPropRulesContent() {
  const router = useRouter();
  const accountId = useSearchParams().get("account");
  const [enabled, setEnabled] = useState<"yes" | "no">("no");
  const [rules, setRules] = useState({ maxDailyLossPct: 0.05, maxDrawdownPct: 0.1, profitTargetPct: 0.08 });
  const nextHref = `/onboarding/done?account=${accountId ?? ""}&flow=connect`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enabled === "yes" && accountId) {
      await savePropRules(accountId, {
        alertThresholdPct: 0.8,
        maxDailyLossMode: "balance",
        maxDailyLossPct: rules.maxDailyLossPct,
        maxDrawdownMode: "static",
        maxDrawdownPct: rules.maxDrawdownPct,
        profitTargetPct: rules.profitTargetPct
      });
    }
    router.push(nextHref);
  }

  return (
    <OnboardingShell activeFlow>
      <form className="max-w-3xl" onSubmit={onSubmit}>
        <h2 className="text-2xl font-bold text-white">Are you running a prop firm challenge?</h2>
        <p className="mt-2 text-sm leading-6 text-[#94A3B8]">Optional rules let TradeScribe show risk room warnings. They inform you only; they do not place or change trades.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className={`rounded-2xl border p-4 text-left ${enabled === "yes" ? "border-[#3B82F6]/40 bg-[#3B82F6]/12" : "border-white/[0.08] bg-white/[0.03]"}`} onClick={() => setEnabled("yes")} type="button">
            <span className="font-bold text-white">Yes</span>
            <span className="mt-1 block text-sm text-[#94A3B8]">Track daily loss, drawdown, and target progress.</span>
          </button>
          <button className={`rounded-2xl border p-4 text-left ${enabled === "no" ? "border-[#3B82F6]/40 bg-[#3B82F6]/12" : "border-white/[0.08] bg-white/[0.03]"}`} onClick={() => setEnabled("no")} type="button">
            <span className="font-bold text-white">No / skip</span>
            <span className="mt-1 block text-sm text-[#94A3B8]">You can add prop rules later in Settings.</span>
          </button>
        </div>

        {enabled === "yes" ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <RuleInput help="5% means TradeScribe warns as you approach the daily limit." label="Max daily loss %" onChange={(value) => setRules((current) => ({ ...current, maxDailyLossPct: value / 100 }))} value={rules.maxDailyLossPct * 100} />
            <RuleInput help="Your overall challenge drawdown room." label="Max drawdown %" onChange={(value) => setRules((current) => ({ ...current, maxDrawdownPct: value / 100 }))} value={rules.maxDrawdownPct * 100} />
            <RuleInput help="The target used for progress tracking." label="Profit target %" onChange={(value) => setRules((current) => ({ ...current, profitTargetPct: value / 100 }))} value={rules.profitTargetPct * 100} />
          </div>
        ) : null}

        <div className="mt-7 flex gap-3">
          <button className="h-11 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]" type="submit">
            Continue
          </button>
          <button className="h-11 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => router.push(nextHref)} type="button">
            Skip
          </button>
        </div>
      </form>
    </OnboardingShell>
  );
}

function RuleInput({ help, label, onChange, value }: { help: string; label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label>
      <span className="text-sm font-bold text-white">{label}</span>
      <input className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" min={0.1} onChange={(event) => onChange(Number(event.target.value))} step={0.1} type="number" value={value} />
      <span className="mt-2 block text-xs leading-5 text-[#94A3B8]">{help}</span>
    </label>
  );
}
