import { BadRequestException, Body, Controller, Get, HttpException, HttpStatus, Module, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  buildWeeklyReviewPrompt,
  canUseTokens,
  getProvider,
  recordTokens,
  selectRepresentativeTrades,
  validateWeeklyReviewOutput,
  WeeklyReviewSchema,
  type WeeklyReviewInput,
  type WeeklyReviewOutput
} from "@tradescribe/ai";
import { computeMetrics, type MetricsTrade } from "@tradescribe/metrics";
import { z } from "zod";
import { AuthGuard } from "../auth/auth.guard.js";
import type { AuthenticatedUser } from "../auth/auth.types.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { RedisService } from "../redis/redis.service.js";

const COOLDOWN_MS = 15 * 60 * 1000;

const CoachProfileSchema = z.object({
  goals: z.array(z.string().min(1).max(160)).max(8)
});

const AdviceStatusSchema = z.object({
  status: z.enum(["pending", "did_this", "didnt_do_this"])
});

const AccountScopeSchema = z.object({
  accountId: z.string().optional()
});

interface UserPlanRow {
  plan: "FREE" | "CORE" | "PRO";
  role: "ADMIN" | "USER";
}

interface ReviewRow {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  report?: unknown;
  summary: string;
  strengths: unknown;
  leaks: unknown;
  actions: unknown;
  model?: string | null;
  tokensUsed?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface CoachProfileRow {
  goals: unknown;
  recurringLeaks: unknown;
  riskProfileSummary: string;
  updatedAt: Date;
}

interface AdviceLogRow {
  id: string;
  text: string;
  status: string;
  weekStart: Date | null;
  createdAt: Date;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException({
      message: "Validation failed",
      issues: result.error.issues.map((issue) => ({ message: issue.message, path: issue.path.join(".") }))
    });
  }
  return result.data;
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

function endOfWeek(start: Date) {
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

interface ReviewTradeRow {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  openTime: Date;
  closeTime: Date;
  openPrice: number;
  closePrice: number;
  volume: number;
  grossProfit: number;
  commission: number;
  swap: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskAmount: number | null;
  rMultiple: number | null;
  durationSec: number | null;
  session?: string | null;
  notes?: Array<{ body: string }>;
}

function toMetricsTrade(row: ReviewTradeRow): MetricsTrade {
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

function netProfit(row: ReviewTradeRow) {
  return row.grossProfit + row.commission + row.swap;
}

function recurringRecord(value: unknown): Record<string, number> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, number>;
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item) => [String((item as { label?: string }).label ?? "unknown"), Number((item as { count?: number }).count ?? 0)]));
  }
  return {};
}

function recurringForUi(value: unknown) {
  if (Array.isArray(value)) return value;
  return Object.entries(recurringRecord(value))
    .filter(([, count]) => count > 0)
    .map(([label, count]) => ({ label, count, weeks: 6 }));
}

function adviceStatus(status: string): "done" | "not_done" | "unmarked" {
  if (status === "did_this" || status === "done") return "done";
  if (status === "didnt_do_this" || status === "not_done") return "not_done";
  return "unmarked";
}

function adviceStatusForUi(status: string): "pending" | "did_this" | "didnt_do_this" {
  if (status === "done" || status === "did_this") return "did_this";
  if (status === "not_done" || status === "didnt_do_this") return "didnt_do_this";
  return "pending";
}

function legacyFromReport(report: WeeklyReviewOutput) {
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

@Controller()
@UseGuards(AuthGuard)
export class ReviewsController {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redis: RedisService
  ) {}

  private async entitlementFor(user: AuthenticatedUser) {
    const prisma = await this.prismaService.client();
    const row = (await prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, role: true }
    })) as UserPlanRow | null;
    const role = row?.role ?? user.role;
    return {
      isAdmin: role === "ADMIN",
      plan: row?.plan ?? user.plan,
      role
    };
  }

  private async assertAccountOwnership(userId: string, accountId?: string) {
    if (!accountId) return;
    const prisma = await this.prismaService.client();
    const count = await prisma.tradingAccount.count({ where: { id: accountId, brokerConnection: { userId } } });
    if (!count) throw new BadRequestException("Account not found or not yours");
  }

  private async latestReview(userId: string, accountId?: string) {
    const prisma = await this.prismaService.client();
    return (await prisma.weeklyReview.findFirst({
      where: { userId, ...(accountId ? { tradingAccountId: accountId } : {}) },
      orderBy: { periodStart: "desc" }
    })) as ReviewRow | null;
  }

  private async cooldown(userId: string, accountId?: string) {
    const latest = await this.latestReview(userId, accountId);
    if (!latest) return null;
    const until = new Date(latest.createdAt.getTime() + COOLDOWN_MS);
    return until > new Date() ? until : null;
  }

  @Get("reviews/weekly/latest")
  async latest(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const { accountId } = parse(AccountScopeSchema, query);
    await this.assertAccountOwnership(user.id, accountId);
    const entitlement = await this.entitlementFor(user);
    if (!entitlement.isAdmin && entitlement.plan === "FREE") {
      return {
        locked: true,
        reason: "weekly_review_requires_core",
        plan: entitlement.plan
      };
    }

    const [review, cooldownUntil] = await Promise.all([this.latestReview(user.id, accountId), this.cooldown(user.id, accountId)]);
    if (!review) {
      return {
        locked: false,
        review: null,
        canGenerate: true,
        cooldownUntil: null
      };
    }

    return {
      locked: false,
      review: serializeReview(review),
      canGenerate: !cooldownUntil,
      cooldownUntil: cooldownUntil?.toISOString() ?? null
    };
  }

  @Post("reviews/weekly/generate")
  async generate(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    const { accountId } = parse(AccountScopeSchema, query);
    await this.assertAccountOwnership(user.id, accountId);
    const entitlement = await this.entitlementFor(user);
    if (!entitlement.isAdmin && entitlement.plan === "FREE") {
      return {
        locked: true,
        reason: "weekly_review_requires_core",
        plan: entitlement.plan
      };
    }

    const cooldownUntil = await this.cooldown(user.id, accountId);
    if (cooldownUntil) {
      throw new HttpException(
        {
          message: "Weekly review generation is cooling down.",
          cooldownUntil: cooldownUntil.toISOString()
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (!(await canUseTokens(this.redis, user.id, 1))) {
      throw new HttpException({ message: "Daily AI token budget is exhausted. Try again tomorrow." }, HttpStatus.TOO_MANY_REQUESTS);
    }

    const prisma = await this.prismaService.client();
    const account = (await prisma.tradingAccount.findFirst({
      where: accountId ? { id: accountId, brokerConnection: { userId: user.id } } : { brokerConnection: { userId: user.id } },
      include: { brokerConnection: { include: { user: { include: { preferences: true } } } } },
      orderBy: { createdAt: "asc" }
    })) as { id: string; startingBalance: number; brokerConnection: { userId: string; user: { preferences?: { timeZone?: string | null } | null } } } | null;
    if (!account) {
      return { locked: false, review: null, canGenerate: true, cooldownUntil: null };
    }

    const periodStart = startOfWeek(new Date());
    const periodEnd = endOfWeek(periodStart);
    const timeZone = account.brokerConnection.user.preferences?.timeZone ?? "UTC";
    const [trades, snapshots, leaks, profile, advice] = (await Promise.all([
      prisma.trade.findMany({
        where: { tradingAccountId: account.id, closeTime: { gte: periodStart, lte: periodEnd } },
        include: { notes: true },
        orderBy: { closeTime: "asc" }
      }),
      prisma.equitySnapshot.findMany({ where: { tradingAccountId: account.id, ts: { gte: periodStart, lte: periodEnd } }, orderBy: { ts: "asc" } }),
      prisma.leakFlag.findMany({
        where: { tradingAccountId: account.id, OR: [{ periodStart: { gte: periodStart, lte: periodEnd } }, { createdAt: { gte: periodStart, lte: periodEnd } }] },
        orderBy: [{ severity: "asc" }, { createdAt: "desc" }]
      }),
      prisma.coachProfile.upsert({
        create: { goals: [], recurringLeaks: {}, riskProfileSummary: "Risk profile is still forming.", userId: user.id },
        update: {},
        where: { userId: user.id }
      }),
      prisma.adviceLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 12 })
    ])) as [
      ReviewTradeRow[],
      Array<{ ts: Date; equity: number; balance: number }>,
      Array<{ id: string; type: string; severity: "info" | "warning" | "critical"; tradeIds: string[]; evidence: unknown }>,
      CoachProfileRow,
      AdviceLogRow[]
    ];

    const metrics = computeMetrics({
      equitySnapshots: snapshots,
      startingBalance: account.startingBalance,
      timeZone,
      trades: trades.map(toMetricsTrade)
    });
    const representativeTrades = selectRepresentativeTrades(trades, leaks).map((trade) => ({
      closeTime: trade.closeTime,
      id: trade.id,
      netProfit: netProfit(trade),
      notes: trade.notes,
      rMultiple: trade.rMultiple,
      session: trade.session,
      side: trade.side,
      symbol: trade.symbol
    }));
    const aggregate: WeeklyReviewInput = {
      coachProfile: {
        adviceLog: advice.map((item) => ({
          advice: item.text,
          status: adviceStatus(item.status),
          week: (item.weekStart ?? item.createdAt).toISOString().slice(0, 10)
        })),
        goals: Array.isArray(profile.goals) ? profile.goals.map(String) : [],
        recurringLeaks: recurringRecord(profile.recurringLeaks)
      },
      leakFlags: leaks,
      metrics: { ...metrics, byDayOfWeek: metrics.byDayOfWeek, bySession: metrics.bySession, drawdown: metrics.drawdown },
      period: { end: periodEnd.toISOString(), label: `${periodStart.toISOString().slice(0, 10)} - ${periodEnd.toISOString().slice(0, 10)}`, start: periodStart.toISOString() },
      representativeTrades
    };

    const provider = getProvider();
    const prompt = buildWeeklyReviewPrompt(aggregate);
    const llm = await provider.generateStructured({ ...prompt, maxTokens: 1800, schema: WeeklyReviewSchema });
    const { review: report } = validateWeeklyReviewOutput(llm.data, aggregate);
    const legacy = legacyFromReport(report);
    const review = (await prisma.weeklyReview.upsert({
      create: {
        actions: legacy.actions,
        leaks: legacy.leaks,
        model: provider.model,
        periodEnd,
        periodStart,
        report,
        strengths: legacy.strengths,
        summary: legacy.summary,
        tokensUsed: llm.tokensUsed,
        tradingAccountId: account.id,
        userId: user.id
      },
      update: {
        actions: legacy.actions,
        leaks: legacy.leaks,
        model: provider.model,
        periodEnd,
        report,
        strengths: legacy.strengths,
        summary: legacy.summary,
        tokensUsed: llm.tokensUsed
      },
      where: { tradingAccountId_periodStart: { periodStart, tradingAccountId: account.id } }
    })) as ReviewRow;

    const recurring = recurringRecord(profile.recurringLeaks);
    const appeared = new Set(report.coachProfileDelta.newRecurringLeaks);
    for (const key of Object.keys(recurring)) {
      if (!appeared.has(key)) recurring[key] = Math.max(0, (recurring[key] ?? 0) - 1);
    }
    for (const key of appeared) recurring[key] = (recurring[key] ?? 0) + 1;
    for (const key of report.coachProfileDelta.resolvedLeaks) recurring[key] = 0;
    await prisma.coachProfile.update({ where: { userId: user.id }, data: { recurringLeaks: recurring } });
    await Promise.all(report.coachProfileDelta.adviceGiven.map((text) => prisma.adviceLog.create({ data: { status: "unmarked", text, userId: user.id, weekStart: periodStart } })));
    await recordTokens(this.redis, user.id, llm.tokensUsed);

    return { locked: false, review: serializeReview(review), canGenerate: false, cooldownUntil: new Date(review.createdAt.getTime() + COOLDOWN_MS).toISOString() };
  }

  @Get("coach/profile")
  async profile(@CurrentUser() user: AuthenticatedUser) {
    const entitlement = await this.entitlementFor(user);
    const prisma = await this.prismaService.client();
    const [profile, advice] = (await Promise.all([
      prisma.coachProfile.upsert({
        create: {
          goals: ["Max 3 trades/day", "No re-entry within 5 minutes of a full-risk loss"],
          recurringLeaks: [
            { label: "Revenge trading", count: 4, weeks: 6 },
            { label: "Overtrading", count: 3, weeks: 6 }
          ],
          riskProfileSummary: "Risk profile is still forming. Keep stops and trade intent explicit so the coach can compare behavior over time.",
          userId: user.id
        },
        update: {},
        where: { userId: user.id }
      }),
      prisma.adviceLog.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 12
      })
    ])) as [CoachProfileRow, AdviceLogRow[]];

    return {
      locked: !entitlement.isAdmin && entitlement.plan === "FREE",
      profile: {
        goals: profile.goals,
        recurringLeaks: recurringForUi(profile.recurringLeaks),
        riskProfileSummary: profile.riskProfileSummary,
        updatedAt: profile.updatedAt.toISOString()
      },
      advice: advice.map((item) => ({
        id: item.id,
        text: item.text,
        status: adviceStatusForUi(item.status),
        weekStart: item.weekStart?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString()
      }))
    };
  }

  @Patch("coach/profile")
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const parsed = parse(CoachProfileSchema, body);
    const prisma = await this.prismaService.client();
    const profile = (await prisma.coachProfile.upsert({
      create: {
        goals: parsed.goals,
        recurringLeaks: [],
        riskProfileSummary: "Risk profile is still forming.",
        userId: user.id
      },
      update: { goals: parsed.goals },
      where: { userId: user.id }
    })) as CoachProfileRow;

    return {
      goals: profile.goals,
      recurringLeaks: recurringForUi(profile.recurringLeaks),
      riskProfileSummary: profile.riskProfileSummary,
      updatedAt: profile.updatedAt.toISOString()
    };
  }

  @Patch("coach/advice/:id")
  async updateAdvice(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() body: unknown) {
    const parsed = parse(AdviceStatusSchema, body);
    const prisma = await this.prismaService.client();
    const existing = (await prisma.adviceLog.findFirst({ where: { id, userId } })) as { id: string } | null;
    if (!existing) {
      throw new BadRequestException("Advice item not found");
    }
    const updated = (await prisma.adviceLog.update({ where: { id }, data: { status: parsed.status } })) as AdviceLogRow;
    return {
      id: updated.id,
      text: updated.text,
      status: adviceStatusForUi(updated.status),
      weekStart: updated.weekStart?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString()
    };
  }
}

function serializeReview(review: ReviewRow) {
  const report = WeeklyReviewSchema.safeParse(review.report);
  if (report.success) {
    const legacy = legacyFromReport(report.data);
    return {
      id: review.id,
      actions: legacy.actions,
      createdAt: review.createdAt.toISOString(),
      leaks: legacy.leaks,
      periodEnd: review.periodEnd.toISOString(),
      periodStart: review.periodStart.toISOString(),
      strengths: legacy.strengths,
      summary: legacy.summary,
      updatedAt: review.updatedAt.toISOString()
    };
  }

  return {
    id: review.id,
    actions: review.actions,
    createdAt: review.createdAt.toISOString(),
    leaks: review.leaks,
    periodEnd: review.periodEnd.toISOString(),
    periodStart: review.periodStart.toISOString(),
    strengths: review.strengths,
    summary: review.summary,
    updatedAt: review.updatedAt.toISOString()
  };
}

@Module({
  controllers: [ReviewsController],
  providers: [PrismaService, RedisService]
})
export class ReviewsModule {}
