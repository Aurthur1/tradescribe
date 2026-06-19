"use client";

import { AlertTriangle, Check, Pencil, PlugZap, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { disconnectConnection, fetchConnections, saveAccountLabel, syncConnection, type ConnectionsResponse } from "../../_lib/dashboard-data";
import { formatCurrency } from "../../_lib/format";
import { SettingsShell } from "../_components/settings-shell";

export default function ConnectionsPage() {
  const [payload, setPayload] = useState<ConnectionsResponse | null>(null);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [disconnectTarget, setDisconnectTarget] = useState<ConnectionsResponse["connections"][number] | null>(null);
  const [deleteHistory, setDeleteHistory] = useState(false);
  const [status, setStatus] = useState<string>("");
  const accountCount = payload?.limits.accountCount ?? 0;
  const canConnectMore = payload?.limits.canConnectMore ?? true;

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      setPayload(await fetchConnections());
    } catch {
      setPayload(null);
    }
  }

  async function saveLabel(accountId: string) {
    setStatus("Saving label...");
    try {
      await saveAccountLabel(accountId, editing[accountId] ?? null);
      await refresh();
      setEditing((current) => {
        const next = { ...current };
        delete next[accountId];
        return next;
      });
      setStatus("Label saved");
    } catch {
      setStatus("Could not save label");
    }
  }

  async function reSync(connectionId: string) {
    setStatus("Sync queued...");
    try {
      await syncConnection(connectionId);
      await refresh();
      setStatus("Sync queued");
    } catch {
      setStatus("Could not queue sync");
    }
  }

  async function confirmDisconnect() {
    if (!disconnectTarget) return;
    setStatus("Disconnecting...");
    try {
      await disconnectConnection(disconnectTarget.id, deleteHistory);
      setDisconnectTarget(null);
      setDeleteHistory(false);
      await refresh();
      setStatus(deleteHistory ? "Connection and trade history removed" : "Connection disconnected");
    } catch {
      setStatus("Could not disconnect");
    }
  }

  return (
    <SettingsShell description="Manage live adapters, CSV imports, account labels, sync status, and read-only broker access." title="Connections">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <a
            aria-disabled={!canConnectMore}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ${
              canConnectMore ? "bg-[#3B82F6] text-white shadow-[0_14px_36px_rgba(59,130,246,0.22)]" : "pointer-events-none border border-white/[0.08] bg-white/[0.03] text-[#64748B]"
            }`}
            href={canConnectMore ? "/import" : "/settings"}
          >
            <PlugZap className="h-4 w-4" aria-hidden />
            Connect or import account
          </a>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-semibold text-[#CBD5E1]">
              {accountCount}{payload?.limits.maxAccounts ? ` / ${payload.limits.maxAccounts}` : ""} accounts
            </span>
            {!canConnectMore ? <span className="rounded-full bg-[#3B82F6]/12 px-3 py-1 text-xs font-bold text-[#93C5FD]">Plan limit reached — upgrade to add another account</span> : null}
            {status ? <span className="text-xs font-semibold text-[#94A3B8]">{status}</span> : null}
          </div>
        </div>

        <section className="mt-6 space-y-4">
          {!payload ? <p className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-5 text-sm font-semibold text-[#94A3B8]">Loading connections...</p> : null}
          {payload?.connections.length === 0 ? <p className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-5 text-sm font-semibold text-[#94A3B8]">No broker connections yet.</p> : null}
          {payload?.connections.map((connection) => (
            <ConnectionCard
              connection={connection}
              editing={editing}
              key={connection.id}
              onCancelEdit={(accountId) =>
                setEditing((current) => {
                  const next = { ...current };
                  delete next[accountId];
                  return next;
                })
              }
              onDisconnect={() => setDisconnectTarget(connection)}
              onEdit={(accountId, value) => setEditing((current) => ({ ...current, [accountId]: value }))}
              onSave={saveLabel}
              onSync={reSync}
            />
          ))}
        </section>
      </div>

      {disconnectTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111827] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EF4444]/12 text-[#FCA5A5]">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white">Disconnect this broker connection?</h2>
                <p className="mt-2 text-sm leading-6 text-[#94A3B8]">
                  This deletes the MetaApi account and stops future syncing. Historical TradeScribe trade data remains unless you explicitly choose to delete it too.
                </p>
              </div>
            </div>
            <label className="mt-5 flex gap-3 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/8 p-3 text-sm font-semibold text-[#FCA5A5]">
              <input checked={deleteHistory} className="mt-1" onChange={(event) => setDeleteHistory(event.target.checked)} type="checkbox" />
              Also delete all historical trade data for this connection.
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => setDisconnectTarget(null)} type="button">
                Cancel
              </button>
              <button className="rounded-xl bg-[#EF4444] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#DC2626]" onClick={() => void confirmDisconnect()} type="button">
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsShell>
  );
}

function ConnectionCard({
  connection,
  editing,
  onCancelEdit,
  onDisconnect,
  onEdit,
  onSave,
  onSync
}: {
  connection: ConnectionsResponse["connections"][number];
  editing: Record<string, string>;
  onCancelEdit: (accountId: string) => void;
  onDisconnect: () => void;
  onEdit: (accountId: string, value: string) => void;
  onSave: (accountId: string) => void | Promise<void>;
  onSync: (connectionId: string) => void | Promise<void>;
}) {
  const platformLabel = useMemo(() => connection.accounts.map((account) => account.platform).filter(Boolean).join(", ") || "MT", [connection.accounts]);
  return (
    <article className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusDot status={connection.status} />
            <h2 className="text-lg font-bold text-white">{connection.provider}</h2>
            <span className="rounded-full border border-white/[0.08] px-2 py-1 text-[11px] font-bold text-[#94A3B8]">{platformLabel}</span>
            <span className="rounded-full bg-[#3B82F6]/12 px-2 py-1 text-[11px] font-bold uppercase text-[#93C5FD]">Read-only</span>
          </div>
          <p className="mt-2 text-sm font-medium text-[#94A3B8]">Last sync {formatTime(connection.lastSyncAt)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CapabilityChips capabilities={connection.capabilities} />
          </div>
          {connection.lastError ? <p className="mt-2 max-w-xl text-sm font-semibold text-[#FCA5A5]">{connection.lastError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => void onSync(connection.id)} type="button">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Re-sync now
          </button>
          {connection.status === "DEGRADED" || connection.status === "DISCONNECTED" ? (
            <a className="inline-flex items-center gap-2 rounded-xl border border-[#3B82F6]/25 px-3 py-2 text-sm font-bold text-[#93C5FD] hover:bg-[#3B82F6]/10" href="/import">
              Reconnect
            </a>
          ) : null}
          <button className="inline-flex items-center gap-2 rounded-xl border border-[#EF4444]/20 px-3 py-2 text-sm font-bold text-[#FCA5A5] hover:bg-[#EF4444]/10" onClick={onDisconnect} type="button">
            <Trash2 className="h-4 w-4" aria-hidden />
            Disconnect
          </button>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06] bg-black/20">
        <div className="hidden grid-cols-[1.2fr_0.5fr_0.7fr_0.8fr_1fr_auto] gap-3 border-b border-white/[0.06] px-4 py-3 text-[11px] font-bold uppercase text-[#64748B] md:grid">
          <span>Account</span>
          <span>Platform</span>
          <span>Login</span>
          <span>Balance</span>
          <span>Capabilities</span>
          <span className="text-right">Actions</span>
        </div>
        {connection.accounts.map((account) => {
          const editValue = editing[account.id];
          const isEditing = editValue !== undefined;
          return (
            <div className="grid gap-3 border-b border-white/[0.06] p-4 text-sm last:border-b-0 md:grid-cols-[1.2fr_0.5fr_0.7fr_0.8fr_1fr_auto]" key={account.id}>
              <div className="min-w-0">
                {isEditing ? (
                  <input className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6]" onChange={(event) => onEdit(account.id, event.target.value)} value={editValue} />
                ) : (
                  <>
                    <p className="truncate font-bold text-white">{account.name}</p>
                    <p className="mt-1 text-xs text-[#64748B]">Label fallback: {account.broker} #{account.maskedLogin}</p>
                  </>
                )}
              </div>
              <span className="w-fit rounded-full border border-white/[0.08] px-2 py-1 text-xs font-bold text-[#CBD5E1]">{account.platform}</span>
              <span className="font-semibold text-[#94A3B8]">#{account.maskedLogin}</span>
              <span className="font-bold text-white tabular-nums">{formatCurrency(account.balance ?? 0, account.currency)}</span>
              <div className="flex flex-wrap gap-1">
                <CapabilityChips capabilities={account.capabilities} compact />
              </div>
              <div className="flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <button className="grid h-9 w-9 place-items-center rounded-xl bg-[#3B82F6] text-white" onClick={() => void onSave(account.id)} type="button" aria-label="Save label">
                      <Check className="h-4 w-4" aria-hidden />
                    </button>
                    <button className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] text-[#CBD5E1]" onClick={() => onCancelEdit(account.id)} type="button" aria-label="Cancel label edit">
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </>
                ) : (
                  <button className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => onEdit(account.id, account.label ?? "")} type="button">
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit label
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function StatusDot({ status }: { status?: string }) {
  const color =
    status === "CONNECTED"
      ? "bg-[#22C55E]"
      : status === "SYNCING" || status === "PROVISIONING" || status === "PENDING"
        ? "bg-[#F59E0B]"
        : status === "DEGRADED" || status === "ERROR" || status === "DISCONNECTED"
          ? "bg-[#EF4444]"
          : "bg-[#64748B]";
  const pulse = status === "CONNECTED" || status === "SYNCING" || status === "PROVISIONING";
  return <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color} ${pulse ? "animate-pulse" : ""}`} aria-hidden />;
}

function CapabilityChips({ capabilities, compact }: { capabilities?: ConnectionsResponse["connections"][number]["capabilities"]; compact?: boolean }) {
  const entries = Object.entries(capabilities ?? {}).filter(([, value]) => value);
  if (!entries.length) return <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] font-bold uppercase text-[#64748B]">Limited</span>;
  return (
    <>
      {entries.map(([key]) => (
        <span className={`rounded-full bg-[#3B82F6]/12 font-bold uppercase text-[#93C5FD] ${compact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[10px]"}`} key={key}>
          {key.replace(/([A-Z])/g, " $1")}
        </span>
      ))}
    </>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "not yet";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
