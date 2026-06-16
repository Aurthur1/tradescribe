"use client";

import { ArrowRight, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchSettings, openBillingPortal, type SettingsResponse } from "../../_lib/dashboard-data";
import { formatCurrency } from "../../_lib/format";
import { SettingsShell } from "../_components/settings-shell";

export default function BillingSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal)
      .then(setSettings)
      .catch(() => setSettings(null));
    return () => controller.abort();
  }, []);

  async function manageBilling() {
    setStatus("Opening billing portal...");
    try {
      const portal = await openBillingPortal();
      window.location.href = portal.url;
    } catch {
      setStatus("Billing portal is not configured yet.");
    }
  }

  const billing = settings?.billing;
  const amount = billing ? formatCurrency((billing.amountCents ?? 0) / 100, billing.currency) : "$0.00";
  const renewal = billing?.renewalDate ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(billing.renewalDate)) : "Not scheduled";

  return (
    <SettingsShell description="Review your plan, usage, renewal details, and billing portal actions." title="Billing">
      <div className="grid gap-4 md:grid-cols-3">
        <BillingCard label="Current plan" value={billing?.plan ?? "FREE"} />
        <BillingCard label="Renewal" value={renewal} />
        <BillingCard label="Amount" value={amount} />
      </div>

      <section className="mt-5 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
        <h3 className="text-lg font-bold text-white">Usage</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <UsageRow label="Connected accounts" value={`${billing?.usage.accountsConnected ?? 0} / ${billing?.usage.accountsLimit ?? "Unlimited"}`} />
          <UsageRow label="Storage" value={billing?.usage.storageMb == null ? "Not tracked yet" : `${billing.usage.storageMb} MB`} />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <a className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]" href="/settings/billing?upgrade=true">
          Upgrade
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
        <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] px-5 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => void manageBilling()} type="button">
          <CreditCard className="h-4 w-4" aria-hidden />
          Manage billing
        </button>
        {status ? <span className="self-center text-xs font-semibold text-[#94A3B8]">{status}</span> : null}
      </div>
    </SettingsShell>
  );
}

function BillingCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
      <p className="text-xs font-bold uppercase text-[#64748B]">{label}</p>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
      <p className="text-sm font-bold text-white">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">{value}</p>
    </div>
  );
}
