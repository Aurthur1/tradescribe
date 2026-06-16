import {
  buildJournalEntryPrompt,
  buildWeeklyReviewPrompt,
  getProvider,
  JournalEntrySchema,
  recordTokens,
  selectRepresentativeTrades,
  validateWeeklyReviewOutput,
  WeeklyReviewSchema,
  type WeeklyReviewInput
} from "@tradescribe/ai";
import { getPrismaClient } from "@tradescribe/db";
import { computeMetrics, type MetricsTrade } from "@tradescribe/metrics";

const JOURNAL_BATCH_SIZE = 25;

interface Delegate {
  create(input: unknown): Promise<unknown>;
  findFirst(input: unknown): Promise<unknown>;
  findMany(input: unknown): Promise<unknown>;
  findUnique(input: unknown): Promise<unknown>;
  update(input: unknown): Promise<unknown>;
  upsert(input: unknown): Promise<unknown>;
}

interface Prisma {
  $transaction<T>(operations: Promise<T>[]): Promise<T[]>;
  adviceLog: Delegate;
  alert: Delegate;
  coachProfile: Delegate;
  equitySnapshot: Delegate;
  journalEntry: Delegate;
  leakFlag: Delegate;
  trade: Delegate;
  tradingAccount: Delegate;
  weeklyReview: Delegate;
}

interface TradeRow extends MetricsTrade {
  id: string;
  tradingAccountId: string;
  closeTime: Date;
  openTime: Date;
  grossProfit: number;
  commission: number;
  swap: number;
  session?: string | null;
  notes?: Array<{ body: string }>;
}

interface AccountRow {
  id: string;
  startingBalance: number;
  brokerConnection: { userId: string; user: { preferences?: { timeZone?: string | null } | null } };
}

interface BudgetStore {
  get(key: string): Promise<string | null>;
  incrBy(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

function toMetricsTrade(row: TradeRow): MetricsTrade {
  return {
    closePrice: row.closePrice,
    closeTime: row.closeTime,
    commission: row.commission,
    durationSec: row.durationSec,
    grossProfit: row.grossProfit,
    id: row.id,
    openPrice: row.openPrice,
    openTime: row.openTime,
    riskAmount: row.riskAmount,
    rMultiple: row.rMultiple,
    side: row.side,
    stopLoss: row.stopLoss,
    swap: row.swap,
    symbol: row.symbol,
    takeProfit: row.takeProfit,
    volume: row.volume
  };
}

function netProfit(row: TradeRow) {
  return row.grossProfit + row.commission + row.swap;
}

function summaryFromJournal(observed: string, inferred: string) {
  return `Observed: ${observed}\n\nInferred: ${inferred}`;
}

function startOfPreviousWeek(now: Date, _timeZone = "UTC") {
  // Period boundaries are UTC approximations for now; display timezone is carried into metrics bucketing.
  const current = new Date(now);
  current.setUTCHours(0, 0, 0, 0);
  current.setUTCDate(current.getUTCDate() - current.getUTCDay() - 7);
  return current;
}

function endOfWeek(start: Date) {
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return end;
}

function recurringRecord(value: unknown): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, number>;
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [String((item as { label?: string }).label ?? "unknown"), Number((item as { count?: number }).count ?? 0)]));
  }
  return {};
}

function adviceStatus(status: string): "done" | "not_done" | "unmarked" {
  if (status === "did_this" || status === "done") return "done";
  if (status === "didnt_do_this" || status === "not_done") return "not_done";
  return "unmarked";
}

function serializeReviewForLegacy(report: { prioritizedLeaks: Array<{ type: string; severity: string; explanation: string; evidenceTradeIds: string[] }>; nextActions: string[]; strengths: string[]; summary: string }) {
  return {
    actions: report.nextActions,
    leaks: report.prioritizedLeaks.map((leak, index) => ({
      evidence: {},
      explanation: leak.explanation,
      id: `${leak.type}-${index}`,
      severity: leak.severity,
      tradeIds: leak.evidenceTradeIds,
      type: leak.type
    })),
    strengths: report.strengths,
    summary: report.summary
  };
}

export async function runJournalGenerateJob(data: { tradingAccountId: string; limit?: number; tradeIds?: string[]; budgetStore?: BudgetStore }) {
  const prisma = (await getPrismaClient()) as unknown as Prisma;
  const account = (await prisma.tradingAccount.findUnique({
    where: { id: data.tradingAccountId },
    include: { brokerConnection: true }
  })) as { id: string; brokerConnection: { userId: string } } | null;
  if (!account) return { created: 0 };

  const trades = (await prisma.trade.findMany({
    where: {
      tradingAccountId: data.tradingAccountId,
      ...(data.tradeIds?.length ? { id: { in: data.tradeIds } } : {}),
      journalEntry: null
    },
    include: { notes: true },
    orderBy: { closeTime: "asc" },
    take: data.limit ?? JOURNAL_BATCH_SIZE
  })) as TradeRow[];
  if (!trades.length) return { created: 0 };

  const provider = getProvider();
  let created = 0;

  for (const trade of trades) {
    const leakFlags = (await prisma.leakFlag.findMany({
      where: { tradingAccountId: data.tradingAccountId, tradeIds: { has: trade.id } },
      orderBy: { createdAt: "desc" },
      take: 8
    })) as Array<{ id: string; type: string; severity: string; tradeIds: string[]; evidence: unknown }>;
    const prompt = buildJournalEntryPrompt({ ...toMetricsTrade(trade), notes: trade.notes, session: trade.session }, leakFlags);
    const result = await provider.generateStructured({ ...prompt, maxTokens: 700, schema: JournalEntrySchema });
    await prisma.journalEntry.create({
      data: {
        inferred: result.data.inferred,
        model: provider.model,
        observed: result.data.observed,
        summary: summaryFromJournal(result.data.observed, result.data.inferred),
        tokensUsed: result.tokensUsed,
        tradeId: trade.id
      }
    });
    if (data.budgetStore) await recordTokens(data.budgetStore, account.brokerConnection.userId, result.tokensUsed);
    created += 1;
  }

  return { created };
}

export async function runWeeklyReviewJob(data: { tradingAccountId: string; periodStart?: string; periodEnd?: string; scheduled?: boolean; budgetStore?: BudgetStore }) {
  const prisma = (await getPrismaClient()) as unknown as Prisma;
  const account = (await prisma.tradingAccount.findUnique({
    where: { id: data.tradingAccountId },
    include: { brokerConnection: { include: { user: { include: { preferences: true } } } } }
  })) as AccountRow | null;
  if (!account) return { review: null };

  const timeZone = account.brokerConnection.user.preferences?.timeZone ?? "UTC";
  const periodStart = data.periodStart ? new Date(data.periodStart) : startOfPreviousWeek(new Date(), timeZone);
  const periodEnd = data.periodEnd ? new Date(data.periodEnd) : endOfWeek(periodStart);
  const [trades, snapshots, leakFlags, profile, advice] = (await prisma.$transaction([
    prisma.trade.findMany({
      where: { tradingAccountId: account.id, closeTime: { gte: periodStart, lt: periodEnd } },
      include: { notes: true },
      orderBy: { closeTime: "asc" }
    }),
    prisma.equitySnapshot.findMany({ where: { tradingAccountId: account.id, ts: { gte: periodStart, lt: periodEnd } }, orderBy: { ts: "asc" } }),
    prisma.leakFlag.findMany({
      where: { tradingAccountId: account.id, OR: [{ periodStart: { gte: periodStart, lt: periodEnd } }, { createdAt: { gte: periodStart, lt: periodEnd } }] },
      orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
    }),
    prisma.coachProfile.upsert({
      create: { goals: [], recurringLeaks: {}, riskProfileSummary: "Risk profile is still forming.", userId: account.brokerConnection.userId },
      update: {},
      where: { userId: account.brokerConnection.userId }
    }),
    prisma.adviceLog.findMany({ where: { userId: account.brokerConnection.userId }, orderBy: { createdAt: "desc" }, take: 12 })
  ])) as [
    TradeRow[],
    Array<{ ts: Date; equity: number; balance: number }>,
    Array<{ id: string; type: string; severity: "info" | "warning" | "critical"; tradeIds: string[]; evidence: unknown }>,
    { goals: unknown; recurringLeaks: unknown; riskProfileSummary: string },
    Array<{ text: string; status: string; weekStart: Date | null; createdAt: Date }>
  ];

  const metricResult = computeMetrics({
    equitySnapshots: snapshots,
    startingBalance: account.startingBalance,
    timeZone,
    trades: trades.map(toMetricsTrade)
  });
  const representativeRows = selectRepresentativeTrades(trades, leakFlags);
  const input: WeeklyReviewInput = {
    coachProfile: {
      adviceLog: advice.map((item) => ({
        advice: item.text,
        status: adviceStatus(item.status),
        week: (item.weekStart ?? item.createdAt).toISOString().slice(0, 10)
      })),
      goals: Array.isArray(profile.goals) ? profile.goals.map(String) : [],
      recurringLeaks: recurringRecord(profile.recurringLeaks)
    },
    leakFlags,
    metrics: {
      ...metricResult,
      byDayOfWeek: metricResult.byDayOfWeek,
      bySession: metricResult.bySession,
      drawdown: metricResult.drawdown
    },
    period: { end: periodEnd.toISOString(), label: `${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`, start: periodStart.toISOString() },
    representativeTrades: representativeRows.map((trade) => ({
      closeTime: trade.closeTime,
      id: trade.id,
      netProfit: netProfit(trade),
      notes: trade.notes,
      rMultiple: trade.rMultiple,
      session: trade.session,
      side: trade.side,
      symbol: trade.symbol
    }))
  };

  const provider = getProvider();
  const prompt = buildWeeklyReviewPrompt(input);
  const result = await provider.generateStructured({ ...prompt, maxTokens: 1800, schema: WeeklyReviewSchema });
  const { review, warnings } = validateWeeklyReviewOutput(result.data, input);
  for (const warning of warnings) console.warn({ warning }, "weekly review validation warning");

  const legacy = serializeReviewForLegacy(review);
  const row = await prisma.weeklyReview.upsert({
    create: {
      actions: legacy.actions,
      leaks: legacy.leaks,
      model: provider.model,
      periodEnd,
      periodStart,
      report: review,
      strengths: legacy.strengths,
      summary: legacy.summary,
      tokensUsed: result.tokensUsed,
      tradingAccountId: account.id,
      userId: account.brokerConnection.userId
    },
    update: {
      actions: legacy.actions,
      leaks: legacy.leaks,
      model: provider.model,
      periodEnd,
      report: review,
      strengths: legacy.strengths,
      summary: legacy.summary,
      tokensUsed: result.tokensUsed
    },
    where: { tradingAccountId_periodStart: { periodStart, tradingAccountId: account.id } }
  });

  const recurring = recurringRecord(profile.recurringLeaks);
  const appeared = new Set(review.coachProfileDelta.newRecurringLeaks);
  for (const key of Object.keys(recurring)) {
    if (!appeared.has(key)) recurring[key] = Math.max(0, (recurring[key] ?? 0) - 1);
  }
  for (const key of appeared) recurring[key] = (recurring[key] ?? 0) + 1;
  for (const key of review.coachProfileDelta.resolvedLeaks) recurring[key] = 0;

  await prisma.coachProfile.update({ where: { userId: account.brokerConnection.userId }, data: { recurringLeaks: recurring } });
  for (const text of review.coachProfileDelta.adviceGiven) {
    await prisma.adviceLog.create({ data: { status: "unmarked", text, userId: account.brokerConnection.userId, weekStart: periodStart } });
  }
  if (data.budgetStore) await recordTokens(data.budgetStore, account.brokerConnection.userId, result.tokensUsed);

  return { review: row };
}
