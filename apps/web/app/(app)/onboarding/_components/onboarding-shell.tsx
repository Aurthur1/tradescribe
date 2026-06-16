"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { fetchOnboardingStatus } from "../../_lib/dashboard-data";

const steps = [
  { href: "/onboarding/welcome", label: "Welcome" },
  { href: "/onboarding/connect", label: "Connect" },
  { href: "/onboarding/backfill", label: "Backfill" },
  { href: "/onboarding/prop-rules", label: "Rules" },
  { href: "/onboarding/done", label: "Done" }
];

export function OnboardingShell({ activeFlow = false, children }: { activeFlow?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeIndex = Math.max(0, steps.findIndex((step) => pathname.startsWith(step.href)));

  useEffect(() => {
    const controller = new AbortController();
    fetchOnboardingStatus(controller.signal)
      .then((status) => {
        if (status.hasConnections && !activeFlow) router.replace("/dashboard");
        if (!status.shouldShowOnboarding && !status.shouldShowFinishSetupPrompt && !activeFlow) router.replace("/dashboard");
      })
      .catch(() => {
        // Let local sample mode render when the API is offline.
      });
    return () => controller.abort();
  }, [activeFlow, router]);

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto flex min-h-full max-w-5xl flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">First run</p>
            <h1 className="mt-2 text-[28px] font-bold text-white">Set up TradeScribe</h1>
          </div>
          {activeIndex > 0 ? (
            <Link className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-sm font-bold text-[#CBD5E1] hover:bg-white/[0.05]" href="/onboarding/welcome">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Link>
          ) : null}
        </header>

        <div className="mt-6 rounded-2xl border border-white/[0.06] bg-[#111827]/65 p-4">
          <div className="grid gap-2 sm:grid-cols-5">
            {steps.map((step, index) => (
              <div className="flex items-center gap-2" key={step.href}>
                <span className={`h-2.5 flex-1 rounded-full ${index <= activeIndex ? "bg-[#3B82F6]" : "bg-white/[0.08]"}`} />
                <span className={`hidden text-xs font-bold sm:block ${index === activeIndex ? "text-white" : "text-[#64748B]"}`}>{step.label}</span>
              </div>
            ))}
          </div>
        </div>

        <main className="mt-6 flex-1 rounded-3xl border border-white/[0.06] bg-[#141A2A]/75 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export function OnboardingButton({ children, href, secondary }: { children: ReactNode; href: string; secondary?: boolean }) {
  return (
    <Link
      className={`inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-bold transition ${
        secondary ? "border border-white/[0.08] bg-white/[0.03] text-[#CBD5E1] hover:bg-white/[0.06]" : "bg-[#3B82F6] text-white shadow-[0_14px_36px_rgba(59,130,246,0.22)] hover:bg-[#2563EB]"
      }`}
      href={href}
    >
      {children}
    </Link>
  );
}
