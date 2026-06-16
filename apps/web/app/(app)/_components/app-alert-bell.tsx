"use client";

import { Bell } from "lucide-react";
import { useMemo, useState } from "react";
import { markAlertRead, useAlerts, type AlertResponse } from "../_lib/dashboard-data";

type ShellAlert = AlertResponse | {
  createdAt: string;
  id: string;
  payload: unknown;
  severity: "info" | "warning";
  type: string;
};

export function AppAlertBell({ sample = false }: { sample?: boolean }) {
  const alerts = useAlerts(true);
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const sampleAlerts = useMemo<ShellAlert[]>(
    () => [
      {
        createdAt: new Date(Date.now() - 1000 * 60 * 38).toISOString(),
        id: "sample-global-alert-leak",
        payload: { type: "revenge_trade" },
        severity: "warning",
        type: "leak_flag"
      }
    ],
    []
  );
  const source = sample ? sampleAlerts : alerts;
  const visible = source.filter((alert) => !readIds.has(alert.id)).slice(0, 10);

  async function markAllRead() {
    const ids = visible.map((alert) => alert.id);
    setReadIds((current) => new Set([...current, ...ids]));
    if (!sample) await Promise.allSettled(ids.map((id) => markAlertRead(id)));
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Open alerts"
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-[#CBD5E1] transition hover:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {visible.length > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#EF4444] px-1 text-[10px] font-bold text-white">
            {visible.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-white/[0.08] bg-[#111827]/98 p-3 shadow-2xl backdrop-blur-xl motion-safe:animate-[menuRise_160ms_ease-out]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">Alerts</p>
            {visible.length > 0 ? (
              <button className="rounded-lg px-2 py-1 text-xs font-semibold text-[#93C5FD] hover:bg-white/[0.05]" onClick={markAllRead} type="button">
                Mark all read
              </button>
            ) : (
              <span className="text-xs font-semibold text-[#94A3B8]">0 unread</span>
            )}
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {visible.length === 0 ? (
              <p className="rounded-xl bg-white/[0.03] p-3 text-sm text-[#94A3B8]">No alerts yet.</p>
            ) : (
              visible.map((alert) => (
                <div className="grid grid-cols-[18px_1fr] gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3" key={alert.id}>
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${alert.severity === "critical" || alert.severity === "breached" ? "bg-[#EF4444]" : alert.severity === "warning" ? "bg-[#F59E0B]" : "bg-[#3B82F6]"}`} aria-hidden />
                  <span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase text-[#94A3B8]">{alert.severity}</span>
                      {sample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-0.5 text-[10px] font-bold text-[#93C5FD]">Sample</span> : null}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-white">{describeAlert(alert)}</span>
                    <span className="mt-1 block text-xs text-[#64748B]">{relativeTime(alert.createdAt)}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function describeAlert(alert: ShellAlert) {
  if (alert.type.includes("guardrail")) return "Risk room status changed.";
  if (alert.type.includes("weekly")) return "Weekly coaching review is ready.";
  if (alert.type.includes("leak")) return "Behavioral leak flag detected.";
  return "New TradeScribe alert.";
}

function relativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
