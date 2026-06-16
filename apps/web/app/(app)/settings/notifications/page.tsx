"use client";

import { useEffect, useState } from "react";
import { fetchSettings, updateNotificationPreferences, type NotificationPreferenceKey, type NotificationPreferences, type SettingsResponse } from "../../_lib/dashboard-data";
import { SettingsShell } from "../_components/settings-shell";

const rows: Array<{ description: string; key: NotificationPreferenceKey; label: string }> = [
  { description: "High-severity behavioral leak flags that need review.", key: "leak_critical", label: "Leak flags: critical" },
  { description: "Warning-level leak flags such as fast re-entry or overtrading.", key: "leak_warning", label: "Leak flags: warning" },
  { description: "Risk room warnings as you approach configured limits.", key: "guardrail_warning", label: "Guardrail warnings" },
  { description: "Risk room breach alerts when configured limits are exceeded.", key: "guardrail_breach", label: "Guardrail breaches" },
  { description: "A weekly coaching review is ready to read.", key: "weekly_review_ready", label: "Weekly review ready" }
];

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    const controller = new AbortController();
    fetchSettings(controller.signal)
      .then((payload) => {
        setSettings(payload);
        setPrefs(payload.preferences.notificationPreferences);
      })
      .catch(() => setSettings(null));
    return () => controller.abort();
  }, []);

  async function toggle(key: NotificationPreferenceKey, channel: "email" | "inApp") {
    if (!prefs) return;
    const next = { ...prefs, [key]: { ...prefs[key], [channel]: !prefs[key][channel] } };
    setPrefs(next);
    setStatus("saving");
    try {
      await updateNotificationPreferences(next);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <SettingsShell description="Choose which security and coaching events create in-app alerts or email notifications." title="Notifications">
      <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20">
        <div className="grid grid-cols-[1fr_110px_110px] gap-3 border-b border-white/[0.06] px-4 py-3 text-xs font-bold uppercase text-[#64748B]">
          <span>Alert type</span>
          <span>In-app</span>
          <span title={settings?.emailEnabled ? undefined : "Email notifications are not yet enabled"}>Email</span>
        </div>
        {rows.map((row) => (
          <div className="grid grid-cols-[1fr_110px_110px] items-center gap-3 border-b border-white/[0.06] px-4 py-4 last:border-b-0" key={row.key}>
            <div>
              <p className="text-sm font-bold text-white">{row.label}</p>
              <p className="mt-1 text-xs leading-5 text-[#94A3B8]">{row.description}</p>
            </div>
            <Toggle checked={Boolean(prefs?.[row.key]?.inApp)} onClick={() => void toggle(row.key, "inApp")} />
            <Toggle checked={Boolean(prefs?.[row.key]?.email)} disabled={!settings?.emailEnabled} onClick={() => void toggle(row.key, "email")} title={settings?.emailEnabled ? undefined : "Email notifications are not yet enabled"} />
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs font-semibold text-[#94A3B8]">{status === "saving" ? "Saving..." : status === "saved" ? "Saved" : status === "error" ? "Could not save" : settings?.emailEnabled ? "" : "Email notifications are not yet enabled."}</p>
    </SettingsShell>
  );
}

function Toggle({ checked, disabled, onClick, title }: { checked: boolean; disabled?: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      aria-pressed={checked}
      className={`h-7 w-12 rounded-full p-1 transition ${checked ? "bg-[#3B82F6]" : "bg-white/[0.08]"} ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      <span className={`block h-5 w-5 rounded-full bg-white transition ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}
