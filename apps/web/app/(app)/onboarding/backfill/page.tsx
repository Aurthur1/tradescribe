"use client";

import { CheckCircle2, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchConnectionStatus } from "../../_lib/dashboard-data";
import { OnboardingShell } from "../_components/onboarding-shell";

export default function OnboardingBackfillPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <OnboardingBackfillContent />
    </Suspense>
  );
}

function OnboardingBackfillContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const connectionId = searchParams.get("connection") ?? "";
  const accountId = searchParams.get("account") ?? "";
  const [status, setStatus] = useState("SYNCING");

  useEffect(() => {
    if (!connectionId) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      fetchConnectionStatus(connectionId, controller.signal)
        .then((connection) => setStatus(connection.status))
        .catch(() => setStatus("SYNCING"));
    }, 1200);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [connectionId]);

  return (
    <OnboardingShell activeFlow>
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1fr] lg:items-center">
        <div className="rounded-3xl border border-white/[0.06] bg-black/20 p-8 text-center">
          {status === "CONNECTED" ? <CheckCircle2 className="mx-auto h-14 w-14 text-[#22C55E]" aria-hidden /> : <RefreshCw className="mx-auto h-14 w-14 animate-spin text-[#60A5FA]" aria-hidden />}
          <h2 className="mt-5 text-2xl font-bold text-white">{status === "CONNECTED" ? "Backfill is ready." : "Backfilling your trade history..."}</h2>
          <p className="mt-2 text-sm leading-6 text-[#94A3B8]">This usually takes a moment. You can set prop rules next while TradeScribe finishes organizing the account.</p>
          <button
            className="mt-6 h-11 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]"
            onClick={() => router.push(`/onboarding/prop-rules?account=${accountId}&flow=connect`)}
            type="button"
          >
            Continue
          </button>
        </div>

        <div className="space-y-3">
          {[
            ["Auto-journaling", "Closed trades are converted into structured journal entries and reviewable evidence."],
            ["Weekly review", "Your AI coach explains computed performance, leaks, and next actions."],
            ["Leak detection", "Deterministic checks flag patterns like fast re-entry, overtrading, and missing stops."]
          ].map(([title, body]) => (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4" key={title}>
              <h3 className="text-sm font-bold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </OnboardingShell>
  );
}
