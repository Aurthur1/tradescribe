"use client";

import { ShieldCheck } from "lucide-react";
import { useCurrentUser } from "../_lib/dashboard-data";

export default function AdminPage() {
  const { data } = useCurrentUser();
  const isAdmin = data?.user.role === "ADMIN";

  return (
    <div className="h-full min-h-0 overflow-y-auto px-4 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-5xl rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#3B82F6]/12 text-[#93C5FD]">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-[#64748B]">TradeScribe</p>
            <h1 className="text-[28px] font-bold text-white">Admin</h1>
          </div>
        </div>

        {isAdmin ? (
          <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/20 p-5 text-sm font-semibold leading-6 text-[#CBD5E1]">
            Admin shell is available. Server-side admin endpoints are protected by `AuthGuard` plus `AdminGuard`.
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-[#EF4444]/20 bg-[#EF4444]/10 p-5 text-sm font-semibold leading-6 text-[#FCA5A5]">
            Admin access is required.
          </div>
        )}
      </div>
    </div>
  );
}
