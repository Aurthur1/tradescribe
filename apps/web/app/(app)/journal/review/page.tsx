"use client";

import { ArrowRight, ChevronDown, LockKeyhole, RefreshCw, Save } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import {
  fetchCoachProfile,
  fetchWeeklyReview,
  fetchWeeklyReviews,
  generateWeeklyReview,
  saveCoachGoals,
  updateAdviceStatus,
  useCurrentUser,
  useMetrics,
  type CoachProfileResponse,
  type WeeklyReview,
  type WeeklyReviewLeak
} from "../../_lib/dashboard-data";
import { SAMPLE_COACH_PROFILE, SAMPLE_WEEKLY_REVIEW } from "../../_lib/dashboard-sample";
import { AccountSwitcher } from "../../_components/account-switcher";

export default function WeeklyReviewPage() {
  return (
    <Suspense fallback={<div className="h-full bg-[#0A0E1A]" />}>
      <WeeklyReviewContent />
    </Suspense>
  );
}

function WeeklyReviewContent() {
  const currentUser = useCurrentUser();
  const plan = currentUser.data?.user.plan ?? "FREE";
  const isAdmin = currentUser.data?.user.role === "ADMIN";
  const accounts = currentUser.data?.accounts ?? [];
  const hasAccounts = Boolean(accounts.length);
  const primaryAccount = accounts.find((account) => account.isPrimary) ?? accounts[0] ?? null;
  const preferredAccountId = currentUser.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null;
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(preferredAccountId);
  const activeAccount = accounts.find((account) => account.id === selectedAccountId) ?? primaryAccount;
  const [reviewState, setReviewState] = useState<{ locked: boolean; review: WeeklyReview | null; canGenerate: boolean; cooldownUntil: string | null }>({
    canGenerate: false,
    cooldownUntil: null,
    locked: !isAdmin && plan === "FREE",
    review: null
  });
  const [profile, setProfile] = useState<CoachProfileResponse>(SAMPLE_COACH_PROFILE);
  const [reviewList, setReviewList] = useState<WeeklyReview[]>([]);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [goals, setGoals] = useState<string[]>(SAMPLE_COACH_PROFILE.profile.goals);
  const [generating, setGenerating] = useState(false);
  const [savingGoals, setSavingGoals] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    setSelectedAccountId(currentUser.data?.preferences.activeAccountId ?? primaryAccount?.id ?? null);
  }, [currentUser.data?.preferences.activeAccountId, primaryAccount?.id]);

  useEffect(() => {
    const controller = new AbortController();
    fetchWeeklyReview(controller.signal, activeAccount?.id ?? null)
      .then((payload) => {
        setReviewState({
          canGenerate: Boolean(payload.canGenerate),
          cooldownUntil: payload.cooldownUntil ?? null,
          locked: payload.locked,
          review: payload.review ?? null
        });
      })
      .catch(() => {
        setReviewState({ canGenerate: false, cooldownUntil: null, locked: !isAdmin && plan === "FREE", review: null });
      });

    fetchWeeklyReviews(controller.signal, activeAccount?.id ?? null)
      .then((payload) => {
        setReviewList(payload.reviews ?? []);
        setSelectedReviewId((current) => current ?? payload.reviews?.[0]?.id ?? null);
      })
      .catch(() => {
        setReviewList([]);
        setSelectedReviewId(null);
      });

    fetchCoachProfile(controller.signal)
      .then((payload) => {
        setProfile(payload);
        setGoals(payload.profile.goals);
      })
      .catch(() => {
        setProfile(SAMPLE_COACH_PROFILE);
        setGoals(SAMPLE_COACH_PROFILE.profile.goals);
      });

    return () => controller.abort();
  }, [activeAccount?.id, isAdmin, plan]);

  const locked = !isAdmin && (reviewState.locked || plan === "FREE");
  const sampleMode = !hasAccounts || locked;
  const selectedReview = selectedReviewId ? reviewList.find((item) => item.id === selectedReviewId) ?? null : null;
  const review = selectedReview ?? reviewState.review ?? SAMPLE_WEEKLY_REVIEW;
  const displayProfile = profile.profile ? profile : SAMPLE_COACH_PROFILE;
  const cooldownLabel = reviewState.cooldownUntil ? `Available ${formatDateTime(reviewState.cooldownUntil)}` : "";
  const reviewIndex = reviewList.findIndex((item) => item.id === review.id);
  const metricsState = useMetrics(activeAccount?.id ?? null, { anchor: review.periodStart, filters: {}, granularity: "week", tz: currentUser.data?.preferences.timeZone ?? "UTC" });
  const goalProgress = buildGoalProgress(goals, metricsState.data?.dailySeries ?? []);

  async function onGenerate() {
    if (locked || !reviewState.canGenerate) return;
    setGenerating(true);
    try {
      const payload = await generateWeeklyReview(activeAccount?.id ?? null);
      setReviewState({
        canGenerate: Boolean(payload.canGenerate),
        cooldownUntil: payload.cooldownUntil ?? null,
        locked: payload.locked,
        review: payload.review ?? null
      });
    } finally {
      setGenerating(false);
    }
  }

  async function onSaveGoals() {
    if (locked) return;
    setSavingGoals("saving");
    try {
      const next = await saveCoachGoals(goals.filter(Boolean));
      setProfile((current) => ({ ...current, profile: next }));
      setSavingGoals("saved");
      window.setTimeout(() => setSavingGoals("idle"), 1400);
    } catch {
      setSavingGoals("error");
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#64748B]">AI Coach</p>
            <h1 className="mt-2 text-[28px] font-bold text-white">{periodLabel(review.periodStart, review.periodEnd)}</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium text-[#94A3B8]">Weekly coaching grounded in computed metrics, deterministic leak flags, and your journal history.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AccountSwitcher
              accounts={accounts}
              activeAccountId={selectedAccountId}
              canUseAllAccounts={isAdmin || plan === "PRO"}
              onAccountChange={setSelectedAccountId}
              plan={plan}
            />
            <button
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#3B82F6] px-4 text-sm font-bold text-white transition hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={locked || !reviewState.canGenerate || generating}
              onClick={onGenerate}
              title={locked ? "Upgrade to unlock weekly AI coaching" : !reviewState.canGenerate ? cooldownLabel || "Generation is cooling down" : undefined}
              type="button"
            >
              <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} aria-hidden />
              Generate new review
            </button>
          </div>
        </header>

        <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-3">
          <div className="flex items-center gap-2">
            <button
              className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.04] disabled:opacity-40"
              disabled={reviewIndex < 0 || reviewIndex >= reviewList.length - 1}
              onClick={() => setSelectedReviewId(reviewList[reviewIndex + 1]?.id ?? selectedReviewId)}
              type="button"
            >
              Previous week
            </button>
            <button
              className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs font-bold text-[#CBD5E1] hover:bg-white/[0.04] disabled:opacity-40"
              disabled={reviewIndex <= 0}
              onClick={() => setSelectedReviewId(reviewList[reviewIndex - 1]?.id ?? selectedReviewId)}
              type="button"
            >
              Next week
            </button>
          </div>
          <div className="flex max-w-full gap-2 overflow-x-auto">
            {(reviewList.length ? reviewList : [SAMPLE_WEEKLY_REVIEW]).slice(0, 12).map((item) => (
              <button
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${item.id === review.id ? "bg-[#3B82F6] text-white" : "bg-white/[0.04] text-[#94A3B8] hover:text-white"}`}
                key={item.id}
                onClick={() => setSelectedReviewId(item.id)}
                type="button"
              >
                {shortPeriodLabel(item.periodStart)}
              </button>
            ))}
          </div>
        </section>

        {locked ? <LockedBanner /> : null}
        {!locked && !reviewState.review ? <EmptyBanner /> : null}

        <div className={`mt-6 grid gap-5 xl:grid-cols-[1fr_360px] ${locked ? "relative" : ""}`}>
          <main className={`space-y-5 ${locked ? "blur-[2px]" : ""}`}>
            <ReviewSummary review={review} sample={sampleMode} />
            <Strengths strengths={review.strengths} />
            <PrioritizedLeaks leaks={review.leaks} />
            <NextActions actions={review.actions} />
          </main>

          <CoachProfilePanel
            advice={displayProfile.advice}
            disabled={locked}
            goals={goals}
            onAdvice={async (id, status) => {
              if (locked) return;
              const updated = await updateAdviceStatus(id, status);
              setProfile((current) => ({
                ...current,
                advice: current.advice.map((item) => (item.id === id ? updated : item))
              }));
            }}
            onGoal={(index, value) => setGoals((current) => current.map((goal, goalIndex) => (goalIndex === index ? value : goal)))}
            goalProgress={goalProgress}
            onSaveGoals={onSaveGoals}
            profile={displayProfile.profile}
            saving={savingGoals}
          />
        </div>

        <footer className="sticky bottom-0 mt-6 rounded-2xl border border-white/[0.06] bg-[#0A0E1A]/95 px-4 py-3 text-center text-xs font-semibold text-[#94A3B8] backdrop-blur">
          Analysis and education only — not investment advice. TradeScribe does not predict markets.
        </footer>
      </div>
    </div>
  );
}

function LockedBanner() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#3B82F6]/20 bg-[#3B82F6]/10 p-4">
      <div className="flex items-center gap-3">
        <LockKeyhole className="h-5 w-5 text-[#93C5FD]" aria-hidden />
        <p className="text-sm font-bold text-white">Upgrade to unlock weekly AI coaching.</p>
      </div>
      <a className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2 text-sm font-bold text-white" href="/settings">
        Upgrade
        <ArrowRight className="h-4 w-4" aria-hidden />
      </a>
    </div>
  );
}

function EmptyBanner() {
  return <p className="mt-6 rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-4 text-sm font-semibold text-[#94A3B8]">Your first coaching review will appear after your first full week of synced trades.</p>;
}

function ReviewSummary({ review, sample }: { review: WeeklyReview; sample: boolean }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-white">Summary</h2>
        {sample ? <span className="rounded-full bg-[#3B82F6]/12 px-2 py-1 text-xs font-bold text-[#93C5FD]">Sample</span> : null}
      </div>
      <p className="mt-4 text-base leading-7 text-[#CBD5E1]">{review.summary}</p>
    </section>
  );
}

function Strengths({ strengths }: { strengths: string[] }) {
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <h2 className="text-xl font-bold text-white">Strengths</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {strengths.map((strength) => (
          <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 text-sm leading-6 text-[#CBD5E1]" key={strength}>{strength}</p>
        ))}
      </div>
    </section>
  );
}

function PrioritizedLeaks({ leaks }: { leaks: WeeklyReviewLeak[] }) {
  const ordered = [...leaks].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return (
    <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-6">
      <h2 className="text-xl font-bold text-white">Prioritized Leaks</h2>
      {ordered.length === 0 ? <p className="mt-4 text-sm font-semibold text-[#94A3B8]">No prioritized leaks in this review.</p> : null}
      <div className="mt-4 space-y-3">
        {ordered.map((leak) => (
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4" key={leak.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-white">{humanLeak(leak.type)}</p>
              <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${severityClass(leak.severity)}`}>{leak.severity}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#CBD5E1]">{leak.explanation}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {leak.tradeIds.map((id) => (
                <a className="rounded-full border border-white/[0.08] px-3 py-1 text-xs font-bold text-[#93C5FD] hover:bg-white/[0.04]" href={`/trades/${id}?from=${encodeURIComponent("/journal/review")}`} key={id}>
                  Trade {id.slice(0, 8)}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NextActions({ actions }: { actions: string[] }) {
  return (
    <section className="rounded-2xl border border-[#3B82F6]/20 bg-[#13213A]/80 p-6 shadow-[0_20px_80px_rgba(59,130,246,0.12)]">
      <h2 className="text-xl font-bold text-white">Next Actions</h2>
      <div className="mt-4 space-y-3">
        {actions.slice(0, 3).map((action, index) => (
          <div className="grid grid-cols-[36px_1fr] gap-4 rounded-2xl bg-[#0A0E1A]/45 p-4" key={action}>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#3B82F6] text-sm font-black text-white">{index + 1}</span>
            <p className="text-lg font-bold leading-7 text-white">{action}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoachProfilePanel({
  advice,
  disabled,
  goalProgress,
  goals,
  onAdvice,
  onGoal,
  onSaveGoals,
  profile,
  saving
}: {
  advice: CoachProfileResponse["advice"];
  disabled: boolean;
  goalProgress: Array<{ goal: string; label: string; tone: "neutral" | "warning" }>;
  goals: string[];
  onAdvice: (id: string, status: "pending" | "did_this" | "didnt_do_this") => void;
  onGoal: (index: number, value: string) => void;
  onSaveGoals: () => void;
  profile: CoachProfileResponse["profile"];
  saving: "idle" | "saving" | "saved" | "error";
}) {
  return (
    <aside className="space-y-5">
      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-5">
        <h2 className="text-lg font-bold text-white">Coach Profile</h2>
        <div className="mt-4 space-y-3">
          {profile.recurringLeaks.map((item) => (
            <div className="rounded-xl bg-white/[0.03] p-3" key={item.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#CBD5E1]">{item.label}: {item.count} of last {item.weeks} weeks</p>
                <LeakTrend values={item.trend ?? trendFromCount(item.count, item.weeks)} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm leading-6 text-[#94A3B8]">{profile.riskProfileSummary}</p>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white">Goals</h2>
          <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-[#93C5FD] hover:bg-white/[0.04] disabled:opacity-40" disabled={disabled} onClick={onSaveGoals} type="button">
            <Save className="h-3.5 w-3.5" aria-hidden />
            {saving === "saving" ? "Saving" : saving === "saved" ? "Saved" : "Save"}
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {goals.map((goal, index) => (
            <div key={index}>
              <input className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0A0E1A] px-3 text-sm font-semibold text-white outline-none focus:ring-2 focus:ring-[#3B82F6] disabled:opacity-50" disabled={disabled} onChange={(event) => onGoal(index, event.target.value)} value={goal} />
              {goalProgress[index] ? <p className={`mt-1 text-[11px] font-bold ${goalProgress[index].tone === "warning" ? "text-[#FCD34D]" : "text-[#94A3B8]"}`}>{goalProgress[index].label}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-[#141A2A]/70 p-5">
        <details>
          <summary className="flex cursor-pointer list-none items-center justify-between text-lg font-bold text-white">
            Advice history
            <ChevronDown className="h-4 w-4 text-[#94A3B8]" aria-hidden />
          </summary>
          <div className="mt-4 space-y-3">
            {advice.map((item) => (
              <div className="rounded-xl bg-white/[0.03] p-3" key={item.id}>
                <p className="text-sm leading-6 text-[#CBD5E1]">{item.text}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button className={`rounded-lg px-2 py-1.5 text-xs font-bold ${item.status === "did_this" ? "bg-[#22C55E]/15 text-[#86EFAC]" : "bg-white/[0.04] text-[#94A3B8]"}`} disabled={disabled} onClick={() => onAdvice(item.id, "did_this")} type="button">
                    Done
                  </button>
                  <button className={`rounded-lg px-2 py-1.5 text-xs font-bold ${item.status === "didnt_do_this" ? "bg-[#EF4444]/15 text-[#FCA5A5]" : "bg-white/[0.04] text-[#94A3B8]"}`} disabled={disabled} onClick={() => onAdvice(item.id, "didnt_do_this")} type="button">
                    Not done
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      </section>
    </aside>
  );
}

function LeakTrend({ values }: { values: number[] }) {
  return (
    <div className="flex items-end gap-1" aria-label="Recurring leak trend">
      {values.slice(-6).map((value, index) => (
        <span className={`block w-1.5 rounded-full ${value > 0 ? "bg-[#3B82F6]" : "bg-white/[0.12]"}`} key={`${value}-${index}`} style={{ height: `${8 + Math.min(3, value) * 4}px` }} />
      ))}
    </div>
  );
}

function trendFromCount(count: number, weeks: number) {
  return Array.from({ length: weeks }, (_, index) => (index >= weeks - count ? 1 : 0));
}

function buildGoalProgress(goals: string[], dailySeries: Array<{ date: string; tradeCount: number }>) {
  return goals.map((goal) => {
    const match = goal.match(/max\s+(\d+)\s+trades?\/day/i);
    if (!match) return { goal, label: "Progress tracking will appear when this goal maps to deterministic metrics.", tone: "neutral" as const };
    const limit = Number(match[1]);
    const breached = dailySeries.filter((day) => day.tradeCount > limit);
    return {
      goal,
      label: breached.length ? `${breached.length} day${breached.length === 1 ? "" : "s"} breached this week` : "No days breached this week",
      tone: breached.length ? ("warning" as const) : ("neutral" as const)
    };
  });
}

function shortPeriodLabel(start: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(start));
}

function periodLabel(start: string, end: string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startLabel = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(startDate);
  const endLabel = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "UTC", year: "numeric" }).format(endDate);
  return `Week of ${startLabel} - ${endLabel}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short" }).format(new Date(value));
}

function severityRank(severity: string) {
  return { critical: 0, warning: 1, info: 2 }[severity as "critical" | "warning" | "info"] ?? 3;
}

function severityClass(severity: string) {
  if (severity === "critical") return "bg-[#EF4444]/15 text-[#FCA5A5]";
  if (severity === "warning") return "bg-[#F59E0B]/15 text-[#FCD34D]";
  return "bg-[#3B82F6]/15 text-[#93C5FD]";
}

function humanLeak(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
