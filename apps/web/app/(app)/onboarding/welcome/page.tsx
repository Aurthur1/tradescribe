"use client";

import { ArrowRight, DatabaseZap, ShieldCheck, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { markOnboarding } from "../../_lib/dashboard-data";
import { OnboardingButton, OnboardingShell } from "../_components/onboarding-shell";

export default function OnboardingWelcomePage() {
  const router = useRouter();

  async function exploreSample() {
    try {
      await markOnboarding("start_sample");
    } finally {
      router.replace("/dashboard");
    }
  }

  return (
    <OnboardingShell>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#3B82F6]/20 bg-[#3B82F6]/10 px-3 py-1 text-xs font-bold text-[#BFDBFE]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Read-only by design
          </span>
          <h2 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl">TradeScribe connects read-only to your MT4/MT5 account.</h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[#CBD5E1]">
            It auto-journals your trades, surfaces behavioral leaks, and gives you a weekly coaching review. No trade execution, ever.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <OnboardingButton href="/onboarding/connect">
              Connect my account
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </OnboardingButton>
            <button className="h-11 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.06]" onClick={() => void exploreSample()} type="button">
              Explore with sample data first
            </button>
          </div>
        </div>

        <div className="grid gap-3">
          {[
            { body: "Investor credentials let TradeScribe read account history without placing or modifying trades.", icon: ShieldCheck, title: "Investor access only" },
            { body: "Closed trades become metrics, journal entries, and reviewable behavior patterns.", icon: DatabaseZap, title: "Automatic journaling" },
            { body: "The AI coach explains computed evidence. It does not predict markets.", icon: Sparkles, title: "Weekly review" }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4" key={item.title}>
                <Icon className="h-5 w-5 text-[#60A5FA]" aria-hidden />
                <h3 className="mt-3 text-sm font-bold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#94A3B8]">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </OnboardingShell>
  );
}
