"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { createConnection } from "../../_lib/dashboard-data";
import { OnboardingShell } from "../_components/onboarding-shell";

export default function OnboardingConnectPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [form, setForm] = useState({
    broker: "MetaTrader",
    currency: "USD",
    investorPassword: "",
    label: "",
    login: "",
    platform: "MT5" as "MT4" | "MT5",
    server: "",
    startingBalance: 0
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const connection = await createConnection(form);
      router.replace(`/onboarding/backfill?connection=${connection.id}&account=${connection.accountId ?? ""}&flow=connect`);
    } catch {
      setStatus("error");
    }
  }

  return (
    <OnboardingShell>
      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div>
            <h2 className="text-2xl font-bold text-white">Connect read-only MetaTrader access</h2>
            <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
              Enter your INVESTOR (read-only) password — never your trading password. TradeScribe can only ever read your trade history; it can never place, modify, or close trades.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Platform">
              <select className="input" onChange={(event) => setForm((current) => ({ ...current, platform: event.target.value as "MT4" | "MT5" }))} value={form.platform}>
                <option value="MT5">MT5</option>
                <option value="MT4">MT4</option>
              </select>
            </Field>
            <Field label="Broker">
              <input className="input" onChange={(event) => setForm((current) => ({ ...current, broker: event.target.value }))} required value={form.broker} />
            </Field>
            <Field label="Server">
              <input className="input" onChange={(event) => setForm((current) => ({ ...current, server: event.target.value }))} placeholder="Broker-Live" required value={form.server} />
            </Field>
            <Field label="Login">
              <input className="input" onChange={(event) => setForm((current) => ({ ...current, login: event.target.value }))} required value={form.login} />
            </Field>
            <Field label="Investor password">
              <input className="input" onChange={(event) => setForm((current) => ({ ...current, investorPassword: event.target.value }))} required type="password" value={form.investorPassword} />
              <p className="mt-2 text-xs leading-5 text-[#94A3B8]">
                If you enter your trading password by mistake, the connection is still read-only on TradeScribe&apos;s side, but we strongly recommend using the investor password from your broker account settings.
              </p>
            </Field>
            <Field label="Account label">
              <input className="input" onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} placeholder="FTMO Challenge #1" value={form.label} />
            </Field>
            <Field label="Currency">
              <input className="input" onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} value={form.currency} />
            </Field>
            <Field label="Starting balance">
              <input className="input" min={0} onChange={(event) => setForm((current) => ({ ...current, startingBalance: Number(event.target.value) }))} type="number" value={form.startingBalance} />
            </Field>
          </div>
          <button className="mt-2 h-11 w-fit rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB] disabled:opacity-60" disabled={status === "saving"} type="submit">
            {status === "saving" ? "Connecting..." : "Connect read-only account"}
          </button>
          {status === "error" ? <p className="text-sm font-semibold text-[#FCA5A5]">Connection could not be created. Check the details and try again.</p> : null}
        </form>

        <aside className="h-fit rounded-2xl border border-white/[0.06] bg-black/20 p-5">
          <LockKeyhole className="h-5 w-5 text-[#60A5FA]" aria-hidden />
          <h3 className="mt-3 text-lg font-bold text-white">Why investor password only?</h3>
          <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
            Investor access can read account history and state. It cannot place, close, or modify trades, which keeps TradeScribe focused on journaling and coaching rather than execution.
          </p>
        </aside>
      </div>
    </OnboardingShell>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white">{label}</span>
      <div className="mt-2 [&_.input]:h-11 [&_.input]:w-full [&_.input]:rounded-xl [&_.input]:border [&_.input]:border-white/[0.08] [&_.input]:bg-[#0A0E1A] [&_.input]:px-3 [&_.input]:text-sm [&_.input]:font-semibold [&_.input]:text-white [&_.input]:outline-none [&_.input]:focus:ring-2 [&_.input]:focus:ring-[#3B82F6]">
        {children}
      </div>
    </label>
  );
}
