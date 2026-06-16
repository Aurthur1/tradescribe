"use client";

import { type FormEvent, useEffect, useState } from "react";
import { fetchSettings, updateDisplayPreferences, type SettingsResponse } from "../../_lib/dashboard-data";
import { SettingsShell } from "../_components/settings-shell";

export default function DisplaySettingsPage() {
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [displayCurrencyAccountId, setDisplayCurrencyAccountId] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(browserTimeZone);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal)
      .then((payload) => {
        setSettings(payload);
        setDisplayCurrencyAccountId(payload.preferences.displayCurrencyAccountId ?? payload.accounts[0]?.id ?? null);
        setTimeZone(payload.preferences.timeZone ?? browserTimeZone);
      })
      .catch(() => setSettings(null));
    return () => controller.abort();
  }, [browserTimeZone]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      await updateDisplayPreferences({ displayCurrencyAccountId, timeZone });
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SettingsShell description="Control how dates and account-currency values are displayed. UTC storage stays unchanged." title="Display">
      <form className="grid gap-5 md:grid-cols-2" onSubmit={onSubmit}>
        <label>
          <span className="text-sm font-bold text-white">Currency display</span>
          <select className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => setDisplayCurrencyAccountId(event.target.value || null)} value={displayCurrencyAccountId ?? ""}>
            <option value="">No connected account</option>
            {settings?.accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} · {account.currency}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs leading-5 text-[#94A3B8]">True FX conversion is out of scope here. Pick which connected account currency should be used for display.</span>
        </label>
        <label>
          <span className="text-sm font-bold text-white">Timezone</span>
          <input className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => setTimeZone(event.target.value)} value={timeZone} />
          <span className="mt-2 block text-xs leading-5 text-[#94A3B8]">Used for period boundaries and session classification display.</span>
        </label>
        <div className="md:col-span-2">
          <button className="h-11 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]" type="submit">
            Save display settings
          </button>
          <span className="ml-3 text-xs font-semibold text-[#94A3B8]">{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Could not save" : ""}</span>
        </div>
      </form>
    </SettingsShell>
  );
}
