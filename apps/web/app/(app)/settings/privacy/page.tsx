"use client";

import { AlertTriangle, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { deleteMyAccount, exportMyData } from "../../_lib/dashboard-data";
import { SettingsShell } from "../_components/settings-shell";

export default function PrivacySettingsPage() {
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");

  async function downloadExport() {
    setStatus("Preparing export...");
    try {
      const payload = await exportMyData();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tradescribe-export-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus("Export downloaded");
    } catch {
      setStatus("Could not export data");
    }
  }

  async function confirmDelete() {
    setStatus("Deleting account...");
    try {
      await deleteMyAccount(confirmation);
      window.location.href = "/";
    } catch {
      setStatus("Confirmation did not match or deletion failed.");
    }
  }

  return (
    <SettingsShell description="Export your data or permanently delete the account and all connected trading records." title="Privacy & Data">
      <div className="grid gap-5">
        <section className="rounded-2xl border border-white/[0.06] bg-black/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white">Export my data</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#94A3B8]">Download a JSON bundle of your profile, connections, accounts, trades, notes, screenshots, journal entries, playbooks, and weekly reviews.</p>
            </div>
            <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#3B82F6] px-4 text-sm font-bold text-white hover:bg-[#2563EB]" onClick={() => void downloadExport()} type="button">
              <Download className="h-4 w-4" aria-hidden />
              Export my data
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EF4444]/12 text-[#FCA5A5]">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-lg font-bold text-white">Delete my account</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#FCA5A5]">This purges trades, notes, screenshots, broker connections, prop rules, reviews, alerts, and the linked MetaApi account references.</p>
              </div>
            </div>
            <button className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#EF4444] px-4 text-sm font-bold text-white hover:bg-[#DC2626]" onClick={() => setConfirmationOpen(true)} type="button">
              <Trash2 className="h-4 w-4" aria-hidden />
              Delete account
            </button>
          </div>
        </section>
        {status ? <p className="text-xs font-semibold text-[#94A3B8]">{status}</p> : null}
      </div>

      {confirmationOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-5 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#111827] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <h3 className="text-xl font-bold text-white">Confirm account deletion</h3>
            <p className="mt-2 text-sm leading-6 text-[#94A3B8]">Type <strong className="text-white">DELETE MY ACCOUNT</strong> to permanently delete this TradeScribe account and its data.</p>
            <input className="mt-4 h-11 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#EF4444]" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" onClick={() => setConfirmationOpen(false)} type="button">
                Cancel
              </button>
              <button className="rounded-xl bg-[#EF4444] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#DC2626] disabled:cursor-not-allowed disabled:opacity-50" disabled={confirmation !== "DELETE MY ACCOUNT"} onClick={() => void confirmDelete()} type="button">
                Permanently delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </SettingsShell>
  );
}
