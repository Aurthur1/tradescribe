"use client";

import { CheckCircle2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { markOnboarding } from "../../_lib/dashboard-data";
import { OnboardingShell } from "../_components/onboarding-shell";

export default function OnboardingDonePage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <OnboardingDoneContent />
    </Suspense>
  );
}

function OnboardingDoneContent() {
  const router = useRouter();
  const accountId = useSearchParams().get("account");

  async function finish() {
    await markOnboarding("complete");
    router.replace("/dashboard");
  }

  return (
    <OnboardingShell activeFlow>
      <div className="mx-auto max-w-2xl text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[#22C55E]" aria-hidden />
        <h2 className="mt-5 text-3xl font-bold text-white">You&apos;re set up.</h2>
        <p className="mt-3 text-base leading-7 text-[#CBD5E1]">
          Your read-only account is connected{accountId ? " and set as your active dashboard account" : ""}. TradeScribe will organize synced trades into metrics, leak flags, and weekly coaching reviews.
        </p>
        <button className="mt-7 h-11 rounded-xl bg-[#3B82F6] px-5 text-sm font-bold text-white hover:bg-[#2563EB]" onClick={() => void finish()} type="button">
          Go to dashboard
        </button>
      </div>
    </OnboardingShell>
  );
}
